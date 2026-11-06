"use client";

// ธีมต้อนรับคนมาใหม่ (owner + พี่เอิร์ธ, 6 Nov 2026 · "A พรมแดง", ถี่เหมือนวันเกิด):
//   WelcomeBanner — "🎉 ยินดีต้อนรับ" + the position in the header, all day.
//   WelcomeShow  — curtains close, open on a red carpet that rolls out, the team's
//                  cartoons rise on both sides and cheer, gold "ยินดีต้อนรับ" +
//                  position + a warm line. ~14 s (long enough for a photo).
// Three looks (owner picks one): 1 แดง–ทอง · 2 กรมท่า–ทอง + สปอตไลต์ · 3 ดอกไม้.
// Cadence as the birthday: 07:00–19:00, every 10 min in the first hour, then 30;
// never on the still screen or with reduced motion. TvCast waits while it plays.
// /tv?welcome=fast&wv=1|2|3 — preview: a show every ~25 s at any hour.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { BDAY_FIRST_HOUR_EVERY_MIN, BDAY_SHOW_EVERY_MIN } from "@/lib/monitor/birthday";
import { CAST_IDS, castUrl } from "@/lib/monitor/cast";
import type { Welcome } from "@/lib/monitor/welcome";

const PAI = "00000000-0000-0000-0000-000000000501";

const PALETTE: Record<Welcome["variant"], { parts: string[]; kind: "conf" | "star" | "petal" }> = {
  1: { parts: ["#ffd36b", "#ffe9a8", "#ffffff", "#e0a526", "#c8102e"], kind: "conf" },
  2: { parts: ["#ffd36b", "#fff3c4", "#ffffff", "#9fd2ff"], kind: "star" },
  3: { parts: ["#ffb7cf", "#ff8fb8", "#ffe08a", "#ffffff", "#f7c6e0"], kind: "petal" },
};

function bangkokHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
}

/** Header banner, all day. */
export function WelcomeBanner({ welcome, still }: { welcome: Welcome; still: boolean }) {
  return (
    <div className={`bm-wel bm-wel--v${welcome.variant}${still ? "" : " is-live"}`} aria-label={`ยินดีต้อนรับ ${welcome.role}`}>
      <span className="bm-wel-icon" aria-hidden="true">{welcome.variant === 3 ? "💐" : "🎉"}</span>
      <span className="bm-wel-text">
        <b>ยินดีต้อนรับ{welcome.label ? ` · ${welcome.label}` : ""}</b>
        <span>{welcome.role}</span>
      </span>
    </div>
  );
}

