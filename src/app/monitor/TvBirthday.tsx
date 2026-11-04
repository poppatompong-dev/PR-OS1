"use client";

// อวยพรวันเกิด (owner + กุ๊ก, 4 Nov 2026 · "B + A + C ผสม", โชว์ใหญ่ทุก 30 นาที):
//   B  BirthdayBanner — face + "HBD ชื่อ!" in the header, all day.
//   A  fireworks, dim, big face, Happy Birthday + the wish from the job's note.
//   C  the birthday person's cartoon pops up, friends walk in and bounce,
//      fireworks + confetti + big text. Needs their sprites; else A plays.
// Big shows alternate A → C, 07:00–19:00, ~11 s each; never on the still
// screen or with reduced motion. TvCast waits while a show is on.
// /tv?bday=fast — preview: a show every ~25 s at any hour.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { avatarUrl } from "@/lib/avatars";
import { BDAY_SHOW_EVERY_MIN, type Birthday } from "@/lib/monitor/birthday";
import { CAST_IDS, castUrl } from "@/lib/monitor/cast";

const COLS = ["#ffd36b", "#ff6fb5", "#9fd2ff", "#b98cff", "#7dff9a", "#ffffff"];

function bangkokHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
}

function FaceDisc({ p, off, className }: { p: Birthday["people"][number]; off: Set<string>; className: string }) {
  if (p.personId && off.has(p.personId)) return <span className={`${className} is-name`}>{p.short.slice(0, 2)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={avatarUrl(p.personId)} alt={p.short} />;
}

/** B — sits in the header all day. */
export function BirthdayBanner({ bday, off, still }: { bday: Birthday; off: Set<string>; still: boolean }) {
  return (
    <div className={`bm-bday${still ? "" : " is-live"}`} aria-label={`สุขสันต์วันเกิด ${bday.names}`}>
      <span className="bm-bday-faces">
        {bday.people.map((p) => (
          <FaceDisc key={p.personId ?? p.name} p={p} off={off} className="bm-bday-face" />
        ))}
      </span>
      <span className="bm-bday-text">
        <b>🎂 HBD {bday.names}!</b>
        <span>สุขสันต์วันเกิดนะ 🎉</span>
      </span>
    </div>
  );
}

/** A + C — the big show, every 30 minutes. */
export function BirthdayShow({ bday, still, off, team }: { bday: Birthday; still: boolean; off: Set<string>; team: string[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const star = bday.people.find((p) => p.personId && CAST_IDS.includes(p.personId) && !off.has(p.personId))?.personId ?? null;
  const friends = team.filter((id) => CAST_IDS.includes(id) && !off.has(id) && !bday.people.some((p) => p.personId === id)).slice(0, 7);
  const key = `${bday.names}|${star}|${friends.join(",")}`;

  useEffect(() => {
    const root = stage.current;
    if (!root || still) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const fast = new URLSearchParams(window.location.search).get("bday") === "fast";
    const html = document.documentElement;

    const canvas = root.querySelector("canvas")!;
    const cx = canvas.getContext("2d")!;
    const dim = root.querySelector<HTMLElement>(".tv-bday-dim")!;
    const card = root.querySelector<HTMLElement>(".tv-bday-card")!;
    const big = root.querySelector<HTMLElement>(".tv-bday-big")!;
    const crew = root.querySelector<HTMLElement>(".tv-bday-crew")!;
    const u = () => Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    type P = { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number; conf?: boolean; r?: number };
    type R = { x: number; y: number; ty: number; vy: number; c: string };
    let parts: P[] = [];
    let rockets: R[] = [];
    let raf = 0;
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, f: () => void) => {
      const t = setTimeout(() => { timeouts.delete(t); f(); }, ms);
      timeouts.add(t);
    };
    const pick = () => COLS[(Math.random() * COLS.length) | 0];
    const rocket = (x: number, y: number) => rockets.push({ x, y: H(), ty: y, vy: -(14 + Math.random() * 4) * u() * 1.2, c: pick() });
    const volley = (n: number, gapMs: number) => {
      for (let i = 0; i < n; i++) later(i * gapMs, () => rocket(W() * (0.12 + Math.random() * 0.76), H() * (0.12 + Math.random() * 0.3)));
    };
    const boom = (x: number, y: number, c: string) => {
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2, v = (Math.random() * 7 + 1) * u() * 1.2;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: Math.random() < 0.3 ? "#fff" : c, s: (2 + Math.random() * 2.5) * u() * 1.3 });
      }
    };
    const confetti = (n = 140) => {
      for (let i = 0; i < n; i++) {
        parts.push({ x: Math.random() * W(), y: -20 - Math.random() * 300 * u(), vx: (Math.random() - 0.5) * 2 * u(), vy: (2 + Math.random() * 3) * u() * 1.3, life: 2.4, c: pick(), s: 6 * u(), conf: true, r: Math.random() * 6 });
      }
    };
    const tick = () => {
      // fade instead of clear: fireworks leave short trails
      cx.globalCompositeOperation = "destination-out";
      cx.fillStyle = "rgba(0,0,0,.28)";
      cx.fillRect(0, 0, canvas.width, canvas.height);
      cx.globalCompositeOperation = "source-over";
      rockets = rockets.filter((r) => {
        r.y += r.vy;
        cx.fillStyle = r.c;
        cx.fillRect(r.x - 2, r.y, 4, 12 * u());
        if (r.y <= r.ty) { boom(r.x, r.y, r.c); return false; }
        return true;
      });
      parts = parts.filter((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.conf) { p.r! += 0.1; p.life -= 0.006; } else { p.vy += 0.08 * u(); p.vx *= 0.985; p.life -= 0.013; }
        cx.globalAlpha = Math.max(0, Math.min(1, p.life));
        cx.fillStyle = p.c;
        if (p.conf) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r!); cx.fillRect(-5 * u(), -3 * u(), 10 * u(), 6 * u()); cx.restore(); }
        else { cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 7); cx.fill(); }
        return p.life > 0 && p.y < H() + 40;
      });
      cx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
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
      parts = []; rockets = [];
      cx.clearRect(0, 0, canvas.width, canvas.height);
      crew.replaceChildren();
      root.classList.remove("is-on");
      delete html.dataset.tvShow;
    };

    function showA() {
      gsap.set([dim, card], { opacity: 0 });
      return gsap.timeline({ onComplete: stop })
        .to(dim, { opacity: 1, duration: 0.6 })
        .call(() => volley(6, 350))
        .fromTo(card, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.9, ease: "back.out(1.7)" }, "+=.6")
        .call(() => { confetti(); volley(8, 500); })
        .to(card.querySelectorAll(".tv-bday-face"), { rotation: 6, duration: 0.5, yoyo: true, repeat: 5, ease: "sine.inOut" })
        .to({}, { duration: 2 })
        .to([card, dim], { opacity: 0, duration: 0.8 });
    }

    function showC() {
      if (!star) return showA();
      const s = u();
      const mk = (id: string, pose: "stand" | "wave" | "walkA", x: number) => {
        const d = document.createElement("div");
        d.className = "tv-cast-sp";
        d.style.width = `${150 * s}px`;
        d.style.height = `${268 * s}px`;
        d.style.backgroundImage = `url(${castUrl(id, pose)})`;
        crew.appendChild(d);
        gsap.set(d, { x, y: H() - 80 * s, xPercent: -50, yPercent: -100 });
        return d;
      };
      const me = mk(star, "stand", W() / 2);
      gsap.set(me, { y: H() + 300 * s });
      const fr = friends.map((id, i) => {
        const left = i < Math.ceil(friends.length / 2);
        const d = mk(id, "walkA", left ? -120 * s : W() + 120 * s);
        if (!left) gsap.set(d, { scaleX: -1 });
        return d;
      });
      const nl = Math.ceil(friends.length / 2);
      gsap.set([dim, big], { opacity: 0 });
      const tl = gsap.timeline({ onComplete: stop })
        .to(dim, { opacity: 0.6, duration: 0.5 })
        .to(me, { y: H() - 180 * s, duration: 0.8, ease: "back.out(1.5)" });
      fr.forEach((d, i) => {
        const left = i < nl;
        const k = left ? i : i - nl;
        const tx = left ? W() / 2 - (230 + k * 135) * s : W() / 2 + (230 + k * 135) * s;
        const id = friends[i];
        tl.call(() => { d.style.backgroundImage = `url(${castUrl(id, "walkA")})`; }, undefined, 1.2 + i * 0.12)
          .to(d, { x: tx, duration: 1.4, ease: "power1.out" }, 1.2 + i * 0.12)
          .call(() => { d.style.backgroundImage = `url(${castUrl(id, "wave")})`; }, undefined, 2.7 + i * 0.12);
      });
      return tl
        .call(() => { me.style.backgroundImage = `url(${castUrl(star, "wave")})`; confetti(120); volley(6, 300); }, undefined, "+=.2")
        .fromTo(big, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(2)" })
        .to(fr, { y: `-=${40 * s}`, duration: 0.25, yoyo: true, repeat: 5, stagger: 0.06, ease: "sine.inOut" })
        .to(me, { rotation: -6, duration: 0.3, yoyo: true, repeat: 5, transformOrigin: "50% 100%" }, "<")
        .to({}, { duration: 1.5 })
        .to([big, dim, ...fr, me], { opacity: 0, duration: 0.6 });
    }

    // Warm the sprites so the crew doesn't pop in blank.
    for (const id of [star, ...friends].filter(Boolean) as string[]) {
      for (const pose of ["stand", "walkA", "wave"] as const) { const im = new Image(); im.src = castUrl(id, pose); }
    }

    let n = 0;
    let call: gsap.core.Tween | null = null;
    let tl: gsap.core.Timeline | null = null;
    const every = fast ? 25 : BDAY_SHOW_EVERY_MIN * 60;
    const run = () => {
      const h = bangkokHour();
      if (!fast && (document.hidden || h < 7 || h >= 19)) { call = gsap.delayedCall(300, run); return; }
      start();
      tl = n++ % 2 === 0 ? showA() : showC();
      call = gsap.delayedCall(every, run);
    };
    call = gsap.delayedCall(fast ? 3 : 25, run);
    return () => {
      call?.kill(); tl?.kill();
      timeouts.forEach(clearTimeout);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, key]);

  return (
    <div className="tv-bday" ref={stage} aria-hidden="true">
      <canvas />
      <div className="tv-bday-dim" />
      <div className="tv-bday-card">
        <div className="tv-bday-faces">
          {bday.people.map((p) => (
            <FaceDisc key={p.personId ?? p.name} p={p} off={off} className="tv-bday-face" />
          ))}
        </div>
        <h2>Happy Birthday</h2>
        <p>สุขสันต์วันเกิด {bday.names} 🎂</p>
        {bday.wish ? <small>“{bday.wish}”</small> : null}
      </div>
      <div className="tv-bday-crew" />
      <div className="tv-bday-big">Happy Birthday {bday.names}!</div>
    </div>
  );
}
