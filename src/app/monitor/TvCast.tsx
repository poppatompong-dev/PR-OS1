"use client";

// ตัวการ์ตูนเต็มตัวป่วนจอ (owner, 3–4 Nov 2026 · แบบ M สติกเกอร์ไดคัท):
// หน้า = รูปการ์ตูนของแต่ละคน (ตัดพื้นหลัง) + ตัวที่ปั้นใน Blender, 8 ท่า ต่อคน
// (public/cast/<personId>/<pose>.webp, + -angry/-shout/-sad/-cry/-shock faces). ทีละช่อง สั้น ๆ
// แล้วจอนิ่ง 25–45 วิ (ดูรอบหมุนด้านล่าง). คนที่เลือก "ไม่ใช้รูป" ไม่ออกมา.
// Only 07:00–19:00, never on the still screen or with reduced motion.
// Positions come from the live layout (ticker, cards, stats capsule), so it
// follows whatever the board looks like today.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CAST_IDS, CAST_POSES, castUrl, type CastPose } from "@/lib/monitor/cast";
import { EARTH_ID, GAG_COUNT, GAG_HOME_TIME, playGag, preloadGags } from "./tv-gags";
import { BADGE_TEXT, BUILTIN_JOKES, SCENES, playScene, preloadScene } from "./tv-scenes";
import { catchphrase } from "@/lib/monitor/catchphrases";
import { isDone, screenTitle } from "@/lib/monitor/board";
import { bangkokNow } from "@/lib/monitor/thai-time";
import type { MonitorEvent } from "@/lib/monitor/types";
import type { Festival } from "@/lib/monitor/festivals";

// "สร้างความครื้นเครงแบบถี่ ๆ ไปก่อน แต่ไม่ให้กระทบคนดูคิวงานมากนัก · ทุกตัวละครควรมี
// บทบาทพอ ๆ กัน" (owner, 4 Nov 2026): every slot is short (≤10 s) with 25–45 s of a
// still board in between, rotating antic → anime scene → antic → แก็กป้าจิตร.
// Whoever has been on screen least plays the next role (antics, scenes and gags
// all count), so nobody hogs the screen. พี่ไป๋ (senior) only gets the cheerful
// parts: ordinary antics, ทั้งทีมสู้ and her own badge.
// 5 Nov 2026 ("feedback ดี คิดเผื่อยาว ๆ"): a sixth slot for the long-run variety —
// time-of-day scenes, the Mon–Fri serial, festival scenes and jokes from the
// Telegram joke box — and real-work moments (new job, all acknowledged, day
// cleared) jump the queue.
const ROTATION = ["act", "scene", "act", "gag", "act", "extra"] as const;
type SceneMeta = { key: string; kind?: string; fest?: string[]; earth?: boolean; badge?: boolean; all?: boolean; n?: number; pai?: boolean };
type Job = { key: "W1" | "W2" | "W3"; roles: string[]; data: Record<string, unknown> };
type Joke = { id: string; personId: string; name: string; setup: string; punch: string };
const SERIAL_EVERY_MIN = 25;
const SERIAL_FROM = "2026-11-09"; // first Monday after it shipped
const FEST_EVERY_MIN = 8;
/** Bangkok minutes-of-day windows for the time scenes (Fri only for T3). */
const TIME_WINDOWS: Record<string, { from: number; to: number; every: number; fri?: boolean }> = {
  T2: { from: 7 * 60 + 50, to: 8 * 60 + 40, every: 20 }, // เช้า สายแล้ว
  T1: { from: 11 * 60 + 45, to: 12 * 60 + 15, every: 12 }, // พักเที่ยง
  T3: { from: 13 * 60, to: 16 * 60 + 30, every: 40, fri: true }, // ศุกร์แล้ว
};
const GAG_WITH_TEAM = 7; // น้องชวนไปต่อ — needs กุ๊ก แป้ง นัท on screen
const TEAM_FOR_GAG = ["00000000-0000-0000-0000-000000000503", "00000000-0000-0000-0000-000000000505", "00000000-0000-0000-0000-000000000504"];
const PAI = "00000000-0000-0000-0000-000000000501";

const GAP_S: [number, number] = [25, 45];
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

type Sprite = { el: HTMLDivElement; id: string; set: (p: CastPose) => void; cycle: (a: CastPose, b: CastPose, s: number) => void; stop: (p?: CastPose) => void };

function bangkokHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()));
}

