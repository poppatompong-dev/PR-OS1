"use client";

// กล่อง "วันนี้" ตอนไม่มีงาน (owner, 12 Nov 2026: "วันนี้ไม่มีงาน … ไม่ให้มันโล่ง").
// Three looks for the team to pick on the TV (/tv?idle=1|2|3, ?idle=all cycles):
//   1 ผสม     next job + a big panel taking turns: news photo · joke · team month · requests/dates
//   2 วันพัก   two team cartoons tell the approved contest jokes in speech bubbles
//   3 ผลงาน   the latest news photos, big
// Public data only (the same feeds the TV already reads).

import { useEffect, useState, type ReactNode } from "react";
import type { ShowcaseItem } from "@/lib/monitor/showcase";
import type { BoardRequest } from "./TvShowcase";
import { CAST_IDS, castUrl } from "@/lib/monitor/cast";

export type IdleLook = 1 | 2 | 3;
export const IDLE_DEFAULT_LOOK: IdleLook = 1;
export const IDLE_LABELS: Record<IdleLook, string> = { 1: "แบบ 1 · ผสม", 2: "แบบ 2 · ตัวการ์ตูนวันพัก", 3: "แบบ 3 · ผลงานเต็มกล่อง" };
export type IdleJoke = { personId: string; name: string; setup: string; punch: string };
export type IdleStats = { month?: { jobs: number; slots: number; label: string }; ack?: { rate: number | null; medianMin: number | null } } | null;
export type IdleNext = { when: string; title: string; place: string; inText: string; faces: ReactNode } | null;

const EVERY = 15_000;
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : "";
};
const clean = (t: string) => t.replace(/^[.…\s]+/, "").trim();
const REQ: Record<BoardRequest["status"], string> = { received: "📥 รับแล้ว", doing: "🛠 กำลังทำ", choose: "🎨 รอเลือก", done: "✅ เสร็จ" };

function useTick(n: number, still: boolean, ms = EVERY) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (still || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, still, ms]);
  return n ? i % n : 0;
}

function NextStrip({ next }: { next: IdleNext }) {
  if (!next) return <div className="bm-idle-next"><span>🌿 วันนี้ไม่มีงาน · ยังไม่มีงานข้างหน้า</span></div>;
  return (
    <div className="bm-idle-next">
      <small>🌿 วันนี้ไม่มีงาน · งานถัดไป</small>
      <div className="bm-idle-next-row">
        <b>
          {next.when} <em>{next.title}</em>
        </b>
        <span className="bm-idle-in">⏳ {next.inText}</span>
      </div>
      <div className="bm-idle-next-row">
        <span className="bm-idle-place">📍 {next.place || "ไม่ระบุสถานที่"}</span>
        <span className="bm-idle-faces">{next.faces}</span>
      </div>
    </div>
  );
}

type Slide = { k: "news"; item: ShowcaseItem } | { k: "joke"; joke: IdleJoke } | { k: "stats" } | { k: "dates" };

