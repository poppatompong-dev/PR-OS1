"use client";

// Festival decorations behind the TV board (see lib/monitor/festivals.ts).
// A few soft pieces at the edges, depth by size/blur/speed, nothing over the
// text. Still TVs (?still=1) and reduced-motion get the same pieces, frozen.

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { FestivalKey } from "@/lib/monitor/festivals";
import "./monitor-festival.css";

/** Deterministic "random" so the server and the TV draw the same scene. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return (lo: number, hi: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return lo + r * (hi - lo);
  };
}

type V = CSSProperties & Record<`--${string}`, string | number>;
const u = (n: number) => `calc(${n} * var(--u))`;

function Krathong() {
  return (
    <svg viewBox="0 0 120 96" aria-hidden="true">
      <defs>
        <radialGradient id="fx-candle" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fx-petal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe0ee" />
          <stop offset="1" stopColor="#ff8fbf" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="24" r="22" fill="url(#fx-candle)" className="fx-halo" />
      <ellipse cx="60" cy="82" rx="52" ry="9" fill="#2b6e47" />
      <path d="M12 78 Q28 44 42 74 Q50 34 60 70 Q70 34 78 74 Q92 44 108 78Z" fill="url(#fx-petal)" />
      <path d="M26 78 Q40 56 50 76 Q60 50 70 76 Q80 56 94 78Z" fill="#fff4f9" opacity=".9" />
      <rect x="57.5" y="36" width="5" height="26" rx="2" fill="#fff8de" />
      <path className="fx-flame" d="M60 17 Q67 28 60 37 Q53 28 60 17Z" fill="#ffcc4d" />
    </svg>
  );
}

function SkyLantern() {
  return (
    <svg viewBox="0 0 60 78" aria-hidden="true">
      <defs>
        <linearGradient id="fx-lan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf7a" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <path d="M12 6 H48 L55 58 Q30 72 5 58Z" fill="url(#fx-lan)" />
      <ellipse cx="30" cy="57" rx="13" ry="5" fill="#fff3c4" />
    </svg>
  );
}

function RedLantern() {
  return (
    <svg viewBox="0 0 60 120" aria-hidden="true">
      <defs>
        <radialGradient id="fx-red" cx="40%" cy="40%" r="70%">
          <stop offset="0" stopColor="#ff5a4f" />
          <stop offset="1" stopColor="#b3151d" />
        </radialGradient>
      </defs>
      <line x1="30" y1="0" x2="30" y2="24" stroke="#d4a017" strokeWidth="2" />
      <rect x="18" y="22" width="24" height="6" rx="2" fill="#e0b13a" />
      <ellipse cx="30" cy="57" rx="28" ry="31" fill="url(#fx-red)" />
      <path d="M30 26 V88 M16 30 Q8 57 16 84 M44 30 Q52 57 44 84" stroke="#e0b13a" strokeWidth="1.2" fill="none" opacity=".6" />
      <text x="30" y="66" textAnchor="middle" fontSize="24" fontWeight="700" fill="#ffd36b">福</text>
      <rect x="18" y="86" width="24" height="6" rx="2" fill="#e0b13a" />
      <path className="fx-tassel" d="M30 92 V116" stroke="#e0b13a" strokeWidth="3" />
    </svg>
  );
}

function Petal({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <g fill={color}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="20" cy="9" rx="6" ry="10" transform={`rotate(${a} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="4.5" fill="#ffd36b" />
    </svg>
  );
}

function Balloon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 72" aria-hidden="true">
      <ellipse cx="20" cy="20" rx="16" ry="19" fill={color} />
      <ellipse cx="13" cy="12" rx="4" ry="6" fill="#fff" opacity=".45" />
      <path d="M20 39 Q15 52 22 70" stroke="#fff" strokeWidth="1" fill="none" opacity=".5" />
    </svg>
  );
}

function Drop() {
  return (
    <svg viewBox="0 0 30 40" aria-hidden="true">
      <path d="M15 2 Q28 22 15 38 Q2 22 15 2Z" fill="rgba(140,210,255,.7)" />
      <ellipse cx="11" cy="23" rx="3" ry="5" fill="#fff" opacity=".55" />
    </svg>
  );
}

/** Depth: far pieces are small, blurred, slow; near ones larger and sharper. */
function depth(r: (a: number, b: number) => number) {
  const z = r(0, 1);
  return { scale: 0.6 + z * 0.5, blur: (1 - z) * 1.6, speed: 1.4 - z * 0.5, opacity: 0.5 + z * 0.4 };
}

/**
 * Everything happens in the header's empty space (between the title and the
 * stats), so the board itself stays clean — คุณกุ๊ก does not like clutter.
 */
