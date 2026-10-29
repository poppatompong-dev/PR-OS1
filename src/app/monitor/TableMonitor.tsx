"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { fetchMonitorEvents, fetchMonitorTeam } from "@/lib/monitor/client";
import type { MonitorEvent } from "@/lib/monitor/types";
import { Avatar } from "@/components/Avatar";
import { MascotSide, type SideAck, type SideNext } from "./MascotSide";
import "./monitor-table.css";

/**
 * The department wall screen — "แบบ 1 · รายการเต็ม", the layout the team
 * picked out of the four that were put up for review.
 *
 * It is built for one job: being read from the far side of the room, all day,
 * by someone walking past who is never going to touch it. Everything else
 * follows from that. No rotation and no carousel, because a screen that hides
 * what you came to look at is worse than a smaller one. Four questions have
 * to be answerable at a glance, and each has its own place on the panel:
 *
 *   วันนี้ใครไปไหน        -> the big rows, full names and roles, never initials
 *   วันข้างหน้ามีอะไร      -> the six day cards along the bottom
 *   อะไรเปลี่ยนหรือยกเลิก  -> the alert strip, pinned directly under the header
 *   ใครยังไม่รับทราบ       -> a chip on the work it belongs to, not a summary
 *
 * How many rows fit is measured, not guessed: the department's workload is
 * uneven, so a hard-coded count either wastes half the panel on a quiet day
 * or silently clips work on a busy one. The type size stays fixed and the
 * overflow is declared in the section heading instead.
 */

const TH_WEEKDAY_LONG = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];
const TH_WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTH_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const TH_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** Everything here is resolved in Asia/Bangkok, never the display's own zone:
 *  a TV stick left on a factory-default timezone is common, and a wall clock
 *  that is hours out is worse than no clock at all. */
function bangkokNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  // Reconstructed as a UTC date purely to read the weekday back out without
  // dragging the host timezone into the answer.
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return {
    iso,
    hh: get("hour"),
    mm: get("minute"),
    ss: get("second"),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday,
  };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return { y, m, d, weekday };
}

/** "วันอาทิตย์ที่ 11 ตุลาคม 2569" — Buddhist era, written out, because this is
 *  the form every other notice in the building uses. */
