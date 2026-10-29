"use client";

/**
 * TV "ผังคุณกุ๊ก" (Kook's layout, 29 Oct 2026): three numbers and today's work
 * on the left, the next four days that have work on the right, six more days
 * along the bottom, and the ticker (ประกาศบนจอ + cancellations/changes) last.
 * Themes: ?theme=a ม่วงเข้ม · b สว่าง · c กรมท่า-ทอง. ?static=1 stops motion.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { fetchMonitorAnnouncements, fetchMonitorEvents, fetchMonitorTeam } from "@/lib/monitor/client";
import type { MonitorAnnouncement, MonitorAssignee, MonitorEvent } from "@/lib/monitor/types";
import { buildBoard, screenTitle, thaiTime, titleSize } from "@/lib/monitor/board";
import { shortName } from "@/lib/monitor/rows";
import { TH_MONTH_SHORT, TH_WEEKDAY_SHORT, bangkokNow, isoParts, thaiLongDate, whenLabel } from "@/lib/monitor/thai-time";
import { Avatar } from "@/components/Avatar";
import "./monitor-hero.css";
import "./monitor-board.css";

export type BoardTheme = "a" | "b" | "c";

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

/** "พ. 30 ต.ค." pieces for a date block. */
function dayParts(iso: string) {
  const p = isoParts(iso);
  return { wd: TH_WEEKDAY_SHORT[p.weekday], d: p.d, mon: TH_MONTH_SHORT[p.m - 1] };
}