function MixLook({ news, jokes, stats, requests, dates, still }: { news: ShowcaseItem[]; jokes: IdleJoke[]; stats: IdleStats; requests: BoardRequest[]; dates: string[]; still: boolean }) {
  const slides: Slide[] = [];
  const pool = Math.max(news.length, jokes.length, 1);
  for (let k = 0; k < pool && slides.length < 12; k++) {
    if (news[k]) slides.push({ k: "news", item: news[k] });
    if (jokes[k]) slides.push({ k: "joke", joke: jokes[k] });
    if (k === 0 && stats?.month) slides.push({ k: "stats" });
    if (k === 1 && (requests.length || dates.length)) slides.push({ k: "dates" });
  }
  if (!slides.length) slides.push({ k: "dates" });
  const s = slides[useTick(slides.length, still)];
  return (
    <div className="bm-idle-panel" key={`${s.k}-${slides.indexOf(s)}`}>
      {s.k === "news" ? (
        <div className="bm-idle-news">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.item.image} alt="" className={still ? "" : "is-live"} />
          <div className="bm-idle-cap">
            <small>📘 ผลงานล่าสุด · {thaiDay(s.item.date)}</small>
            <b>{s.item.title}</b>
          </div>
        </div>
      ) : s.k === "joke" ? (
        <div className="bm-idle-joke">
          <small>😂 มุกประกวดจาก {s.joke.name}</small>
          <p className="bm-idle-q">{s.joke.setup || "…"}</p>
          <p className="bm-idle-a">{clean(s.joke.punch)}</p>
        </div>
      ) : s.k === "stats" ? (
        <div className="bm-idle-stats">
          <small>📊 ผลงานทีม {stats?.month?.label ?? "เดือนนี้"}</small>
          <div>
            <span><b>{stats?.month?.jobs ?? 0}</b> งาน</span>
            <span><b>{stats?.month?.slots ?? 0}</b> คน-ครั้ง</span>
            {stats?.ack?.rate != null ? <span><b>{stats.ack.rate}%</b> รับทราบ</span> : null}
          </div>
          <p>ขอบคุณทุกคนที่ช่วยกันครับ 🙏</p>
        </div>
      ) : (
        <div className="bm-idle-dates">
          {dates.length ? (
            <>
              <small>📅 วันสำคัญถัดไป</small>
              {dates.map((d) => <p key={d}>{d}</p>)}
            </>
          ) : null}
          {requests.length ? (
            <>
              <small>🛠 คำขอจากทีม</small>
              {requests.slice(0, 3).map((r) => (
                <p key={r.id}>
                  {r.name} · {r.topic} <i>{REQ[r.status]}</i>
                </p>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

const TIPS: IdleJoke[] = [
  { personId: "", name: "", setup: "วันนี้ว่าง ทำอะไรดี?", punch: "เคลียร์ไฟล์รูป ตั้งชื่องานไว้ก่อน หาง่ายตอนส่งข่าว 📁" },
  { personId: "", name: "", setup: "งานพรุ่งนี้ใครไปบ้าง?", punch: 'พิมพ์ถามบอท "งานพรุ่งนี้" ใน Telegram ได้เลย ✈️' },
];

function RestLook({ jokes, still }: { jokes: IdleJoke[]; still: boolean }) {
  const list = jokes.length ? jokes : TIPS;
  const i = useTick(list.length, still, 16_000);
  const j = list[i];
  const [showPunch, setShowPunch] = useState(still);
  useEffect(() => {
    if (still) return;
    setShowPunch(false);
    const t = setTimeout(() => setShowPunch(true), 5_000);
    return () => clearTimeout(t);
  }, [i, still]);
  const teller = CAST_IDS.includes(j.personId) ? j.personId : CAST_IDS[(i * 3) % CAST_IDS.length];
  const buddy = CAST_IDS.filter((x) => x !== teller)[(i * 5 + 1) % (CAST_IDS.length - 1)];
  return (
    <div className="bm-idle-rest" key={i}>
      <small className="bm-idle-rest-head">☕ วันนี้ไม่มีงาน · พักเติมพลัง{j.name ? ` · มุกจาก ${j.name}` : ""}</small>
      <div className="bm-idle-stage">
        <div className="bm-idle-actor is-left">
          <div className="bm-idle-bubble">{j.setup || "…"}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={castUrl(teller, "wave")} alt="" />
        </div>
        <div className="bm-idle-actor is-right">
          <div className={`bm-idle-bubble is-punch${showPunch ? " is-on" : ""}`}>{clean(j.punch)}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={castUrl(buddy, showPunch ? "up" : "stand")} alt="" />
        </div>
      </div>
    </div>
  );
}

function ShowLook({ news, still }: { news: ShowcaseItem[]; still: boolean }) {
  const i = useTick(news.length, still, 12_000);
  if (!news.length) return <p className="bm-empty">วันนี้ไม่มีงานตามแผน</p>;
  const it = news[i];
  return (
    <div className="bm-idle-panel bm-idle-show" key={i}>
      <div className="bm-idle-news">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={it.image} alt="" className={still ? "" : "is-live"} />
        <div className="bm-idle-cap">
          <small>📘 ผลงานล่าสุด · {thaiDay(it.date)}</small>
          <b>{it.title}</b>
        </div>
      </div>
      <div className="bm-sc-dots" aria-hidden="true">
        {news.map((_, k) => <i key={k} className={k === i ? "is-on" : ""} />)}
      </div>
    </div>
  );
}

export function TvIdle(props: {
  look: IdleLook;
  label?: string;
  next: IdleNext;
  news: ShowcaseItem[];
  jokes: IdleJoke[];
  stats: IdleStats;
  requests: BoardRequest[];
  dates: string[];
  still: boolean;
}) {
  const { look, label, next, news, jokes, stats, requests, dates, still } = props;
  return (
    <div className={`bm-idle bm-idle--${look}`}>
      {look === 1 ? <NextStrip next={next} /> : null}
      {look === 1 ? <MixLook news={news} jokes={jokes} stats={stats} requests={requests} dates={dates} still={still} /> : null}
      {look === 2 ? <RestLook jokes={jokes} still={still} /> : null}
      {look === 3 ? <ShowLook news={news} still={still} /> : null}
      {look !== 1 && next ? (
        <p className="bm-idle-line">
          🌿 วันนี้ไม่มีงาน · ถัดไป <b>{next.when}</b> {next.title} · ⏳ {next.inText}
        </p>
      ) : null}
      {label ? <span className="bm-idle-label">{label}</span> : null}
    </div>
  );
}

/** "อีก 22 ชม." / "อีก 3 วัน" / "เร็ว ๆ นี้" until a job's start (Bangkok time). */
export function untilText(iso: string, time: string, nowMs: number): string {
  const at = Date.parse(`${iso}T${(time || "00:00").slice(0, 5)}:00+07:00`);
  const h = (at - nowMs) / 3_600_000;
  if (!Number.isFinite(h) || h <= 0) return "เร็ว ๆ นี้";
  if (h < 1) return `อีก ${Math.max(1, Math.round(h * 60))} นาที`;
  if (h < 24) return `อีก ${Math.round(h)} ชม.`;
  const days = Math.round((Date.parse(`${iso}T00:00:00+07:00`) - Date.parse(`${new Date(nowMs + 7 * 3_600_000).toISOString().slice(0, 10)}T00:00:00+07:00`)) / 86_400_000);
  return days <= 1 ? "พรุ่งนี้" : `อีก ${days} วัน`;
}
