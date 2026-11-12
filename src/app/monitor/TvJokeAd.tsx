"use client";

// ช่วงโฆษณามุก (พี่เอิร์ธ via owner, 12 Nov 2026: "แต่ละมุกขึ้นจอคั่นแบบโฆษณา เต็มจอทีวี").
// Every 10 min one approved joke takes the whole screen for 15 s: the question first,
// then the punch line ("มุกประกวดที่ N · จาก <ชื่อ>"; one-liners show at once). Rotates
// through every joke in number order, then starts again. Keeps running after the
// contest closes; jokes sent later show without a number.
// 07:00–19:00 only; skipped while a birthday/welcome show is on (html[data-tv-show]),
// when a job starts within 30 min, on the still screen and with reduced motion.
// Three looks for the team to pick (owner asked for previews first):
//   1 ป้ายโฆษณาทีวี   2 ตัวการ์ตูนเล่าเอง   3 เวทีเกมโชว์
// /tv?jokead=1|2|3 previews a look (an ad every ~22 s, any hour); ?jokead=all cycles them.
// Not on air until a look is chosen: JOKE_AD_LIVE.

import { useEffect, useMemo, useRef, useState } from "react";
import type { MonitorEvent } from "@/lib/monitor/types";
import { CAST_IDS, castUrl } from "@/lib/monitor/cast";
import { avatarUrl } from "@/lib/avatars";
import { ThaiText } from "./ThaiText";

export type JokeAdLook = 1 | 2 | 3;
export const JOKE_AD_LIVE = false;
export const JOKE_AD_LOOK: JokeAdLook = 1;
export const JOKE_AD_EVERY_MIN = 10;
export const JOKE_AD_SECONDS = 15;
const PUNCH_AT = 5.5;
const JOB_GAP_MIN = 30;
export const JOKE_AD_LABELS: Record<JokeAdLook, string> = { 1: "แบบ 1 · ป้ายโฆษณาทีวี", 2: "แบบ 2 · ตัวการ์ตูนเล่าเอง", 3: "แบบ 3 · เวทีเกมโชว์" };

export type AdJoke = { id: string; personId: string; name: string; setup: string; punch: string; at?: string; no?: number };

/** Contest jokes by number first, then later ones by the time they were sent. */
export function adOrder(jokes: AdJoke[]): AdJoke[] {
  return [...jokes].sort((a, b) => (a.no ?? 1e9) - (b.no ?? 1e9) || (a.at ?? "").localeCompare(b.at ?? ""));
}

/** A job (not cancelled) starts within the next 30 min, Bangkok time. */
export function jobSoon(events: Pick<MonitorEvent, "eventDate" | "startTime" | "status">[], nowMs: number, gapMin = JOB_GAP_MIN): boolean {
  return events.some((e) => {
    if (e.status === "canceled" || !e.startTime) return false;
    const at = Date.parse(`${e.eventDate}T${e.startTime.slice(0, 5)}:00+07:00`);
    return Number.isFinite(at) && at >= nowMs && at - nowMs <= gapMin * 60_000;
  });
}

export const adHead = (j: Pick<AdJoke, "no">) => (j.no ? `มุกประกวดที่ ${j.no}` : "มุกจากทีม");
const sizeOf = (t: string) => (t.length <= 24 ? "is-s" : t.length <= 50 ? "is-m" : "is-l");
const clean = (t: string) => t.replace(/^[.…\s=]+/, "").trim();

function bangkokHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
}

function Who({ id, off, pose, className }: { id: string; off: Set<string>; pose: "stand" | "wave" | "up"; className: string }) {
  if (CAST_IDS.includes(id) && !off.has(id)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={castUrl(id, pose)} alt="" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`${className} is-face`} src={avatarUrl(id)} alt="" />;
}

