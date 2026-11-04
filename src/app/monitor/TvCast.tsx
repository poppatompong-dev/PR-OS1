"use client";

// ตัวการ์ตูนเต็มตัวป่วนจอ (owner, 3–4 Nov 2026 · แบบ M สติกเกอร์ไดคัท):
// หน้า = รูปการ์ตูนของแต่ละคน (ตัดพื้นหลัง) + ตัวที่ปั้นใน Blender, 8 ท่า ต่อคน
// (public/cast/<personId>/<pose>.webp). ทีละ 1 ท่า ทีละคน (หมุนครบทุกคนก่อนวนซ้ำ)
// แล้วจอนิ่งนาน ๆ — "ไม่ต้องถี่เกินไป". คนที่เลือก "ไม่ใช้รูป" ไม่ออกมา.
// Only 07:00–19:00, never on the still screen or with reduced motion.
// Positions come from the live layout (ticker, cards, stats capsule), so it
// follows whatever the board looks like today.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CAST_IDS, CAST_POSES, castUrl, type CastPose } from "@/lib/monitor/cast";
import { EARTH_ID, GAG_COUNT, GAG_HOME_TIME, playGag, preloadGags } from "./tv-gags";

// แก็กพี่เอิร์ธ × ป้าจิตร: one after every 4 ordinary antics (owner, 4 Nov 2026).
const GAG_EVERY = 4;
const GAG_WITH_TEAM = 7; // น้องชวนไปต่อ — needs กุ๊ก แป้ง นัท on screen
const TEAM_FOR_GAG = ["00000000-0000-0000-0000-000000000503", "00000000-0000-0000-0000-000000000505", "00000000-0000-0000-0000-000000000504"];

const GAP_S: [number, number] = [45, 90];

type Sprite = { el: HTMLDivElement; id: string; set: (p: CastPose) => void; cycle: (a: CastPose, b: CastPose, s: number) => void; stop: (p?: CastPose) => void };

function bangkokHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
}