function scene(key: FestivalKey): ReactNode[] {
  const r = seeded(key.length * 7919 + key.charCodeAt(0));
  const out: ReactNode[] = [];
  const piece = (i: number, cls: string, style: V, child: ReactNode) =>
    out.push(
      <div key={`${cls}-${i}`} className={`fx ${cls}`} style={style}>
        {child}
      </div>,
    );

  if (key === "loy") {
    out.push(<div key="moon" className="fx fx-moon" />);
    piece(0, "fx-krathong", {}, <Krathong />);
    piece(1, "fx-krathong fx-reflect", {}, <Krathong />);
    out.push(<div key="water" className="fx fx-water" />);
    for (let i = 0; i < 4; i++) {
      const d = depth(r);
      piece(i, "fx-up fx-sky", { left: `${r(10, 70)}%`, "--d": `${r(16, 24) * d.speed}s`, "--delay": `${-r(0, 24)}s`, "--sway": u(r(-40, 40)), "--s": d.scale, "--o": d.opacity, filter: `blur(${d.blur}px)` }, <SkyLantern />);
    }
  }
  if (key === "cny") {
    piece(0, "fx-hang", { left: "4%", "--delay": "0s" }, <RedLantern />);
    piece(1, "fx-hang", { right: "4%", "--delay": "-1.3s" }, <RedLantern />);
    for (let i = 0; i < 6; i++) piece(i, "fx-twinkle", { left: `${r(10, 90)}%`, top: `${r(10, 80)}%`, "--delay": `${-r(0, 4)}s`, "--d": `${r(2.5, 4.5)}s` }, null);
  }
  if (key === "father" || key === "mother") {
    const colors = key === "father" ? ["#ffd23f", "#ffc300", "#ffe680"] : ["#ffffff", "#eef3ff"];
    for (let i = 0; i < 7; i++) {
      const d = depth(r);
      piece(i, "fx-down", { left: `${r(4, 92)}%`, "--d": `${r(9, 14) * d.speed}s`, "--delay": `${-r(0, 14)}s`, "--sway": u(r(-50, 50)), "--s": d.scale, "--o": d.opacity, filter: `blur(${d.blur * 0.6}px)` }, <Petal color={colors[i % colors.length]} />);
    }
  }
  if (key === "child") {
    const colors = ["#ff6b6b", "#ffd23f", "#4dd6ff", "#9b6bff", "#5ee08a"];
    for (let i = 0; i < 5; i++) {
      const d = depth(r);
      piece(i, "fx-up fx-balloon", { left: `${r(6, 86)}%`, "--d": `${r(12, 18) * d.speed}s`, "--delay": `${-r(0, 18)}s`, "--sway": u(r(-30, 30)), "--s": d.scale, "--o": d.opacity, filter: `blur(${d.blur * 0.5}px)` }, <Balloon color={colors[i % colors.length]} />);
    }
  }
  if (key === "songkran") {
    for (let i = 0; i < 8; i++) {
      const d = depth(r);
      piece(i, "fx-up fx-drop", { left: `${r(4, 92)}%`, "--d": `${r(7, 11) * d.speed}s`, "--delay": `${-r(0, 11)}s`, "--sway": u(r(-25, 25)), "--s": d.scale, "--o": d.opacity, filter: `blur(${d.blur * 0.5}px)` }, <Drop />);
    }
  }
  if (key === "newyear") {
    [
      [30, 36, "#ffd36b", 0],
      [72, 30, "#ff8ad8", 2.2],
      [50, 64, "#7ad7ff", 4.4],
    ].forEach(([x, y, c, delay], i) => {
      const sparks = Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2;
        const dist = 26 + (k % 2) * 10;
        return <i key={k} style={{ "--dx": u(Math.cos(a) * dist), "--dy": u(Math.sin(a) * dist) } as V} />;
      });
      piece(i, "fx-burst", { left: `${x}%`, top: `${y}%`, "--c": String(c), "--delay": `${delay}s` }, sparks);
    });
  }
  return out;
}

/** The decorations, in the header's empty space. */
export function FestivalStage({ festival, still }: { festival: FestivalKey | null; still: boolean }) {
  const [calm, setCalm] = useState(still);
  useEffect(() => {
    if (still || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setCalm(true);
  }, [still]);
  if (!festival) return <div className="bm-fest-stage" />;
  return (
    <div className={`bm-fest-stage fest--${festival}${calm ? " fest--still" : ""}`} aria-hidden="true">
      {scene(festival)}
    </div>
  );
}

/** A soft colour wash over the whole screen (behind everything). */
export function FestivalLayer({ festival }: { festival: FestivalKey | null }) {
  if (!festival) return null;
  return <div className={`fest fx-tint--${festival}`} aria-hidden="true" />;
}