export function TvJokeAd({ jokes, still, events, team, off }: { jokes: AdJoke[]; still: boolean; events: MonitorEvent[]; team: string[]; off: Set<string> }) {
  const [show, setShow] = useState<{ j: AdJoke; look: JokeAdLook; n: number; pv: boolean } | null>(null);
  const [phase, setPhase] = useState(0); // 0 off · 1 question · 2 punch line
  const [left, setLeft] = useState(JOKE_AD_SECONDS);
  const list = useMemo(() => adOrder(jokes.filter((j) => j.punch)), [jokes]);
  const ref = useRef({ list, events, idx: 0, n: 0 });
  ref.current.list = list;
  ref.current.events = events;

  useEffect(() => {
    if (still) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const q = new URLSearchParams(window.location.search).get("jokead");
    const prevLook = q === "1" || q === "2" || q === "3" ? (Number(q) as JokeAdLook) : null;
    const preview = !!prevLook || q === "all";
    if (!preview && !JOKE_AD_LIVE) return;
    const html = document.documentElement;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, f: () => void) => {
      const t = setTimeout(() => { timers.delete(t); f(); }, ms);
      timers.add(t);
    };
    const next = (sec: number) => later(sec * 1000, run);
    function run() {
      const r = ref.current;
      if (!r.list.length) return next(60);
      if (!preview) {
        const h = bangkokHour();
        if (document.hidden || h < 7 || h >= 19) return next(300);
        if (jobSoon(r.events, Date.now())) return next(120);
      }
      if (html.dataset.tvShow) return next(30); // birthday / welcome has the screen
      const j = r.list[r.idx++ % r.list.length];
      const n = r.n++;
      const look: JokeAdLook = prevLook ?? (q === "all" ? (((n % 3) + 1) as JokeAdLook) : JOKE_AD_LOOK);
      html.dataset.tvShow = "1";
      setShow({ j, look, n, pv: preview });
      setLeft(JOKE_AD_SECONDS);
      setPhase(j.setup ? 1 : 2);
      for (let s = 1; s < JOKE_AD_SECONDS; s++) later(s * 1000, () => setLeft(JOKE_AD_SECONDS - s));
      if (j.setup) later(PUNCH_AT * 1000, () => setPhase(2));
      later((JOKE_AD_SECONDS - 0.8) * 1000, () => setPhase(0));
      later(JOKE_AD_SECONDS * 1000, () => {
        if (html.dataset.tvShow === "1") delete html.dataset.tvShow;
        setShow(null);
        next(preview ? 7 : JOKE_AD_EVERY_MIN * 60 - JOKE_AD_SECONDS);
      });
    }
    next(preview ? 3 : 90);
    return () => {
      timers.forEach(clearTimeout);
      if (html.dataset.tvShow === "1") delete html.dataset.tvShow;
      setShow(null);
      setPhase(0);
    };
  }, [still]);

  if (!show) return null;
  const { j, look, n, pv } = show;
  const friends = team.filter((id) => id !== j.personId && CAST_IDS.includes(id) && !off.has(id));
  const pals = friends.length ? [friends[(n * 3) % friends.length], friends[(n * 3 + 1) % friends.length]].filter((v, i, a) => a.indexOf(v) === i) : [];
  const setup = j.setup ? clean(j.setup) : "";
  const punch = clean(j.punch);
  const cls = `tv-jad tv-jad--${look}${phase ? " is-on" : ""}${phase === 2 ? " is-punch" : ""}${setup ? "" : " is-one"}`;

  return (
    <div className={cls} aria-hidden="true">
      {look === 1 ? (
        <>
          <div className="tv-jad-bar">
            <span>📺 ช่วงโฆษณา · มุกจากทีม ปชส.</span>
            <span className="tv-jad-left">กลับเข้าสู่รายการใน {left}</span>
          </div>
          <div className="tv-jad-body">
            <div className="tv-jad-no">{adHead(j)}</div>
            {setup ? <p className={`tv-jad-q ${sizeOf(setup)}`}><ThaiText text={setup} /></p> : null}
            <p className={`tv-jad-a ${sizeOf(punch)}`}><ThaiText text={punch} /></p>
          </div>
          <div className="tv-jad-from">
            <Who id={j.personId} off={off} pose={phase === 2 ? "up" : "wave"} className="tv-jad-me" />
            <span>จาก <b>{j.name}</b></span>
          </div>
          <div className="tv-jad-cta">อยากขึ้นจอบ้าง? พิมพ์ <b>มุก</b> ในแชทบอท Telegram 😆</div>
        </>
      ) : look === 2 ? (
        <>
          <div className="tv-jad-sky" />
          <div className="tv-jad-tag">{adHead(j)} · จาก <b>{j.name}</b></div>
          <div className="tv-jad-teller">
            <div className={`tv-jad-bubble ${sizeOf(phase === 2 ? punch : setup || punch)}${phase === 2 ? " is-punch" : ""}`}>
              <ThaiText text={phase === 2 ? punch : setup || punch} />
            </div>
            <Who id={j.personId} off={off} pose={phase === 2 ? "up" : "wave"} className="tv-jad-me" />
          </div>
          <div className="tv-jad-pals">
            {pals.map((id) => (
              <div key={id} className="tv-jad-pal">
                <span className="tv-jad-ha">555</span>
                <Who id={id} off={off} pose={phase === 2 ? "up" : "stand"} className="tv-jad-palimg" />
              </div>
            ))}
          </div>
          <div className="tv-jad-left2">📺 โฆษณามุก · อีก {left} วิ</div>
        </>
      ) : (
        <>
          <div className="tv-jad-curtain is-l" />
          <div className="tv-jad-curtain is-r" />
          <div className="tv-jad-spot" />
          <div className="tv-jad-sign">
            <i />
            <span>{adHead(j)}</span>
          </div>
          <div className="tv-jad-screen">
            {setup ? <p className={`tv-jad-q ${sizeOf(setup)}`}><ThaiText text={setup} /></p> : null}
            <p className={`tv-jad-a ${sizeOf(punch)}`}><span className="tv-jad-ding">ติ๊ง!</span> <ThaiText text={punch} /></p>
          </div>
          <div className="tv-jad-podium">
            <Who id={j.personId} off={off} pose={phase === 2 ? "up" : "wave"} className="tv-jad-me" />
            <span>{j.name}</span>
          </div>
          <div className="tv-jad-laughs">
            {["555", "😂", "ฮ่า ๆ", "555+", "🤣", "555"].map((t, i) => (
              <span key={i} style={{ left: `${12 + i * 15}%`, animationDelay: `${i * 0.25}s` }}>{t}</span>
            ))}
          </div>
          <div className="tv-jad-left2">🎤 เวทีมุก · อีก {left} วิ</div>
        </>
      )}
      {pv ? <span className="tv-jad-label">{JOKE_AD_LABELS[look]}</span> : null}
    </div>
  );
}
