"use client";

// เปิดเช้า / ปิดท้ายวัน (owner, 12 Nov 2026: the TV is on 08:30–16:30 working days and off after).
//   am  ☀️ สวัสดีตอนเช้า — today's jobs, first thing people see (08:00–09:00, every 15 min)
//   pm  🌇 ก่อนกลับบ้าน — tonight's jobs and those until the next working day, because nobody
//       will see the TV again before them (16:00–16:45, every 10 min)
// Full screen, 14 s. Waits for a birthday / welcome / joke-ad show (html[data-tv-show]);
// never on the still screen or with reduced motion.
// /tv?edge=am|pm previews one (every ~20 s, any hour). Not on air until the owner OKs it.

import { useEffect, useRef, useState } from "react";
import type { MonitorEvent } from "@/lib/monitor/types";
import { bangkokNow, thaiLongDate, TH_MONTH_SHORT, TH_WEEKDAY_SHORT, isoParts } from "@/lib/monitor/thai-time";
import { screenTitle, thaiTime } from "@/lib/monitor/board";
import { nickname } from "@/lib/monitor/nicknames";
import { CAST_IDS, castUrl } from "@/lib/monitor/cast";
import { edgeNow, jobsBeforeBack, jobsToday, type Edge } from "@/lib/monitor/tv-hours";
import { ThaiText } from "./ThaiText";

export const DAY_EDGE_LIVE = false;
const SECONDS = 14;
const MAX_ROWS = 4;

const dayChip = (iso: string, today: string) => {
  const p = isoParts(iso);
  const tomorrow = isoParts(today).weekday === (p.weekday + 6) % 7;
  return `${tomorrow ? "พรุ่งนี้ · " : ""}${TH_WEEKDAY_SHORT[p.weekday]} ${p.d} ${TH_MONTH_SHORT[p.m - 1]}`;
};

function Row({ e, chip }: { e: MonitorEvent; chip?: string }) {
  const who = e.assigneeDetail.filter((a) => !a.unavailable).map((a) => nickname(a.personId, a.name));
  return (
    <li>
      <b>{chip ? `${chip} ` : ""}{thaiTime(e.startTime)}</b>
      <span>
        <em><ThaiText text={screenTitle(e)} /></em>
        <small>{[e.locationName ? `📍 ${e.locationName}` : "", who.length ? `👥 ${who.join(" · ")}` : ""].filter(Boolean).join("   ")}</small>
      </span>
    </li>
  );
}

export function TvDayEdge({ events, still, team, off }: { events: MonitorEvent[]; still: boolean; team: string[]; off: Set<string> }) {
  const [show, setShow] = useState<{ edge: Edge; n: number; pv: boolean } | null>(null);
  const [on, setOn] = useState(false);
  const ref = useRef({ n: 0 });

  useEffect(() => {
    if (still) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const q = new URLSearchParams(window.location.search).get("edge");
    const pvEdge: Edge | null = q === "am" || q === "pm" ? q : null;
    if (!pvEdge && !DAY_EDGE_LIVE) return;
    const html = document.documentElement;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, f: () => void) => {
      const t = setTimeout(() => { timers.delete(t); f(); }, ms);
      timers.add(t);
    };
    const next = (sec: number) => later(sec * 1000, run);
    function run() {
      const edge = pvEdge ?? (document.hidden ? null : edgeNow(bangkokNow().minutes));
      if (!edge) return next(120);
      if (html.dataset.tvShow) return next(20);
      html.dataset.tvShow = "1";
      setShow({ edge, n: ref.current.n++, pv: !!pvEdge });
      later(50, () => setOn(true));
      later((SECONDS - 0.8) * 1000, () => setOn(false));
      later(SECONDS * 1000, () => {
        if (html.dataset.tvShow === "1") delete html.dataset.tvShow;
        setShow(null);
        next(pvEdge ? 6 : (edge === "am" ? 15 : 10) * 60 - SECONDS);
      });
    }
    next(pvEdge ? 3 : 40);
    return () => {
      timers.forEach(clearTimeout);
      if (html.dataset.tvShow === "1") delete html.dataset.tvShow;
      setShow(null);
      setOn(false);
    };
  }, [still]);

  if (!show) return null;
  const today = bangkokNow().iso;
  const cast = team.filter((id) => CAST_IDS.includes(id) && !off.has(id));
  const crew = cast.length ? [0, 1, 2].map((k) => cast[(show.n * 3 + k) % cast.length]).filter((v, i, a) => a.indexOf(v) === i) : [];
  const am = show.edge === "am";
  const todayJobs = jobsToday(events, today);
  const back = jobsBeforeBack(events, today);
  const rows = am ? todayJobs : [...back.tonight, ...back.next];
  const more = rows.length - MAX_ROWS;

  return (
    <div className={`tv-edge tv-edge--${show.edge}${on ? " is-on" : ""}`} aria-hidden="true">
      <div className="tv-edge-sky" />
      <div className="tv-edge-head">
        <h2>{am ? "☀️ สวัสดีตอนเช้า" : "🌇 ก่อนกลับบ้าน"}</h2>
        <p>{am ? thaiLongDate(today) : "ทีวีจะปิดแล้ว · เช็กงานถัดไปก่อนกลับนะครับ"}</p>
      </div>
      <div className="tv-edge-body">
        <h3>
          {am
            ? todayJobs.length ? `วันนี้มี ${todayJobs.length} งาน` : "วันนี้ไม่มีงานตามแผน 🌿"
            : rows.length ? `งานก่อนเจอกันอีกที · ${rows.length} งาน` : "ไม่มีงานจนถึงวันทำการถัดไป 🌿"}
        </h3>
        <ul>
          {rows.slice(0, MAX_ROWS).map((e) => (
            <Row key={e.id} e={e} chip={am ? undefined : e.eventDate === today ? "คืนนี้" : dayChip(e.eventDate, today)} />
          ))}
        </ul>
        {more > 0 ? <p className="tv-edge-more">+ อีก {more} งาน · ดูทั้งหมดในบอท พิมพ์ &quot;งานของฉัน&quot;</p> : null}
        {!rows.length ? <p className="tv-edge-more">{am ? "เคลียร์งานค้าง เตรียมงานถัดไปได้เต็มที่ครับ" : "พักผ่อนให้เต็มที่ครับ"}</p> : null}
      </div>
      <div className="tv-edge-crew">
        {crew.map((id, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={castUrl(id, am ? (k === 1 ? "up" : "wave") : "wave")} alt="" style={{ animationDelay: `${k * 0.15}s` }} />
        ))}
      </div>
      <div className="tv-edge-foot">{am ? "ขอให้เป็นวันที่ดีครับ 💪" : "เดินทางกลับปลอดภัยครับ 👋 · อย่าลืมปิดทีวี 📺"}</div>
      {show.pv ? <span className="tv-jad-label">ตัวอย่าง · {am ? "เปิดเช้า" : "ปิดท้ายวัน"}</span> : null}
    </div>
  );
}