function thaiLongDate(iso: string): string {
  const { y, m, d, weekday } = parts(iso);
  return `${TH_WEEKDAY_LONG[weekday]}ที่ ${d} ${TH_MONTH_LONG[m - 1]} ${y + 543}`;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

type Alert = {
  key: string;
  kind: "cancel" | "change";
  when: string;
  title: string;
  why: string;
};

/** Click / Enter opens the job page. Only used when signed in (never on the TV). */
function openProps(id: string, title: string) {
  const go = () => window.location.assign(`/events/${id}`);
  return {
    role: "link" as const,
    tabIndex: 0,
    title: `ดูรายละเอียด: ${title}`,
    style: { cursor: "pointer" },
    onClick: go,
    onKeyDown: (ev: KeyboardEvent<HTMLElement>) => {
      if (ev.key === "Enter") go();
    },
  };
}

export function TableMonitor({
  variant = "default",
  staticMode = false,
  linkable = false,
}: {
  /** Signed in on a phone/PC (not the TV): tapping a job opens its page (owner, 26 Oct 2026). */
  linkable?: boolean;
  /** "3d" = the same screen plus the mascot column (/monitor?v=3d): navy
   *  studio theme with the pre-rendered โพโพ + ฟูฟู loops (owner, 21 Oct 2026). */
  variant?: "default" | "3d";
  /** ?static=1 — draw the mascot once and never animate. */
  staticMode?: boolean;
} = {}) {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  // name → people.id, so the TV can put each assignee's cartoon next to them.
  // The monitor feed carries names only; the public team list carries ids.
  const [teamIds, setTeamIds] = useState<Record<string, string>>({});
  const [offNames, setOffNames] = useState<Set<string>>(new Set());
  useEffect(() => {
    const loadTeam = () =>
      fetchMonitorTeam()
        .then((team) => {
          setTeamIds(Object.fromEntries(team.map((p) => [p.displayName, p.id])));
          setOffNames(new Set(team.filter((p) => p.avatarOff).map((p) => p.displayName)));
        })
        .catch(() => undefined);
    loadTeam();
    const id = window.setInterval(loadTeam, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [clock, setClock] = useState<ReturnType<typeof bangkokNow> | null>(null);

  // The clock is the only thing that moves on this screen. It also drives
  // "which job is next", so it has to tick even when no data arrives.
  useEffect(() => {
    const tick = () => setClock(bangkokNow());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(() => {
    fetchMonitorEvents()
      .then((list) => {
        setEvents(list);
        setLoaded(true);
      })
      .catch(() => {
        /* Keep whatever is on screen. A blank wall screen reads as "no work
           today", which is a worse lie than slightly stale work. */
      });
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const today = clock?.iso ?? "";
  const nowMinutes = clock?.minutes ?? 0;

  const todayEvents = useMemo(
    () =>
      events
        .filter((e) => e.eventDate === today && e.status !== "canceled")
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, today],
  );

  const alerts = useMemo<Alert[]>(() => {
    if (!today) return [];
    const label = (iso: string, time: string) => {
      if (iso === today) return `วันนี้ ${time}`;
      if (iso === addDays(today, 1)) return `พรุ่งนี้ ${time}`;
      const p = parts(iso);
      return `${TH_WEEKDAY_SHORT[p.weekday]} ${p.d} ${TH_MONTH_SHORT[p.m - 1]} ${time}`;
    };
    const canceled = events
      .filter((e) => e.status === "canceled")
      .map<Alert>((e) => ({
        key: `c-${e.id}`,
        kind: "cancel",
        when: label(e.eventDate, e.startTime),
        title: e.title,
        why: e.cancellationReason
          ? `ยกเลิก — ${e.cancellationReason}`
          : "ยกเลิก",
      }));
    const changed = events
      .filter((e) => e.status !== "canceled" && e.hasChanges)
      .map<Alert>((e) => ({
        key: `h-${e.id}`,
        kind: "change",
        when: label(e.eventDate, e.startTime),
        title: e.title,
        why: "มีการแก้ไขรายละเอียด ตรวจสอบก่อนออกงาน",
      }));
    // Cancellations first: they are the ones that waste a trip.
    return [...canceled, ...changed].slice(0, 3);
  }, [events, today]);

  const week = useMemo(() => {
    if (!today) return [];
    return Array.from({ length: 6 }, (_, i) => {
      const iso = addDays(today, i + 1);
      const p = parts(iso);
      const items = events
        .filter((e) => e.eventDate === iso && e.status !== "canceled")
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      return { iso, ...p, items };
    });
  }, [events, today]);

  /* On a quiet day the today list leaves a wide empty band in the middle of
     the panel. Rather than let it sit there, the week cards below take the
     room and list more of what is coming — a quiet day is exactly when
     people look further ahead.

     This is deliberately a function of the data alone, never of the measured
     leftover space: deriving it from pixels would make the week section grow,
     which shrinks the space it was measured against, which shrinks it back
     again. The row-fitting pass further down runs after this and absorbs
     whatever height the week section ends up with. */
  const weekItems = todayEvents.length <= 2 ? 4 : todayEvents.length <= 4 ? 2 : 1;

  const nextIndex = todayEvents.findIndex(
    (e) => minutesOf(e.endTime || e.startTime) >= nowMinutes,
  );

  // ---- the mascot column (variant "3d" only) -----------------------------
  const sideNext = useMemo<SideNext>(() => {
    if (todayEvents.length === 0) return { kind: "none" };
    const upcoming = todayEvents.find((e) => minutesOf(e.startTime) >= nowMinutes);
    if (upcoming) {
      return {
        kind: "upcoming",
        minutes: minutesOf(upcoming.startTime) - nowMinutes,
        title: upcoming.title,
        place: upcoming.locationName,
        start: upcoming.startTime,
      };
    }
    const running = todayEvents.find((e) => e.endTime && minutesOf(e.endTime) >= nowMinutes);
    if (running) {
      return { kind: "now", title: running.title, place: running.locationName, end: running.endTime };
    }
    return { kind: "done" };
  }, [todayEvents, nowMinutes]);

  const sideAck = useMemo<SideAck>(() => {
    const people = todayEvents.flatMap((e) => e.assigneeDetail);
    return {
      total: people.length,
      done: people.filter((p) => p.ack).length,
      pending: people.filter((p) => !p.ack && !p.unavailable).length,
      unavailable: people.filter((p) => p.unavailable).length,
    };
  }, [todayEvents]);

  /* ---- how many rows actually fit -------------------------------------
     Every row is always rendered, and the ones whose bottom edge falls past
     the container are hidden with visibility rather than removed. That keeps
     the measurement idempotent: the layout never changes as a result of
     measuring it, so there is no pass that can read a half-settled screen and
     then never look again. A resize, a data change or a late-arriving webfont
     all re-run it. */
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const [fitCount, setFitCount] = useState(0);
  const signature = todayEvents.map((e) => e.id).join(",");

  const measure = useCallback(() => {
    const el = rowsRef.current;
    if (!el) return;
    const limit = el.clientHeight;
    let n = 0;
    for (const child of Array.from(el.children) as HTMLElement[]) {
      if (child.offsetTop + child.offsetHeight <= limit + 1) n += 1;
      else break;
    }
    setFitCount(n);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, signature]);

  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => measure()).catch(() => {});
    }
    return () => observer.disconnect();
  }, [measure]);

  // 0 means "not measured yet" — show everything and let overflow:hidden do
  // the clipping for that one frame, rather than flashing an empty panel.
  const visible = fitCount > 0 ? fitCount : todayEvents.length;
  const hidden = Math.max(0, todayEvents.length - visible);


  return (
    <div className={variant === "3d" ? "tv tv--3d" : "tv"}>
      <header className="tv-head">
        <div className="tv-head-l">
          <span className="tv-seal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seal.png" alt="ตราเทศบาลนครนครสวรรค์" />
          </span>
          <div>
            <h1>เทศบาลนครนครสวรรค์</h1>
            <p className="tv-head-sub">ตารางงานประชาสัมพันธ์</p>
          </div>
        </div>
        <div className="tv-head-r">
          <div className="tv-clock">
            {clock ? `${clock.hh}:${clock.mm}:${clock.ss}` : "--:--:--"}
          </div>
          <div className="tv-date">{today ? thaiLongDate(today) : ""}</div>
        </div>
      </header>

      {alerts.length > 0 ? (
        <div className="tv-alerts">
          {alerts.map((a) => (
            <div key={a.key} className={`tv-alert tv-alert-${a.kind}`}>
              <span className="tv-alert-tag">
                {a.kind === "cancel" ? "ยกเลิก" : "เปลี่ยนแปลง"}
              </span>
              <span className="tv-alert-when">{a.when}</span>
              <span className="tv-alert-txt">
                <b>{a.title}</b> — <span className="tv-alert-why">{a.why}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div />
      )}

      <div className="tv-mid">
      <section className="tv-today">
        <div className="tv-sec">
          <h2>งานวันนี้</h2>
          <span>
            {todayEvents.length} รายการ
            {hidden > 0 ? ` · อีก ${hidden} งานไม่ได้แสดง` : ""}
          </span>
        </div>

        <div className="tv-rows" ref={rowsRef} data-fit={fitCount}>
          {todayEvents.length === 0 ? (
            <p className="tv-empty">วันนี้ไม่มีงานประชาสัมพันธ์ตามแผน</p>
          ) : (
            todayEvents.map((e, i) => {
              const pending = e.assigneeDetail.filter((p) => !p.ack && !p.unavailable).length;
              const unavailable = e.assigneeDetail.filter((p) => p.unavailable).length;
              const past = minutesOf(e.endTime || e.startTime) < nowMinutes;
              return (
                <article
                  key={e.id}
                  className={`tv-row${i === nextIndex ? " is-next" : ""}${past ? " is-past" : ""}${i >= visible ? " is-clipped" : ""}`}
                  {...(linkable ? openProps(e.id, e.title) : {})}
                >
                  <div className="tv-time">
                    <strong>{e.startTime}</strong>
                    {e.endTime ? <span>ถึง {e.endTime}</span> : null}
                  </div>
                  <div>
                    <h3 className="tv-title">{e.title}</h3>
                    <p className="tv-place">
                      {e.locationName} · {e.departmentShort}
                    </p>
                    <div className="tv-people">
                      {e.assigneeDetail.map((p, k) => (
                        <i className="tv-person" key={`${e.id}-${k}`}>
                          {offNames.has(p.name) ? null : (
                            <Avatar
                              personId={teamIds[p.name]}
                              name={p.name}
                              size={38}
                              eager
                              className={`tv-avatar ${p.ack ? "is-ack" : p.unavailable ? "is-unavailable" : "is-pending"}`}
                            />
                          )}
                          <b>{p.name}</b> <small>({p.role})</small>
                          {p.unavailable ? <small className="tv-unavailable"> ไม่สะดวก</small> : null}
                        </i>
                      ))}
                      {pending > 0 ? (
                        <span className="tv-ack">ยังไม่รับทราบ {pending}</span>
                      ) : null}
                      {unavailable > 0 ? (
                        <span className="tv-ack tv-ack-unavailable">ต้องหาคนแทน {unavailable}</span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      {variant === "3d" ? (
        <MascotSide next={sideNext} ack={sideAck} staticMode={staticMode} minutes={nowMinutes} todayCount={todayEvents.length} ready={loaded && clock !== null} />
      ) : null}
      </div>

      <section>
        <div className="tv-sec">
          <h2>วันข้างหน้า</h2>
        </div>
        <div className="tv-week">
          {week.map((d) => (
            <div className="tv-day" key={d.iso}>
              <span className="tv-dow">{TH_WEEKDAY_SHORT[d.weekday]}</span>{" "}
              <b>{d.d}</b> <span className="tv-dow">{TH_MONTH_SHORT[d.m - 1]}</span>
              {d.items.length > 0 ? (
                <span className="tv-count">{d.items.length}</span>
              ) : null}
              {d.items.length > 0 ? (
                <ul>
                  {d.items.slice(0, weekItems).map((it) => (
                    <li key={it.id} {...(linkable ? openProps(it.id, it.title) : {})}>
                      <i>{it.startTime}</i> {it.title}
                    </li>
                  ))}
                  {d.items.length > weekItems ? (
                    <li className="tv-day-more">
                      อีก {d.items.length - weekItems} งาน
                    </li>
                  ) : null}
                </ul>
              ) : (
                <div className="tv-day-none">ไม่มีงาน</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="tv-foot">
        จอภายในหน่วยงาน · ข้อมูลอัปเดตเองทุก 60 วินาที · ไม่แสดงเบอร์โทร
        หมายเหตุภายใน หรือไฟล์แนบส่วนตัว
      </footer>
    </div>
  );
}
