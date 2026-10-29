"use client";

/**
 * The department wall screen — "แบบ A · งานถัดไปเด่น" (owner picked it on
 * 28 Oct 2026 out of three big-card mockups; docs/tv-designs/2026-10-27-big-cards).
 *
 * Read from the far side of the room by someone walking past. The one thing
 * it answers first, in the biggest type on the panel: what is next, how long
 * until it starts, and who is going. Everything else is smaller and secondary:
 *   right  — today's numbers and the rest of today's work
 *   strip  — what changed or was canceled (scrolls when there is any)
 *   bottom — the six days ahead
 * Light motion only (fade-in, a slow glow on the big card, a blinking mark on
 * whoever has not acknowledged), so the TV's own browser keeps up. ?static=1
 * or the system "reduce motion" setting turns it all off.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { fetchMonitorEvents, fetchMonitorTeam } from "@/lib/monitor/client";
import type { MonitorAssignee, MonitorEvent } from "@/lib/monitor/types";
import { inMinutes, minutesOf, pickHero } from "@/lib/monitor/hero";
import {
  TH_MONTH_SHORT,
  TH_WEEKDAY_SHORT,
  addDaysIso,
  bangkokNow,
  isoParts,
  thaiLongDate,
  whenLabel,
} from "@/lib/monitor/thai-time";
import { Avatar } from "@/components/Avatar";
import "./monitor-hero.css";

/** Click / Enter opens the job page. Only when signed in (never on the TV). */
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

function ackClass(p: MonitorAssignee) {
  return p.ack ? "is-ack" : p.unavailable ? "is-off" : "is-wait";
}

