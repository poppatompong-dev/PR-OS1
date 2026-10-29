"use client";

/**
 * TV "แบบแถว" — Kook's layout (29 Oct 2026): every job the same-size row, two
 * columns of four, nearest first; the next job gets a gold frame and a
 * countdown chip instead of a bigger card. The six days ahead and the
 * change/cancel ticker run along the bottom. Three colour themes to try on
 * the office TV: /tv?v=rows&theme=a|b|c (a = ม่วงเข้ม, b = สว่าง, c = กรมท่า-ทอง).
 * Not the default until the team picks one.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { fetchMonitorEvents } from "@/lib/monitor/client";
import type { MonitorAssignee, MonitorEvent } from "@/lib/monitor/types";
import { pickRows, shortName } from "@/lib/monitor/rows";
import {
  TH_MONTH_SHORT,
  TH_WEEKDAY_SHORT,
  addDaysIso,
  bangkokNow,
  isoParts,
  thaiLongDate,
  whenLabel,
} from "@/lib/monitor/thai-time";
import "./monitor-hero.css";
import "./monitor-rows.css";

export type RowsTheme = "a" | "b" | "c";

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

export function RowsMonitor({
  linkable = false,
  staticMode = false,
  theme = "a",
}: {
  linkable?: boolean;
  staticMode?: boolean;
  theme?: RowsTheme;
}) {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
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

  const today = clock?.iso ?? "";
  const now = clock?.minutes ?? 0;
  const live = useMemo(() => events.filter((e) => e.status !== "canceled"), [events]);
  const rows = useMemo(() => (today ? pickRows(events, today, now) : []), [events, today, now]);

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

  return (
    <div className={`hm hmr hmr--${theme}${staticMode ? " hm--still" : ""}`}>
      <header className="hm-head">
        <span className="hm-seal hmr-seal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seal-2569.png" alt="ตราเทศบาลนครนครสวรรค์" />
        </span>
        <div>
          <h1>เทศบาลนครนครสวรรค์</h1>
          <p>ตารางงานฝ่ายบริการและเผยแพร่วิชาการ</p>
        </div>
        <div className="hm-clock">
          <b>{clock ? `${clock.hh}:${clock.mm}` : "--:--"}</b>
          <span>{today ? thaiLongDate(today) : ""}</span>
        </div>
      </header>

      <main className="hmr-list">
        {rows.length === 0 ? (
          <p className="hmr-empty">ยังไม่มีงานใน 7 วันข้างหน้า · งานใหม่จะขึ้นที่นี่ทันทีที่เผยแพร่</p>
        ) : (
          rows.map(({ event: e, day, state, chip }, i) => {
            const p = isoParts(e.eventDate);
            const showRole = e.assigneeDetail.length === 1;
            return (
              <article
                key={e.id}
                className={`hmr-row${state === "next" ? " is-next" : ""}${state === "running" ? " is-run" : ""}`}
                style={{ animationDelay: `${0.05 + i * 0.06}s` }}
                {...link(e)}
              >
                <div className={`hmr-d${day === "today" ? " is-today" : ""}`}>
                  <span>{day === "today" ? "วันนี้" : day === "tomorrow" ? "พรุ่งนี้" : TH_WEEKDAY_SHORT[p.weekday]}</span>
                  <b>{p.d}</b>
                  <span>{TH_MONTH_SHORT[p.m - 1]}</span>
                </div>
                <div className="hmr-b">
                  <div className="hmr-top">
                    <span className="hmr-time">
                      {e.startTime}
                      {e.endTime ? <small> – {e.endTime}</small> : null}
                    </span>
                    {chip ? (
                      <span className={`hmr-chip${state === "running" ? " is-run" : state === "next" ? "" : " is-chg"}`}>{chip}</span>
                    ) : null}
                  </div>
                  <h2 className="hmr-t">{e.title}</h2>
                  <div className="hmr-m">
                    <span className="hmr-p">📍 {e.locationName || "ไม่ระบุสถานที่"}</span>
                    <span className="hmr-pp">
                      {e.assigneeDetail.slice(0, 4).map((a, k) => (
                        <i
                          key={`${a.name}-${k}`}
                          className={ackClass(a)}
                          aria-label={a.ack ? "รับทราบแล้ว" : a.unavailable ? "ไม่สะดวก" : "ยังไม่รับทราบ"}
                        >
                          {shortName(a.name)}
                          {showRole && a.role ? ` · ${a.role}` : ""}
                        </i>
                      ))}
                      {e.assigneeDetail.length > 4 ? <i className="is-more">+{e.assigneeDetail.length - 4}</i> : null}
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </main>

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

      {alerts.length > 0 ? (
        <div className="hm-ticker hmr-ticker" aria-label="การเปลี่ยนแปลง">
          <div style={{ animationDuration: `${Math.max(20, alerts.join("").length / 6)}s` }}>
            <span>{alerts.join("   •   ")}   •   </span>
            <span aria-hidden="true">{alerts.join("   •   ")}   •   </span>
          </div>
        </div>
      ) : (
        <div className="hm-ticker hm-ticker--quiet hmr-ticker">✓ ไม่มีงานเปลี่ยนแปลงหรือยกเลิก</div>
      )}
    </div>
  );
}