export function BoardMonitor({ linkable = false, staticMode = false, theme = "a" }: { linkable?: boolean; staticMode?: boolean; theme?: BoardTheme }) {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [notes, setNotes] = useState<MonitorAnnouncement[]>([]);
  const [team, setTeam] = useState<{ ids: Record<string, string>; off: Set<string> }>({ ids: {}, off: new Set() });
  const [clock, setClock] = useState<ReturnType<typeof bangkokNow> | null>(null);

  useEffect(() => {
    const tick = () => setClock(bangkokNow());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(() => {
    fetchMonitorEvents().then(setEvents).catch(() => undefined);
    fetchMonitorAnnouncements().then(setNotes).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const loadTeam = () =>
      fetchMonitorTeam()
        .then((t) => setTeam({ ids: Object.fromEntries(t.map((p) => [p.displayName, p.id])), off: new Set(t.filter((p) => p.avatarOff).map((p) => p.id)) }))
        .catch(() => undefined);
    loadTeam();
    const id = window.setInterval(loadTeam, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const today = clock?.iso ?? "";
  const now = clock?.minutes ?? 0;
  const board = useMemo(() => (today ? buildBoard(events, today, now) : null), [events, today, now]);

  const ticker = useMemo(() => {
    if (!today) return [];
    const said = notes.map((n) => `📢 ${n.message}${n.authorName ? ` — ${shortName(n.authorName)}` : ""}`);
    const canceled = events
      .filter((e) => e.status === "canceled")
      .map((e) => `⛔ ยกเลิก ${whenLabel(e.eventDate, e.startTime, today)} ${screenTitle(e)}${e.cancellationReason ? ` — ${e.cancellationReason}` : ""}`);
    const changed = events
      .filter((e) => e.status !== "canceled" && e.hasChanges)
      .map((e) => `🔄 เปลี่ยนแปลง ${whenLabel(e.eventDate, e.startTime, today)} ${screenTitle(e)} — ตรวจสอบก่อนออกงาน`);
    return [...said, ...canceled, ...changed];
  }, [events, notes, today]);

  const link = (e: MonitorEvent) => (linkable ? openProps(e.id, e.title) : {});
  const personIdOf = (p: MonitorAssignee) => p.personId ?? team.ids[p.name];

  const face = (p: MonitorAssignee, k: number, size: number, cls = "") => {
    const id = personIdOf(p);
    if (id && team.off.has(id)) {
      return (
        <span key={`${p.name}-${k}`} className={`bm-face bm-face--name ${ackClass(p)} ${cls}`} title={p.name}>
          {shortName(p.name).slice(0, 2)}
        </span>
      );
    }
    return <Avatar key={`${p.name}-${k}`} personId={id} name={p.name} size={size} eager className={`bm-face ${ackClass(p)} ${cls}`} />;
  };

  const todayCount = board?.todayJobs.length ?? 0;

  return (
    <div className={`hm bm bm--${theme}${staticMode ? " hm--still" : ""}`}>
      <header className="hm-head bm-head">
        <span className="bm-seal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seal-2569.png" alt="ตราเทศบาลนครนครสวรรค์" />
        </span>
        <div>
          <h1>เทศบาลนครนครสวรรค์</h1>
          <p>ตารางงานฝ่ายบริการและเผยแพร่วิชาการ</p>
        </div>
        <div className="hm-clock bm-clock">
          <b>{clock ? `${clock.hh}.${clock.mm}` : "--.--"}<small> น.</small></b>
          <span>{today ? thaiLongDate(today) : ""}</span>
        </div>
      </header>

      <main className="bm-main">
        <div className="bm-stats">
          <div className="bm-st"><b>{board?.stats.today ?? 0}</b><span>งานวันนี้</span></div>
          <div className={`bm-st${(board?.stats.pending ?? 0) > 0 ? " is-warn" : " is-ok"}`}><b>{board?.stats.pending ?? 0}</b><span>ยังไม่รับงาน</span></div>
          <div className="bm-st"><b>{board?.stats.week ?? 0}</b><span>7 วันข้างหน้า</span></div>
        </div>

        <section className={`bm-today${todayCount === 1 ? " is-one" : ""}${todayCount >= 3 ? " is-many" : ""}${todayCount >= 5 ? " is-lots" : ""}`}>
          <span className="bm-chip">{today ? thaiLongDate(today).replace(/^วัน\S+ที่ /, "วันที่ ") : ""}</span>
          {todayCount === 0 ? (
            <p className="bm-empty">{(board?.stats.today ?? 0) > 0 ? "งานวันนี้เสร็จครบแล้ว 👍" : "วันนี้ไม่มีงานตามแผน"}</p>
          ) : (
            <div className="bm-today-list">
              {board!.todayJobs.map((e) => {
                const t = screenTitle(e);
                return (
                  <article className="bm-job" key={e.id} {...link(e)}>
                    <div className="bm-job-info">
                      <div className="bm-job-time">{thaiTime(e.startTime, e.endTime)}</div>
                      <h2 className={`bm-job-title ${titleSize(t)}`}>{t}</h2>
                      <p className="bm-job-place">📍 {e.locationName || "ไม่ระบุสถานที่"}</p>
                    </div>
                    <div className="bm-job-people">
                      {e.assigneeDetail.slice(0, todayCount >= 3 ? 3 : 4).map((p, k) => (
                        <div className="bm-pp" key={`${p.name}-${k}`}>
                          {face(p, k, 64)}
                          <span>
                            <b>{shortName(p.name)}</b> {p.role}
                          </span>
                        </div>
                      ))}
                      {e.assigneeDetail.length > (todayCount >= 3 ? 3 : 4) ? <p className="bm-more">+ อีก {e.assigneeDetail.length - (todayCount >= 3 ? 3 : 4)} คน</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="bm-days">
          {Array.from({ length: 4 }, (_, i) => board?.dayRows[i]).map((d, i) => {
            if (!d) return <div className="bm-day is-blank" key={`blank-${i}`} />;
            const p = dayParts(d.iso);
            const people = d.events.flatMap((e) => e.assigneeDetail);
            const uniq = people.filter((x, k) => people.findIndex((y) => y.name === x.name) === k);
            const one = d.events.length === 1 ? d.events[0] : null;
            return (
              <div className={`bm-day${one ? "" : " is-multi"}`} key={d.iso}>
                <div className="bm-date">
                  <b>{p.d}</b>
                  <span>{p.mon}</span>
                  <i>{p.wd}</i>
                </div>
                <div className="bm-day-body">
                  {one ? (
                    <div {...link(one)}>
                      <div className={`bm-day-title ${titleSize(screenTitle(one))}`}>
                        <em>{thaiTime(one.startTime)}</em> {screenTitle(one)}
                      </div>
                      <p className="bm-day-place">📍 {one.locationName || "ไม่ระบุสถานที่"}</p>
                    </div>
                  ) : (
                    <>
                      {d.events.slice(0, d.events.length > 3 ? 2 : 3).map((e) => (
                        <div className="bm-day-line" key={e.id} {...link(e)}>
                          <em>{thaiTime(e.startTime)}</em> <b>{screenTitle(e)}</b> <span>📍 {e.locationName || "—"}</span>
                        </div>
                      ))}
                      {d.events.length > 3 ? <div className="bm-day-line bm-more">+ อีก {d.events.length - 2} งาน</div> : null}
                    </>
                  )}
                </div>
                <div className={`bm-day-faces${uniq.length > 3 ? " is-two-rows" : ""}`}>
                  {uniq.slice(0, 6).map((x, k) => face(x, k, 52))}
                </div>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="bm-cells">
        {(board?.cells ?? []).map((c) => {
          const p = dayParts(c.iso);
          return (
            <div className={`bm-cell${c.events.length ? " has" : ""}`} key={c.iso}>
              <div className="bm-cell-h">
                <b>{p.d}</b> {p.mon} <i>{p.wd}</i>
              </div>
              {c.events.length === 0 ? <div className="bm-cell-x is-none">ไม่มีงาน</div> : null}
              {c.events.slice(0, 2).map((e) => (
                <div className="bm-cell-x" key={e.id} {...link(e)}>
                  {thaiTime(e.startTime)} {screenTitle(e)}
                </div>
              ))}
              {c.events.length > 2 ? <div className="bm-cell-x bm-more">+ อีก {c.events.length - 2} งาน</div> : null}
            </div>
          );
        })}
      </footer>

      {ticker.length > 0 ? (
        <div className="hm-ticker bm-ticker" aria-label="ประกาศและการเปลี่ยนแปลง">
          <div style={{ animationDuration: `${Math.max(20, ticker.join("").length / 6)}s` }}>
            <span>{ticker.join("   •   ")}   •   </span>
            <span aria-hidden="true">{ticker.join("   •   ")}   •   </span>
          </div>
        </div>
      ) : (
        <div className="hm-ticker hm-ticker--quiet bm-ticker">พิมพ์ &quot;ประกาศ ข้อความ&quot; ในแชทบอท เพื่อขึ้นประกาศที่นี่ · ไม่มีงานเปลี่ยนแปลงหรือยกเลิก</div>
      )}
    </div>
  );
}