export function TvCast({ still, people, off }: { still: boolean; people: string[]; off: Set<string> }) {
  const stage = useRef<HTMLDivElement>(null);
  const cast = people.filter((id) => CAST_IDS.includes(id) && !off.has(id));
  const key = cast.join(",");

  useEffect(() => {
    const root = stage.current;
    if (!root || still || !cast.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // /tv?cast=fast — preview: one antic every few seconds, any hour.
    const fast = new URLSearchParams(window.location.search).get("cast") === "fast";
    const gap: [number, number] = fast ? [2, 3] : GAP_S;
    let alive = true;
    let bag: string[] = [];
    const timers = new Set<ReturnType<typeof setInterval>>();
    // Fair turns: everyone once (shuffled) before anyone comes out again.
    const nextId = (not?: string) => {
      if (!bag.length) bag = [...cast].sort(() => Math.random() - 0.5);
      let i = bag.findIndex((x) => x !== not);
      if (i < 0) i = 0;
      return bag.splice(i, 1)[0];
    };
    const preload = (id: string) => Promise.all(CAST_POSES.map((p) => new Promise<void>((ok) => { const im = new Image(); im.onload = im.onerror = () => ok(); im.src = castUrl(id, p); })));
    const u = () => Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;

    function make(id: string, parent: HTMLElement = root!): Sprite {
      const el = document.createElement("div");
      el.className = "tv-cast-sp";
      el.style.width = `${110 * u()}px`;
      el.style.height = `${196 * u()}px`;
      parent.appendChild(el);
      gsap.set(el, { xPercent: -50, yPercent: -100 });
      let iv: ReturnType<typeof setInterval> | null = null;
      const s: Sprite = {
        el, id,
        set: (p) => { el.style.backgroundImage = `url(${castUrl(id, p)})`; },
        cycle: (a, b, sec) => { let k = 0; s.set(a); if (iv) clearInterval(iv); iv = setInterval(() => { k ^= 1; s.set(k ? b : a); }, sec * 1000); timers.add(iv); },
        stop: (p) => { if (iv) { clearInterval(iv); timers.delete(iv); iv = null; } if (p) s.set(p); },
      };
      s.set("stand");
      return s;
    }
    const done = (...ss: Sprite[]) => () => ss.forEach((s) => { s.stop(); s.el.remove(); });
    const W = () => window.innerWidth;
    const floorY = () => box(".bm-ticker")?.top ?? window.innerHeight - 60 * u();

    function walkTicker() {
      const c = make(nextId()); const y = floorY(); const dir = Math.random() < 0.5 ? 1 : -1;
      const x0 = dir > 0 ? -80 : W() + 80, x1 = dir > 0 ? W() + 80 : -80, mid = W() * (0.25 + Math.random() * 0.5);
      const v = 190 * u();
      gsap.set(c.el, { x: x0, y, scaleX: dir });
      return gsap.timeline({ onComplete: done(c) })
        .call(() => c.cycle("walkA", "walkB", 0.2)).to(c.el, { x: mid, duration: Math.abs(mid - x0) / v, ease: "none" })
        .call(() => c.stop("wave")).to(c.el, { rotation: -5, duration: 0.25, yoyo: true, repeat: 5, transformOrigin: "50% 100%" })
        .call(() => c.cycle("walkA", "walkB", 0.2)).to(c.el, { x: x1, rotation: 0, duration: Math.abs(x1 - mid) / v, ease: "none" });
    }
    function runAcross() {
      const c = make(nextId()); const y = floorY(); const dir = Math.random() < 0.5 ? 1 : -1; const d = 2.8;
      gsap.set(c.el, { x: dir > 0 ? -80 : W() + 80, y, scaleX: dir, rotation: dir * 6 });
      return gsap.timeline({ onComplete: done(c) })
        .call(() => c.cycle("runA", "runB", 0.11)).to(c.el, { x: dir > 0 ? W() + 80 : -80, duration: d, ease: "power1.inOut" }, 0)
        .to(c.el, { y: y - 8 * u(), duration: 0.11, yoyo: true, repeat: Math.round(d / 0.11), ease: "sine.inOut" }, 0);
    }
    function peekCard() {
      const cards = Array.from(document.querySelectorAll(".bm-day")).map((e) => e.getBoundingClientRect()).filter((r) => r.height > 40);
      const r = cards.length ? cards[Math.floor(Math.random() * cards.length)] : box(".bm-today");
      if (!r) return walkTicker();
      const x = r.left + r.width * (0.35 + Math.random() * 0.3), top = r.top, h = 200 * u();
      const m = document.createElement("div"); m.className = "tv-cast-mask";
      Object.assign(m.style, { left: `${x - 80 * u()}px`, top: `${top - h}px`, width: `${160 * u()}px`, height: `${h}px` });
      root!.appendChild(m);
      const c = make(nextId(), m); gsap.set(c.el, { x: 80 * u(), y: h * 2 });
      return gsap.timeline({ onComplete: () => { c.stop(); m.remove(); } })
        .to(c.el, { y: h + 95 * u(), duration: 0.45, ease: "back.out(2)" })
        .to(c.el, { rotation: -10, duration: 0.35, transformOrigin: "50% 100%" }).to(c.el, { rotation: 10, duration: 0.5 }).to(c.el, { rotation: 0, duration: 0.25 })
        .call(() => c.set("wave")).to(c.el, { y: h + 70 * u(), duration: 0.25 }).to(c.el, { rotation: -4, duration: 0.2, yoyo: true, repeat: 3 })
        .call(() => c.set("stand")).to(c.el, { y: h * 2 + 10, duration: 0.3, ease: "power2.in" });
    }
    function climbCard() {
      const t = box(".bm-today"); if (!t) return walkTicker();
      const c = make(nextId()); const x = t.right + 12 * u(), yb = t.bottom, yt = t.top;
      gsap.set(c.el, { x: -80, y: yb });
      return gsap.timeline({ onComplete: done(c) })
        .call(() => c.cycle("runA", "runB", 0.12)).to(c.el, { x, duration: Math.abs(x + 80) / (520 * u()), ease: "none" })
        .call(() => c.stop("up")).to(c.el, { y: yt + 60 * u(), duration: 2.6, ease: "none" }, "up")
        .to(c.el, { scaleX: -1, duration: 0.01, yoyo: true, repeat: 9, repeatDelay: 0.25 }, "up")
        .to(c.el, { y: yt + 10 * u(), scaleX: 1, duration: 0.3 }).call(() => c.set("sit"))
        .to(c.el, { rotation: 4, duration: 0.4, yoyo: true, repeat: 4, transformOrigin: "50% 100%" })
        .call(() => c.set("wave")).to({}, { duration: 0.8 }).call(() => c.set("up"))
        .to(c.el, { y: yt - 60 * u(), duration: 0.3, ease: "power2.out" }).to(c.el, { y: yb, duration: 0.7, ease: "bounce.out" })
        .call(() => c.cycle("runA", "runB", 0.11)).to(c.el, { x: -80, scaleX: -1, duration: 1.4, ease: "power1.in" });
    }
    function hang() {
      const p = box(".bm-pulse"), t = box(".bm-today"); if (!p || !t) return walkTicker();
      const c = make(nextId()); c.set("up");
      const x = t.right + 12 * u(), y = p.bottom;
      gsap.set(c.el, { x, y: y - 250 * u(), yPercent: 0 });
      return gsap.timeline({ onComplete: done(c) })
        .to(c.el, { y: y - 28 * u(), duration: 0.5, ease: "back.out(1.5)" })
        .to(c.el, { rotation: 12, duration: 0.5, yoyo: true, repeat: 5, ease: "sine.inOut", transformOrigin: "50% 5%" })
        .to(c.el, { y: window.innerHeight + 300, duration: 0.9, ease: "power2.in" });
    }
    // เดินคู่กัน (เดิมขี่หลัง — owner 4 Nov 2026: ดูเหมือนวิ่งซ้อนกัน): side by side, a gap
    // between them, the one behind waves now and then.
    function pair() {
      if (cast.length < 2) return walkTicker();
      const a = make(nextId()); const b = make(nextId(a.id)); const y = floorY(); const dir = Math.random() < 0.5 ? 1 : -1;
      const gapX = 130 * u();
      const x0 = dir > 0 ? -80 : W() + 80, x1 = dir > 0 ? W() + 80 + gapX : -80 - gapX, d = (W() + gapX) / (190 * u());
      gsap.set(a.el, { x: x0, y, scaleX: dir }); gsap.set(b.el, { x: x0 - dir * gapX, y, scaleX: dir });
      return gsap.timeline({ onComplete: done(a, b) })
        .call(() => { a.cycle("walkA", "walkB", 0.22); b.cycle("walkB", "walkA", 0.22); })
        .to([a.el, b.el], { x: `+=${dir * (Math.abs(x1 - x0))}`, duration: d, ease: "none" }, 0)
        .call(() => b.stop("wave"), undefined, d * 0.3).call(() => b.cycle("walkB", "walkA", 0.22), undefined, d * 0.42)
        .call(() => a.stop("wave"), undefined, d * 0.6).call(() => a.cycle("walkA", "walkB", 0.22), undefined, d * 0.72);
    }

    const ACTS = [walkTicker, runAcross, peekCard, climbCard, hang, pair];
    // /tv?jit=fast — preview: a gag every time, any hour.
    const jitFast = new URLSearchParams(window.location.search).get("jit") === "fast";
    const gagsOn = cast.includes(EARTH_ID); // พี่เอิร์ธ chose "no cartoon" → no gags
    if (gagsOn) preloadGags();
    let ordinary = 0;
    let gagBag: number[] = [];
    let gag: { kill: () => void } | null = null;
    const nextGag = (): number | null => {
      const late = bangkokHour() >= 16;
      const team = TEAM_FOR_GAG.every((id) => cast.includes(id));
      const ok = (g: number) => (g !== GAG_HOME_TIME || late || jitFast) && (g !== GAG_WITH_TEAM || team);
      if (!gagBag.some(ok)) gagBag = Array.from({ length: GAG_COUNT }, (_, i) => i).sort(() => Math.random() - 0.5);
      const i = gagBag.findIndex(ok);
      return i < 0 ? null : gagBag.splice(i, 1)[0];
    };
    let last: (typeof ACTS)[number] | null = null;
    let call: gsap.core.Tween | null = null;
    let tl: gsap.core.Timeline | null = null;
    const schedule = (sec: number) => { call = gsap.delayedCall(sec, run); };
    async function run() {
      if (!alive) return;
      const h = bangkokHour();
      if (!fast && !jitFast && (document.hidden || h < 7 || h >= 19)) return schedule(300);
      // A birthday show is on (TvBirthday) — let it have the screen.
      if (document.documentElement.dataset.tvShow) return schedule(30);
      if (gagsOn && (jitFast || ordinary >= GAG_EVERY)) {
        const g = nextGag();
        if (g !== null) {
          ordinary = 0;
          const s = u();
          gag = playGag(g, root!, floorY() / s, s, () => { gag = null; schedule(jitFast ? 3 : gap[0] + Math.random() * (gap[1] - gap[0])); });
          return;
        }
      }
      ordinary += 1;
      let f = ACTS[Math.floor(Math.random() * ACTS.length)];
      while (f === last) f = ACTS[Math.floor(Math.random() * ACTS.length)];
      last = f;
      if (bag.length < 2) bag = [...bag, ...[...cast].sort(() => Math.random() - 0.5)];
      await Promise.all(bag.slice(0, 2).map(preload));
      if (!alive) return;
      tl = f();
      const cb = tl.eventCallback("onComplete");
      tl.eventCallback("onComplete", () => { cb?.(); schedule(gap[0] + Math.random() * (gap[1] - gap[0])); });
    }
    schedule(fast || jitFast ? 1 : 20);
    return () => {
      alive = false;
      call?.kill(); tl?.kill(); gag?.kill();
      timers.forEach(clearInterval);
      root.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, key]);

  return <div className="tv-cast" ref={stage} aria-hidden="true" />;
}