export function TvCast({ still, people, off, events = [], festival = null }: { still: boolean; people: string[]; off: Set<string>; events?: MonitorEvent[]; festival?: Festival | null }) {
  const stage = useRef<HTMLDivElement>(null);
  const cast = people.filter((id) => CAST_IDS.includes(id) && !off.has(id));
  const key = cast.join(",");
  const festRef = useRef<Festival | null>(festival);
  festRef.current = festival;
  const workQ = useRef<Job[]>([]);
  const seen = useRef<{ ids: Map<string, boolean>; day: string; cleared: boolean } | null>(null);

  // Real-work moments: compare each board load with the last one.
  useEffect(() => {
    const now = bangkokNow();
    const live = events.filter((e) => e.status !== "canceled" && e.eventDate >= now.iso);
    const castOf = (e: MonitorEvent) => [...new Set(e.assigneeDetail.map((a) => a.personId).filter((id): id is string => !!id && cast.includes(id)))].slice(0, 3);
    const todays = live.filter((e) => e.eventDate === now.iso);
    const cleared = todays.length > 0 && todays.every((e) => isDone(e, now.minutes));
    const prev = seen.current;
    if (prev && prev.day === now.iso) {
      for (const e of live) {
        const ids = castOf(e);
        if (!ids.length) continue;
        if (!prev.ids.has(e.id)) workQ.current.push({ key: "W1", roles: ids, data: { title: screenTitle(e).slice(0, 30) } });
        else if (e.allAck && prev.ids.get(e.id) === false) workQ.current.push({ key: "W2", roles: ids, data: { title: screenTitle(e).slice(0, 24) } });
      }
      if (cleared && !prev.cleared) workQ.current.push({ key: "W3", roles: [], data: { count: todays.length } });
      workQ.current = workQ.current.slice(-4);
    }
    if (live.length || prev) seen.current = { ids: new Map(live.map((e) => [e.id, e.allAck])), day: now.iso, cleared };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, key]);

  useEffect(() => {
    const root = stage.current;
    if (!root || still || !cast.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // /tv?cast=fast — preview: one antic every few seconds, any hour.
    const fast = new URLSearchParams(window.location.search).get("cast") === "fast";
    const gap: [number, number] = fast ? [2, 3] : GAP_S;
    let alive = true;
    const timers = new Set<ReturnType<typeof setInterval>>();
    // Fair turns: the least-seen person goes next (ties broken at random).
    const used = new Map<string, number>(cast.map((id) => [id, 0]));
    const bump = (ids: string[]) => ids.forEach((id) => used.set(id, (used.get(id) ?? 0) + 1));
    const pick = (n: number, ok: (id: string) => boolean = () => true): string[] | null => {
      const pool = cast.filter(ok).map((id) => [id, (used.get(id) ?? 0) + Math.random() * 0.5] as const).sort((a, b) => a[1] - b[1]);
      if (pool.length < n) return null;
      const out = pool.slice(0, n).map(([id]) => id);
      bump(out);
      return out;
    };
    const nextId = (not?: string) => (pick(1, (id) => id !== not) ?? pick(1)!)[0];
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
    // คำพูดติดปาก: a little bubble over the head (counter-flipped so it reads right).
    const say = (s: Sprite, flip = 1) => {
      const t = Math.random() < 0.6 ? catchphrase(s.id) : null;
      if (!t) return;
      const b = document.createElement("div");
      b.className = "tv-cast-say";
      b.textContent = t;
      b.style.fontSize = `${20 * u()}px`;
      b.style.transform = `translateX(-50%) scaleX(${flip})`;
      s.el.appendChild(b);
    };
    const W = () => window.innerWidth;
    const floorY = () => box(".bm-ticker")?.top ?? window.innerHeight - 60 * u();

    function walkTicker() {
      const c = make(nextId()); const y = floorY(); const dir = Math.random() < 0.5 ? 1 : -1;
      const x0 = dir > 0 ? -80 : W() + 80, x1 = dir > 0 ? W() + 80 : -80, mid = W() * (0.25 + Math.random() * 0.5);
      const v = 190 * u();
      gsap.set(c.el, { x: x0, y, scaleX: dir });
      return gsap.timeline({ onComplete: done(c) })
        .call(() => c.cycle("walkA", "walkB", 0.2)).to(c.el, { x: mid, duration: Math.abs(mid - x0) / v, ease: "none" })
        .call(() => { c.stop("wave"); say(c, dir); }).to(c.el, { rotation: -5, duration: 0.3, yoyo: true, repeat: 7, transformOrigin: "50% 100%" })
        .call(() => { c.el.querySelector(".tv-cast-say")?.remove(); c.cycle("walkA", "walkB", 0.2); }).to(c.el, { x: x1, rotation: 0, duration: Math.abs(x1 - mid) / v, ease: "none" });
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
        .call(() => { c.set("wave"); say(c); }).to(c.el, { y: h + 70 * u(), duration: 0.25 }).to(c.el, { rotation: -4, duration: 0.25, yoyo: true, repeat: 5 })
        .call(() => { c.set("stand"); c.el.querySelector(".tv-cast-say")?.remove(); }).to(c.el, { y: h * 2 + 10, duration: 0.3, ease: "power2.in" });
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
    const q = new URLSearchParams(window.location.search);
    // /tv?jit=fast — preview: a gag every time, any hour.
    // /tv?jit=3 — that gag (1–11) over and over.
    const jitOnly = /^\d+$/.test(q.get("jit") ?? "") ? Number(q.get("jit")) - 1 : -1;
    const jitFast = q.get("jit") === "fast" || jitOnly >= 0;
    // /tv?scene=fast — every anime scene in turn · /tv?scene=B3 — that one, over and over.
    const sceneQ = q.get("scene");
    const sceneOnly = sceneQ && sceneQ !== "fast" ? SCENES.findIndex((s) => s.key === sceneQ.toUpperCase()) : -1;
    const sceneFast = !!sceneQ;
    const preview = fast || jitFast || sceneFast;
    const gagsOn = cast.includes(EARTH_ID); // พี่เอิร์ธ chose "no cartoon" → no gags
    if (gagsOn) preloadGags();
    cast.forEach((id) => CAST_POSES.forEach((p) => { const im = new Image(); im.src = castUrl(id, p); }));
    let slot = 0;
    let gagBag: number[] = [];
    let sceneBag: number[] = [];
    let gag: { kill: () => void } | null = null;
    // Real badges from the bench (praise only) for the ได้เหรียญ scenes.
    let holders = new Map<string, { label: string; icon: string }>();
    const loadBadges = () =>
      fetch("/api/monitor/team").then((r) => (r.ok ? r.json() : null)).then((j: { monthLabel?: string; people?: { personId: string; badges: (keyof typeof BADGE_TEXT)[] }[] } | null) => {
        if (!j?.people) return;
        holders = new Map(j.people.filter((p) => p.badges?.length && cast.includes(p.personId)).map((p) => {
          const b = p.badges[Math.floor(Math.random() * p.badges.length)];
          const label: string = BADGE_TEXT[b] ?? "🏅";
          return [p.personId, { label: `${label} เดือน ${j.monthLabel ?? ""}`.trim(), icon: label.split(" ")[0] }];
        }));
      }).catch(() => undefined);
    loadBadges();
    const badgeTimer = setInterval(loadBadges, 30 * 60_000);
    timers.add(badgeTimer);
    const META = SCENES as SceneMeta[];
    const idx = (k: string) => META.findIndex((s) => s.key === k);
    const notPai = (id: string) => id !== PAI;
    const isFest = (s: SceneMeta) => !!s.fest && (preview || (!!festRef.current && s.fest.includes(festRef.current.key)));
    const canScene = (i: number) => {
      const s = META[i];
      if (s.kind === "work") return preview;
      if (s.fest && !isFest(s)) return false;
      if (s.kind === "serial") return gagsOn && cast.filter((id) => id !== EARTH_ID && notPai(id)).length >= 2;
      if (s.earth) return gagsOn;
      if (s.badge) return holders.size > 0;
      if (s.all) return cast.length >= 3;
      return cast.filter((id) => s.pai || notPai(id)).length >= (s.n ?? 1);
    };
    // มุก: sent jokes first (least told), then the built-in ones in a shuffled bag.
    let jokes: Joke[] = [];
    const told = new Map<string, number>();
    let builtin: number[] = [];
    const loadJokes = () =>
      fetch("/api/monitor/jokes").then((r) => (r.ok ? r.json() : null)).then((j: { jokes?: Joke[] } | null) => { if (j?.jokes) jokes = j.jokes; }).catch(() => undefined);
    loadJokes();
    timers.add(setInterval(loadJokes, 10 * 60_000));
    const nextJoke = (): { setup: string; punch: string; personId?: string; name?: string } => {
      const sent = [...jokes].sort((a, b) => (told.get(a.id) ?? 0) - (told.get(b.id) ?? 0));
      // A sent joke is told up to 6 times before the built-ins mix back in.
      if (sent.length && (told.get(sent[0].id) ?? 0) < 6 && Math.random() < 0.8) {
        told.set(sent[0].id, (told.get(sent[0].id) ?? 0) + 1);
        return sent[0];
      }
      if (!builtin.length) builtin = shuffle(BUILTIN_JOKES.map((_, k) => k));
      return BUILTIN_JOKES[builtin.pop()!];
    };
    // ละครตอนต่อ: same detective and suspect all week (seeded by the week number).
    const serialRoles = (): string[] => {
      const pool = cast.filter((id) => id !== EARTH_ID && notPai(id)).sort();
      const wk = Math.floor((Date.now() / 86_400_000 + 3) / 7);
      const d = pool[wk % pool.length], sus = pool[(wk + 1 + (wk % Math.max(1, pool.length - 1))) % pool.length];
      return [EARTH_ID, d, sus === d ? pool[(pool.indexOf(d) + 1) % pool.length] : sus];
    };
    const serialEp = (): number => {
      const ep = Number(q.get("ep"));
      if (ep >= 1 && ep <= 5) return ep;
      const today = bangkokNow().iso;
      if (today < SERIAL_FROM) return 0; // start on a Monday, not mid-story
      const wd = new Date(`${today}T00:00:00Z`).getUTCDay();
      return wd >= 1 && wd <= 5 ? wd : 0;
    };
    const castScene = (i: number): { i: number; roles: string[]; data: Record<string, unknown> } | null => {
      if (!canScene(i)) return null;
      const s = META[i];
      if (s.kind === "work") {
        const sample = cast.filter(notPai).slice(0, 2);
        return { i, roles: s.key === "W3" ? shuffle(cast) : sample, data: { title: "ตัวอย่าง: ถ่ายภาพงานประชุม", count: 3 } };
      }
      if (s.kind === "serial") { const r = serialRoles(); bump(r); return { i, roles: r, data: { ep: serialEp() || 1 } }; }
      if (s.kind === "joke") {
        const j = nextJoke();
        const teller = j.personId && cast.includes(j.personId) ? j.personId : (pick(1, notPai) ?? [cast[0]])[0];
        if (j.personId === teller) bump([teller]);
        const ears = pick(Math.min(2, cast.filter((id) => id !== teller && notPai(id)).length), (id) => id !== teller && notPai(id)) ?? [];
        // พี่ไป๋'s own joke always gets the laugh.
        const react = teller === PAI || Math.random() < 0.65 ? "laugh" : "flat";
        return { i, roles: [teller, ...ears], data: { setup: j.setup, punch: j.punch, name: j.name, react } };
      }
      if (s.fest && s.all) {
        const f = festRef.current?.key;
        const greet = f === "cny" ? "ซินเจียยู่อี่ ซินนี้ฮวดไช้ 🧧" : `สวัสดีปีใหม่ ${(festRef.current?.chip.match(/\d{4}/) ?? [String(new Date().getFullYear() + 544)])[0]} 🎆`;
        bump(cast);
        return { i, roles: shuffle(cast), data: { greet } };
      }
      if (s.earth) { bump([EARTH_ID]); return { i, roles: [EARTH_ID], data: {} }; }
      if (s.all) { bump(cast); return { i, roles: shuffle(cast), data: {} }; }
      if (s.badge) { const r = pick(1, (id) => holders.has(id)); return r ? { i, roles: r, data: holders.get(r[0])! } : null; }
      const r = pick(Math.min(s.n ?? 1, cast.filter((id) => s.pai || notPai(id)).length), (id) => !!s.pai || notPai(id));
      return r && r.length >= Math.min(s.n ?? 1, 2) ? { i, roles: r, data: {} } : null;
    };
    const nextScene = () => {
      if (sceneOnly >= 0) return castScene(sceneOnly);
      if (sceneFast) {
        // preview: every scene in order
        const i = sceneCursor++ % META.length;
        return castScene(i) ?? castScene(idx("B3"));
      }
      const anime = (k: number) => !META[k].kind && canScene(k);
      if (!sceneBag.some(anime)) sceneBag = shuffle(META.map((_, k) => k).filter((k) => !META[k].kind));
      const k = sceneBag.findIndex(anime);
      return k < 0 ? null : castScene(sceneBag.splice(k, 1)[0]);
    };
    let sceneCursor = 0;
    const lastAt = new Map<string, number>();
    const minsSince = (k: string) => (Date.now() - (lastAt.get(k) ?? 0)) / 60_000;
    // The sixth slot: time scene → serial → festival → joke.
    const nextExtra = () => {
      const now = bangkokNow();
      const fri = new Date(`${now.iso}T00:00:00Z`).getUTCDay() === 5;
      for (const [k, w] of Object.entries(TIME_WINDOWS)) {
        if (now.minutes >= w.from && now.minutes <= w.to && (!w.fri || fri) && minsSince(k) >= w.every) {
          const sc = castScene(idx(k));
          if (sc) { lastAt.set(k, Date.now()); return sc; }
        }
      }
      if (serialEp() && minsSince("S") >= SERIAL_EVERY_MIN) {
        const sc = castScene(idx("S"));
        if (sc) { lastAt.set("S", Date.now()); return sc; }
      }
      if (festRef.current && minsSince("F") >= FEST_EVERY_MIN) {
        const fs = shuffle(META.map((_, k) => k).filter((k) => META[k].kind === "fest" && canScene(k)));
        for (const k of fs) { const sc = castScene(k); if (sc) { lastAt.set("F", Date.now()); return sc; } }
      }
      return castScene(idx("J"));
    };
    const nextGag = (): number | null => {
      if (jitOnly >= 0 && jitOnly < GAG_COUNT) return jitOnly;
      const late = bangkokHour() >= 16;
      const team = TEAM_FOR_GAG.every((id) => cast.includes(id));
      const ok = (g: number) => (g !== GAG_HOME_TIME || late || preview) && (g !== GAG_WITH_TEAM || team);
      if (!gagBag.some(ok)) gagBag = Array.from({ length: GAG_COUNT }, (_, i) => i).sort(() => Math.random() - 0.5);
      const i = gagBag.findIndex(ok);
      if (i < 0) return null;
      const g = gagBag.splice(i, 1)[0];
      bump(g === GAG_WITH_TEAM ? [EARTH_ID, ...TEAM_FOR_GAG] : [EARTH_ID]);
      return g;
    };
    let last: (typeof ACTS)[number] | null = null;
    let call: gsap.core.Tween | null = null;
    let tl: gsap.core.Timeline | null = null;
    const schedule = (sec: number) => { call = gsap.delayedCall(sec, run); };
    const after = () => (preview ? 3 : gap[0] + Math.random() * (gap[1] - gap[0]));
    async function run() {
      if (!alive) return;
      const h = bangkokHour();
      if (!preview && (document.hidden || h < 7 || h >= 19)) return schedule(300);
      // A birthday show is on (TvBirthday) — let it have the screen.
      if (document.documentElement.dataset.tvShow) return schedule(30);
      const kind = sceneFast ? "scene" : jitFast ? "gag" : fast ? "act" : ROTATION[slot++ % ROTATION.length];
      const s = u();
      const play = async (sc: { i: number; roles: string[]; data: Record<string, unknown> }) => {
        await preloadScene(sc.roles);
        if (!alive) return;
        gag = playScene(sc.i, root!, floorY() / u(), u(), sc.roles, sc.data, () => { gag = null; schedule(after()); });
      };
      // Something just happened on the board → show it now (not in previews).
      const job = preview ? undefined : workQ.current.shift();
      if (job) {
        const roles = job.key === "W3" ? shuffle(cast) : job.roles;
        bump(roles);
        if (roles.length) return play({ i: idx(job.key), roles, data: job.data });
      }
      if (kind === "extra") {
        const sc = nextExtra();
        if (sc) return play(sc);
      }
      if (kind === "gag" && gagsOn) {
        const g = nextGag();
        if (g !== null) {
          gag = playGag(g, root!, floorY() / s, s, () => { gag = null; schedule(after()); });
          return;
        }
      }
      if (kind === "scene" || kind === "gag" || kind === "extra") {
        const sc = nextScene();
        if (sc) return play(sc);
      }
      let f = ACTS[Math.floor(Math.random() * ACTS.length)];
      while (f === last) f = ACTS[Math.floor(Math.random() * ACTS.length)];
      last = f;
      tl = f();
      const cb = tl.eventCallback("onComplete");
      tl.eventCallback("onComplete", () => { cb?.(); schedule(gap[0] + Math.random() * (gap[1] - gap[0])); });
    }
    schedule(preview ? 1 : 20);
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