export function HeroMonitor({ linkable = false, staticMode = false }: { linkable?: boolean; staticMode?: boolean }) {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [teamIds, setTeamIds] = useState<Record<string, string>>({});
  const [clock, setClock] = useState<ReturnType<typeof bangkokNow> | null>(null);

  useEffect(() => {
    const tick = () => setClock(bangkokNow());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(() => {
    fetchMonitorEvents()
      .then(setEvents)
      .catch(() => {
        /* Keep what is on screen: a blank wall reads as "no work today". */
      });
  }, []);
  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const loadTeam = () =>
      fetchMonitorTeam()
        .then((team) => setTeamIds(Object.fromEntries(team.map((p) => [p.displayName, p.id]))))
        .catch(() => undefined);
    loadTeam();
    const id = window.setInterval(loadTeam, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const today = clock?.iso ?? "";
  const now = clock?.minutes ?? 0;

  const live = useMemo(() => events.filter((e) => e.status !== "canceled"), [events]);
  const todayEvents = useMemo(
    () => live.filter((e) => e.eventDate === today).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [live, today],
  );
  const hero = useMemo(() => (today ? pickHero(events, today, now) : { kind: "none" as const }), [events, today, now]);
  const heroId = hero.kind === "none" ? null : hero.event.id;
  const others = todayEvents.filter((e) => e.id !== heroId);

  const pendingToday = todayEvents.flatMap((e) => e.assigneeDetail).filter((p) => !p.ack && !p.unavailable).length;
  // The feed reaches 14 days ahead since 0017; this tile still says "7 วันข้างหน้า".
  const ahead = today ? live.filter((e) => e.eventDate > today && e.eventDate <= addDaysIso(today, 7)).length : 0;

  const alerts = useMemo(() => {
    if (!today) return [];
    const canceled = events
      .filter((e) => e.status === "canceled")
      .map((e) => `⛔ ยกเลิก ${whenLabel(e.eventDate, e.startTime, today)} ${e.title}${e.cancellationReason ? ` — ${e.cancellationReason}` : ""}`);
    const changed = live
      .filter((e) => e.hasChanges)
      .map((e) => `🔄 เปลี่ยนแปลง ${whenLabel(e.eventDate, e.startTime, today)} ${e.title} — ตรวจสอบก่อนออกงาน`);
    return [...canceled, ...changed];
  }, [events, live, today]);

  const week = useMemo(() => {
    if (!today) return [];
    return Array.from({ length: 6 }, (_, i) => {
      const iso = addDaysIso(today, i + 1);
      const items = live.filter((e) => e.eventDate === iso).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return { iso, ...isoParts(iso), items };
    });
  }, [live, today]);

  const link = (e: MonitorEvent) => (linkable ? openProps(e.id, e.title) : {});

  // ---- the big card ---------------------------------------------------------
  let tag = "";
  let barLabel = "";
  if (hero.kind === "running") {
    tag = `กำลังดำเนินการ · เหลือ ${inMinutes(hero.minutesLeft).replace("อีก ", "")}`;
    barLabel = `จบประมาณ ${hero.event.endTime || "—"} น.`;
  } else if (hero.kind === "upcoming") {
    tag = hero.sameDay
      ? `งานถัดไป · ${inMinutes(hero.minutesTo)}`
      : `งานถัดไป · ${whenLabel(hero.event.eventDate, hero.event.startTime, today).replace(/ \d\d:\d\d$/, "")}`;
    barLabel = hero.sameDay && hero.minutesTo <= 120 ? `เหลือเวลาเตรียมตัว ${inMinutes(hero.minutesTo).replace("อีก ", "")}` : "";
  }
  const heroEvent = hero.kind === "none" ? null : hero.event;
  const soon = hero.kind === "upcoming" && hero.sameDay && hero.minutesTo <= 30;

  return (
    <div className={`hm${staticMode ? " hm--still" : ""}`}>
      <header className="hm-head">
        <span className="hm-seal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seal.png" alt="ตราเทศบาลนครนครสวรรค์" />
        </span>
        <div>
          <h1>เทศบาลนครนครสวรรค์</h1>
          <p>ตารางงานประชาสัมพันธ์</p>
        </div>
        <div className="hm-clock">
          <b>{clock ? `${clock.hh}:${clock.mm}` : "--:--"}</b>
          <span>{today ? thaiLongDate(today) : ""}</span>
        </div>
      </header>

      <main className="hm-main">
        {heroEvent ? (
          <article
            key={heroEvent.id}
            className={`hm-hero hm-hero--${hero.kind}${soon ? " is-soon" : ""}`}
            {...link(heroEvent)}
          >
            <span className="hm-tag">
              <i aria-hidden="true" />
              {tag}
            </span>
            {barLabel && hero.kind !== "none" ? (
              <div className="hm-bar">
                <p>{barLabel}</p>
                <div>
                  <span style={{ transform: `scaleX(${hero.progress})` }} />
                </div>
              </div>
            ) : null}
            <div className="hm-time">
              {heroEvent.startTime}
              {heroEvent.endTime ? <small>– {heroEvent.endTime}</small> : null}
            </div>
            <h2 className="hm-title">{heroEvent.title}</h2>
            <p className="hm-place">📍 {heroEvent.locationName || "ไม่ระบุสถานที่"}</p>
            {heroEvent.shortNote ? <p className="hm-note">{heroEvent.shortNote}</p> : null}
            <div className="hm-people">
              {heroEvent.assigneeDetail.map((p, k) => (
                <span className={`hm-pp ${ackClass(p)}`} key={`${p.name}-${k}`}>
                  <Avatar personId={teamIds[p.name]} name={p.name} size={56} eager className="hm-pp-img" />
                  <b>{p.name}</b>
                  <i>{p.role}</i>
                  <em aria-label={p.ack ? "รับทราบแล้ว" : p.unavailable ? "ไม่สะดวก" : "ยังไม่รับทราบ"}>
                    {p.ack ? "✓" : p.unavailable ? "✕" : "!"}
                  </em>
                </span>
              ))}
            </div>
          </article>
        ) : (
          <article className="hm-hero hm-hero--none">
            <span className="hm-tag">ไม่มีงานตามแผน</span>
            <h2 className="hm-title">7 วันข้างหน้ายังว่างอยู่</h2>
            <p className="hm-place">งานใหม่จะขึ้นที่นี่ทันทีที่เผยแพร่</p>
          </article>
        )}

        <aside className="hm-side">
          <div className="hm-stats">
            <div className="hm-st">
              <b key={`t${todayEvents.length}`}>{todayEvents.length}</b>
              <span>งานวันนี้</span>
            </div>
            <div className={`hm-st${pendingToday > 0 ? " is-warn" : " is-ok"}`}>
              <b key={`p${pendingToday}`}>{pendingToday}</b>
              <span>ยังไม่รับทราบ</span>
            </div>
            <div className="hm-st">
              <b key={`a${ahead}`}>{ahead}</b>
              <span>7 วันข้างหน้า</span>
            </div>
          </div>
          <div className="hm-list">
            <h3>งานอื่นวันนี้</h3>
            {others.length === 0 ? <p className="hm-empty">ไม่มีงานอื่นวันนี้</p> : null}
            {others.slice(0, 4).map((e, i) => {
              const past = (e.endTime ? minutesOf(e.endTime) : minutesOf(e.startTime) + 120) <= now;
              return (
                <div className={`hm-row${past ? " is-past" : ""}`} key={e.id} style={{ animationDelay: `${0.2 + i * 0.12}s` }} {...link(e)}>
                  <b className="hm-row-t">{e.startTime}</b>
                  <div className="hm-row-b">
                    <strong>{e.title}</strong>
                    <span>📍 {e.locationName || "ไม่ระบุสถานที่"}</span>
                  </div>
                  <div className="hm-row-p">
                    {e.assigneeDetail.slice(0, 4).map((p, k) => (
                      <Avatar key={`${p.name}-${k}`} personId={teamIds[p.name]} name={p.name} size={46} eager className={`hm-mini ${ackClass(p)}`} />
                    ))}
                  </div>
                </div>
              );
            })}
            {others.length > 4 ? <p className="hm-more">+ อีก {others.length - 4} งาน</p> : null}
          </div>
        </aside>
      </main>

      {alerts.length > 0 ? (
        <div className="hm-ticker" aria-label="การเปลี่ยนแปลง">
          <div style={{ animationDuration: `${Math.max(20, alerts.join("").length / 6)}s` }}>
            {/* Twice, so the loop has no gap. */}
            <span>{alerts.join("   •   ")}   •   </span>
            <span aria-hidden="true">{alerts.join("   •   ")}   •   </span>
          </div>
        </div>
      ) : (
        <div className="hm-ticker hm-ticker--quiet">✓ ไม่มีงานเปลี่ยนแปลงหรือยกเลิก</div>
      )}

      <footer className="hm-week">
        {week.map((d) => (
          <div className={`hm-day${d.items.length ? " has" : ""}`} key={d.iso}>
            <div className="hm-day-h">
              {TH_WEEKDAY_SHORT[d.weekday]} <b>{d.d}</b> {TH_MONTH_SHORT[d.m - 1]}
              {d.items.length ? <em>{d.items.length}</em> : null}
            </div>
            {d.items.length ? (
              <div className="hm-day-x" {...link(d.items[0])}>
                {d.items[0].startTime} {d.items[0].title}
              </div>
            ) : (
              <div className="hm-day-x is-none">ไม่มีงาน</div>
            )}
          </div>
        ))}
      </footer>
    </div>
  );
}