/** The red-carpet show. */
export function WelcomeShow({ welcome, still, off, team }: { welcome: Welcome; still: boolean; off: Set<string>; team: string[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const crewIds = team.filter((id) => CAST_IDS.includes(id) && !off.has(id)).sort((a, b) => (a === PAI ? -1 : b === PAI ? 1 : 0)).slice(0, 8);
  const v = welcome.variant;
  const key = `${v}|${crewIds.join(",")}`;

  useEffect(() => {
    const el = stage.current;
    if (!el || still) return;
    const root: HTMLDivElement = el;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const qs = new URLSearchParams(window.location.search);
    const fast = qs.get("welcome") === "fast" || qs.get("wv") === "all";
    const html = document.documentElement;
    const pal = PALETTE[v];

    const canvas = root.querySelector("canvas")!;
    const cx = canvas.getContext("2d")!;
    const dim = root.querySelector<HTMLElement>(".tv-wel-dim")!;
    const back = root.querySelector<HTMLElement>(".tv-wel-back")!;
    const carpet = root.querySelector<HTMLElement>(".tv-wel-carpet")!;
    const curL = root.querySelector<HTMLElement>(".tv-wel-cur.is-l")!;
    const curR = root.querySelector<HTMLElement>(".tv-wel-cur.is-r")!;
    const top = root.querySelector<HTMLElement>(".tv-wel-top")!;
    const words = root.querySelector<HTMLElement>(".tv-wel-words")!;
    const big = root.querySelector<HTMLElement>(".tv-wel-big")!;
    const role = root.querySelector<HTMLElement>(".tv-wel-role")!;
    const warm = root.querySelector<HTMLElement>(".tv-wel-warm")!;
    const crew = root.querySelector<HTMLElement>(".tv-wel-crew")!;
    const u = () => Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    type P = { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number; r: number; tw: number };
    let parts: P[] = [];
    let raf = 0;
    let rain = 0; // particles per frame while > 0
    const pick = () => pal.parts[(Math.random() * pal.parts.length) | 0];
    const drop = (n: number) => {
      for (let i = 0; i < n; i++) {
        const s = u();
        parts.push({
          x: Math.random() * W(),
          y: -20 - Math.random() * 200 * s,
          vx: (Math.random() - 0.5) * 1.6 * s,
          vy: (pal.kind === "petal" ? 1.4 + Math.random() * 1.4 : 2 + Math.random() * 2.6) * s * 1.2,
          life: 1,
          c: pick(),
          s: (pal.kind === "star" ? 3 + Math.random() * 4 : 7 + Math.random() * 5) * s,
          r: Math.random() * 6,
          tw: Math.random() * 6,
        });
      }
    };
    const star = (x: number, y: number, r: number) => {
      cx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rr = i % 2 ? r * 0.35 : r;
        cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      cx.closePath();
      cx.fill();
    };
    const tick = () => {
      cx.clearRect(0, 0, canvas.width, canvas.height);
      if (rain > 0) drop(rain);
      parts = parts.filter((p) => {
        p.x += p.vx + (pal.kind === "petal" ? Math.sin(p.tw) * 0.9 * u() : 0);
        p.y += p.vy;
        p.r += 0.06;
        p.tw += 0.08;
        cx.globalAlpha = pal.kind === "star" ? 0.55 + 0.45 * Math.abs(Math.sin(p.tw)) : 1;
        cx.fillStyle = p.c;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.r);
        if (pal.kind === "conf") cx.fillRect(-p.s / 2, -p.s / 3, p.s, (p.s * 2) / 3);
        else if (pal.kind === "petal") { cx.beginPath(); cx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 7); cx.fill(); }
        else star(0, 0, p.s * 1.6);
        cx.restore();
        return p.y < H() + 40;
      });
      cx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    // Carpet: a trapezoid from the bottom middle to a vanishing point.
    const carpetAt = (y: number) => {
      const yTop = H() * 0.42, yBot = H();
      const t = Math.max(0, Math.min(1, (y - yTop) / (yBot - yTop)));
      return (W() * 0.07 + t * (W() * 0.23 - W() * 0.07)); // half-width
    };

    const start = () => {
      canvas.width = W(); canvas.height = H();
      html.dataset.tvShow = "1";
      root.classList.add("is-on");
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      parts = []; rain = 0;
      cx.clearRect(0, 0, canvas.width, canvas.height);
      crew.replaceChildren();
      root.classList.remove("is-on", "is-lit");
      delete html.dataset.tvShow;
    };

    function show() {
      const s = u();
      const spr = crewIds.map((id, i) => {
        const left = i % 2 === 0;
        const k = Math.floor(i / 2); // 0 = front row
        const y = H() * (0.985 - k * 0.135);
        const sc = 1.3 - k * 0.2;
        const x = W() / 2 + (left ? -1 : 1) * (carpetAt(y) + 95 * s * sc);
        const d = document.createElement("div");
        d.className = "tv-cast-sp";
        d.style.width = `${150 * s * sc}px`;
        d.style.height = `${268 * s * sc}px`;
        d.style.backgroundImage = `url(${castUrl(id, "stand")})`;
        d.style.zIndex = String(10 - k);
        crew.appendChild(d);
        gsap.set(d, { x, y: y + 300 * s, opacity: 0, xPercent: -50, yPercent: -100, scaleX: left ? 1 : -1 });
        return { d, id, y };
      });
      gsap.set([dim, back, carpet, words, big, role, warm], { opacity: 0 });
      gsap.set(curL, { xPercent: -100 });
      gsap.set(curR, { xPercent: 100 });
      gsap.set(top, { yPercent: -100 });
      gsap.set(carpet, { scaleY: 0 });

      const tl = gsap.timeline({ onComplete: stop })
        .to(dim, { opacity: 1, duration: 0.5 }, 0)
        .to(curL, { xPercent: 0, duration: 0.8, ease: "power2.in" }, 0)
        .to(curR, { xPercent: 0, duration: 0.8, ease: "power2.in" }, 0)
        .to(top, { yPercent: 0, duration: 0.6, ease: "power2.out" }, 0.2)
        .set([back, carpet], { opacity: 1 }, 0.85)
        .to(curL, { xPercent: -86, duration: 1.5, ease: "power2.inOut" }, 1.2)
        .to(curR, { xPercent: 86, duration: 1.5, ease: "power2.inOut" }, 1.2)
        .call(() => { if (v === 2) root.classList.add("is-lit"); }, undefined, 1.6)
        .to(carpet, { scaleY: 1, duration: 1.1, ease: "power2.out" }, 1.7);
      spr.forEach(({ d, y }, i) => tl.to(d, { y, opacity: 1, duration: 0.7, ease: "back.out(1.6)" }, 2.3 + i * 0.1));
      tl.set(words, { opacity: 1 }, 3.2)
        .fromTo(big, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.8)" }, 3.2)
        .call(() => { drop(v === 2 ? 60 : 90); rain = v === 2 ? 1 : 2; }, undefined, 3.4)
        .fromTo(role, { opacity: 0, y: 30 * s }, { opacity: 1, y: 0, duration: 0.6 }, 3.8)
        .fromTo(warm, { opacity: 0, y: 30 * s }, { opacity: 1, y: 0, duration: 0.6 }, 4.3);
      // Cheer: arms up / down, the two front ones wave.
      spr.forEach(({ d, id }, i) => {
        const poses = i < 2 ? (["wave", "stand"] as const) : (["up", "stand"] as const);
        for (let b = 0; b < 12; b++) {
          tl.call(() => { d.style.backgroundImage = `url(${castUrl(id, poses[b % 2])})`; }, undefined, 3.4 + b * 0.38 + (i % 3) * 0.06);
        }
        tl.fromTo(d, { y: spr[i].y }, { y: spr[i].y - 18 * s, duration: 0.19, yoyo: true, repeat: 9, ease: "sine.inOut", immediateRender: false }, 4.4 + (i % 3) * 0.06);
      });
      return tl
        .call(() => { rain = 0; }, undefined, 10.5)
        .to([words, carpet, back, top, curL, curR, dim, ...spr.map((x) => x.d)], { opacity: 0, duration: 0.8 }, 12.4)
        .to({}, { duration: 0.3 });
    }

    for (const id of crewIds) for (const pose of ["stand", "up", "wave"] as const) { const im = new Image(); im.src = castUrl(id, pose); }

    let first = 0;
    let call: gsap.core.Tween | null = null;
    let tl: gsap.core.Timeline | null = null;
    const run = () => {
      const h = bangkokHour();
      if (!fast && (document.hidden || h < 7 || h >= 19)) { call = gsap.delayedCall(300, run); return; }
      if (html.dataset.tvShow) { call = gsap.delayedCall(20, run); return; } // a birthday show is on
      start();
      tl = show();
      first ||= Date.now();
      const mins = Date.now() - first < 60 * 60_000 ? BDAY_FIRST_HOUR_EVERY_MIN : BDAY_SHOW_EVERY_MIN;
      call = gsap.delayedCall(fast ? 25 : mins * 60, run);
    };
    call = gsap.delayedCall(fast ? 3 : 40, run);
    return () => {
      call?.kill(); tl?.kill();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, key]);

  return (
    <div className={`tv-wel tv-wel--v${v}`} ref={stage} aria-hidden="true">
      <div className="tv-wel-dim" />
      <div className="tv-wel-back">
        <i className="tv-wel-beam is-a" />
        <i className="tv-wel-beam is-b" />
      </div>
      <div className="tv-wel-carpet" />
      <div className="tv-wel-crew" />
      <canvas />
      <div className="tv-wel-words">
        <div className="tv-wel-big">ยินดีต้อนรับ</div>
        <div className="tv-wel-role">{welcome.role}</div>
        <div className="tv-wel-warm">{welcome.warm}</div>
      </div>
      <div className="tv-wel-cur is-l" />
      <div className="tv-wel-cur is-r" />
      {welcome.label ? <div className="tv-wel-label">{welcome.label}</div> : null}
      <div className="tv-wel-top">{v === 3 ? <span className="tv-wel-garland">🌸🌼🌺🌸🌼🌺🌸🌼🌺🌸🌼🌺🌸🌼🌺🌸</span> : null}</div>
    </div>
  );
}
