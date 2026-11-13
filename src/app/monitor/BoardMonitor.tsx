"use client";

/**
 * TV "ผังคุณกุ๊ก" (Kook's layout, 29 Oct 2026): three numbers and today's work
 * on the left, the next four days that have work on the right, six more days
 * along the bottom, and the ticker (ประกาศบนจอ + cancellations/changes) last.
 * Themes: ?theme=a ม่วงเข้ม · b สว่าง · c กรมท่า-ทอง. ?static=1 stops motion.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { fetchMonitorAnnouncements, fetchMonitorEvents, fetchMonitorTeam } from "@/lib/monitor/client";
import type { MonitorAnnouncement, MonitorAssignee, MonitorEvent } from "@/lib/monitor/types";
import { JobIconTile } from "@/components/JobIconTile";
import { buildBoard, isDone, screenTitle, thaiTime, titleSize } from "@/lib/monitor/board";
import { shortName } from "@/lib/monitor/rows";
import { TH_MONTH_SHORT, TH_WEEKDAY_SHORT, bangkokNow, isoParts, thaiLongDate, whenLabel } from "@/lib/monitor/thai-time";
import { Avatar } from "@/components/Avatar";
import "./monitor-hero.css";
import { TeamPulse } from "./TeamPulse";
import { TeamBench } from "./TeamBench";
import { TvCast } from "./TvCast";
import { BirthdayBanner, BirthdayShow } from "./TvBirthday";
import { birthdayToday } from "@/lib/monitor/birthday";
import { WelcomeBanner, WelcomeShow } from "./TvWelcome";
import { WELCOME_CYCLE_MS, WELCOME_DEFAULT_VARIANT, WELCOME_LABELS, WELCOME_ROLE, WELCOME_WARM, asWelcomeVariant, welcomeToday, type WelcomeVariant } from "@/lib/monitor/welcome";
import { nickname } from "@/lib/monitor/nicknames";
import { CONTEST, contestChip, contestTickerLines, type ContestState } from "@/lib/monitor/contest";
import { SHOWCASE_DEFAULT_LOOK, TvShowcase, type BoardRequest, type ShowcaseLook } from "./TvShowcase";
import { ThaiText } from "./ThaiText";
import { IDLE_DEFAULT_LOOK, IDLE_LABELS, TvIdle, untilText, type IdleJoke, type IdleLook, type IdleStats } from "./TvIdle";
import type { ShowcaseItem } from "@/lib/monitor/showcase";
import { FestivalLayer, FestivalStage } from "./FestivalLayer";
import { TvJokeAd, type AdJoke } from "./TvJokeAd";
import { TvDayEdge } from "./TvDayEdge";
import { festivalFor, isFestivalKey, previewFestival } from "@/lib/monitor/festivals";
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

/**
 * โหมดเบา (13 Nov 2026): the office TV box (Android 9, 1 GB) keeps the board,
 * ticker, joke ads and the morning/evening cards, but drops the running
 * cartoon scenes, bench hops, festival particles and the count-up numbers.
 * ?lite=1 forces it, ?lite=0 turns it off; otherwise an Android device with
 * no touch screen (a TV box, never a phone) gets it by itself.
 */
function detectLite(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("lite");
  if (q === "1") return true;
  if (q === "0") return false;
  return /Android/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) === 0;
}

export function BoardMonitor({ linkable = false, staticMode = false, theme = "a", fest }: { linkable?: boolean; staticMode?: boolean; theme?: BoardTheme; fest?: string }) {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    setLite(detectLite());
  }, []);
  const calm = staticMode || lite;
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
    // The RPC covers 14 days; /api/monitor/later adds days 15–60 so a job
    // booked weeks ahead (ลอยกระทง) shows on the right instead of nowhere.
    Promise.all([
      fetchMonitorEvents(),
      fetch("/api/monitor/later")
        .then((r) => (r.ok ? r.json() : { events: [] }))
        .then((j: { events?: MonitorEvent[] }) => j.events ?? [])
        .catch(() => [] as MonitorEvent[]),
    ])
      .then(([near, far]) => setEvents([...near, ...far.filter((f) => !near.some((n) => n.id === f.id))]))
      .catch(() => undefined);
    fetchMonitorAnnouncements().then(setNotes).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  // ทอง · น้ำมัน · ข่าว after the team's own lines (owner, 3 Nov 2026).
  const [world, setWorld] = useState<string[]>([]);
  useEffect(() => {
    const loadWorld = () =>
      fetch("/api/monitor/feed")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: string[] }) => setWorld(Array.isArray(j.items) ? j.items : []))
        .catch(() => undefined);
    loadWorld();
    const id = window.setInterval(loadWorld, 20 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ประกวดมุก chip (owner, 10 Nov 2026): days left + jokes in, from /api/monitor/jokes.
  const [contest, setContest] = useState<ContestState>(null);
  const [contestJokes, setContestJokes] = useState<string[]>([]);
  // กล่อง "วันนี้" ตอนไม่มีงาน (owner, 12 Nov 2026): ?idle=1|2|3 previews a look, ?idle=all cycles them.
  const [idleJokes, setIdleJokes] = useState<IdleJoke[]>([]);
  const [adJokes, setAdJokes] = useState<AdJoke[]>([]);
  const [idleStats, setIdleStats] = useState<IdleStats>(null);
  const [idlePrev, setIdlePrev] = useState<{ look: IdleLook | null; all: boolean }>({ look: null, all: false });
  const [idleCycle, setIdleCycle] = useState<IdleLook>(1);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("idle");
    const n = Number(q);
    setIdlePrev({ look: n === 1 || n === 2 || n === 3 ? (n as IdleLook) : null, all: q === "all" });
    const load = () =>
      fetch("/api/monitor/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: IdleStats) => setIdleStats(j))
        .catch(() => undefined);
    load();
    const id = window.setInterval(load, 15 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!idlePrev.all) return;
    const t = window.setInterval(() => setIdleCycle((v) => ((v % 3) + 1) as IdleLook), 25_000);
    return () => window.clearInterval(t);
  }, [idlePrev.all]);
  useEffect(() => {
    const load = () =>
      fetch("/api/monitor/jokes")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { contest?: ContestState; jokes?: AdJoke[] } | null) => {
          setContest(j?.contest ?? null);
          setAdJokes(j?.jokes ?? []);
          setContestJokes(contestTickerLines(j?.jokes ?? []));
          const a = Date.parse(CONTEST.start), z = Date.parse(CONTEST.end);
          setIdleJokes(
            (j?.jokes ?? [])
              .filter((x) => x.at && Date.parse(x.at) >= a && Date.parse(x.at) <= z)
              .map((x) => ({ personId: (x as { personId?: string }).personId ?? "", name: x.name, setup: x.setup, punch: x.punch })),
          );
        })
        .catch(() => undefined);
    load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  const contestText = contestChip(contest);

  // โชว์ผลงาน in the leftover bottom space (owner, 6 Nov 2026). ?sc=1|2|3 previews a look.
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [scLook, setScLook] = useState<ShowcaseLook>(SHOWCASE_DEFAULT_LOOK);
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get("sc"));
    if (q === 1 || q === 2 || q === 3) setScLook(q);
    const loadShowcase = () =>
      fetch("/api/monitor/showcase")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: ShowcaseItem[] }) => setShowcaseItems(Array.isArray(j.items) ? j.items : []))
        .catch(() => undefined);
    loadShowcase();
    const id = window.setInterval(loadShowcase, 15 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  // คำขอจากทีม (10 Nov 2026): take turns with the news in the same box.
  const [teamRequests, setTeamRequests] = useState<BoardRequest[]>([]);
  useEffect(() => {
    const loadRequests = () =>
      fetch("/api/monitor/requests")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: BoardRequest[] }) => setTeamRequests(Array.isArray(j.items) ? j.items : []))
        .catch(() => undefined);
    loadRequests();
    const id = window.setInterval(loadRequests, 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ชื่องานยาวในแถบล่าง (owner, 6 Nov 2026): titles wrap, and a cell whose jobs
  // don't fit scrolls up slowly, pauses, and comes back — nothing is cut off.
  const cellsRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = cellsRef.current;
    if (!root) return;
    const measure = () => {
      root.querySelectorAll<HTMLElement>(".bm-cell-body").forEach((body) => {
        const roll = body.firstElementChild as HTMLElement | null;
        if (!roll) return;
        const over = roll.offsetHeight - body.clientHeight; // offsetHeight: the icon tile pokes out a few px
        roll.classList.toggle("is-roll", over > 2 && !staticMode);
        roll.style.setProperty("--roll", `${-Math.max(0, over)}px`);
        roll.style.animationDuration = `${Math.max(8, over / 6 + 6)}s`;
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

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
  const board = useMemo(() => (today ? buildBoard(events, today, now, { horizonDays: 60 }) : null), [events, today, now]);

  const ticker = useMemo(() => {
    if (!today) return [];
    const said = notes.map((n) => `📢 ${n.message}${n.authorName ? ` — ${shortName(n.authorName)}` : ""}`);
    const canceled = events
      .filter((e) => e.status === "canceled")
      .map((e) => `⛔ ยกเลิก ${whenLabel(e.eventDate, e.startTime, today)} ${screenTitle(e)}${e.cancellationReason ? ` — ${e.cancellationReason}` : ""}`);
    const changed = events
      .filter((e) => e.status !== "canceled" && e.hasChanges)
      .map((e) => `🔄 เปลี่ยนแปลง ${whenLabel(e.eventDate, e.startTime, today)} ${screenTitle(e)} — ตรวจสอบก่อนออกงาน`);
    return [...said, ...canceled, ...changed, ...contestJokes, ...world];
  }, [events, notes, today, world, contestJokes]);

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

  const castPeople = useMemo(() => Object.values(team.ids), [team.ids]);
  // อวยพรวันเกิด: today's job titled วันเกิด/HBD → its people. ?bday=<personId> previews.
  const [bdayPreview, setBdayPreview] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("bday");
    if (q && q !== "fast") setBdayPreview(q);
  }, []);
  const bday = useMemo(() => {
    if (!today) return null;
    const real = birthdayToday(events, today, (n) => team.ids[n]);
    if (real || !bdayPreview) return real;
    const name = Object.keys(team.ids).find((n) => team.ids[n] === bdayPreview);
    return name ? { people: [{ name, short: nickname(bdayPreview, name), personId: bdayPreview }], wish: "", names: nickname(bdayPreview, name) } : null;
  }, [events, today, team.ids, bdayPreview]);
  // ต้อนรับคนมาใหม่: today's job titled ต้อนรับ + โอน/ย้าย/มาใหม่. ?welcome=fast&wv=1|2|3 previews.
  // ?welcome=fast&wv=all — the team picks on the TV (6 Nov 2026): looks 1→2→3, each labelled.
  const [welPreview, setWelPreview] = useState<{ on: boolean; v: WelcomeVariant | null; all: boolean }>({ on: false, v: null, all: false });
  const [welCycle, setWelCycle] = useState<WelcomeVariant>(1);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const all = q.get("wv") === "all";
    setWelPreview({ on: q.has("welcome") || all, v: asWelcomeVariant(q.get("wv")), all });
    if (!all) return;
    const t = setInterval(() => setWelCycle((v) => ((v % 3) + 1) as WelcomeVariant), WELCOME_CYCLE_MS);
    return () => clearInterval(t);
  }, []);
  const welcome = useMemo(() => {
    if (!today) return null;
    if (welPreview.all) return { role: WELCOME_ROLE, warm: WELCOME_WARM, variant: welCycle, label: WELCOME_LABELS[welCycle] };
    const real = welcomeToday(events, today, welPreview.v ?? undefined);
    if (real || !welPreview.on) return real;
    return { role: WELCOME_ROLE, warm: WELCOME_WARM, variant: welPreview.v ?? WELCOME_DEFAULT_VARIANT };
  }, [events, today, welPreview, welCycle]);
  const todayCount = board?.todayJobs.length ?? 0;
  const fit = useTodayFit(board?.todayJobs ?? [], now);
  // ธีมเทศกาลตามวันที่ (?fest=loy ใช้ดูตัวอย่าง)
  const festival = isFestivalKey(fest) ? previewFestival(fest) : today ? festivalFor(today) : null;

  return (
    <div className={`hm bm bm--${theme}${staticMode ? " hm--still" : ""}${lite ? " hm--lite" : ""}${festival ? ` bm--fest-${festival.key}` : ""}${bday ? " bm--bday" : ""}${welcome ? " bm--wel" : ""} bm-space-${Math.min(fit.level, 2)}`}>
      <FestivalLayer festival={festival?.key ?? null} />
      <header className="hm-head bm-head">
        <span className="bm-seal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seal-2569.png" alt="ตราเทศบาลนครนครสวรรค์" />
        </span>
        <div>
          <h1>เทศบาลนครนครสวรรค์</h1>
          <p>ตารางงานฝ่ายบริการและเผยแพร่วิชาการ</p>
          {festival?.chip ? <span className="bm-fest-chip">{festival.chip}</span> : null}
          {contestText ? <span className="bm-fest-chip bm-contest-chip">{contestText}</span> : null}
        </div>
        {welcome ? (
          <WelcomeBanner welcome={welcome} still={staticMode} />
        ) : bday ? (
          <BirthdayBanner bday={bday} off={team.off} still={staticMode} />
        ) : (
          <FestivalStage festival={festival?.key ?? null} still={calm} daysLeft={festival?.daysLeft} />
        )}
        <TeamPulse still={calm} noFace={team.off} />
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

        <section className={`bm-today${todayCount === 1 ? " is-one" : ""}${todayCount >= 3 ? " is-many" : ""}${todayCount >= 5 ? " is-lots" : ""} fit-${Math.max(0, fit.level - 2)}${board?.todayJobs.some((e) => !isDone(e, now)) ? " has-upcoming" : ""}`}>
          <div className="bm-today-head">
            <span className="bm-chip">{today ? thaiLongDate(today).replace(/^วัน\S+ที่ /, "วันที่ ") : ""}</span>
            {/* งานเยอะ: ตัวเลข 3 ช่องด้านบนย่อมาอยู่ตรงนี้ เพื่อให้งานวันนี้ได้พื้นที่เต็ม */}
            <span className="bm-today-mini">
              <b>{board?.stats.today ?? 0}</b> งานวันนี้ · <b className={(board?.stats.pending ?? 0) > 0 ? "is-warn" : ""}>{board?.stats.pending ?? 0}</b> ยังไม่รับงาน · <b>{board?.stats.week ?? 0}</b> 7 วันข้างหน้า
            </span>
          </div>
          {(todayCount === 0 && (board?.stats.today ?? 0) === 0) || idlePrev.look || idlePrev.all ? (
            (() => {
              const first = board?.dayRows[0];
              const e = first?.events[0];
              const p = first ? dayParts(first.iso) : null;
              const people = e ? e.assigneeDetail : [];
              const look: IdleLook = idlePrev.all ? idleCycle : idlePrev.look ?? IDLE_DEFAULT_LOOK;
              const dates = [
                ...(festival?.chip ? [festival.chip] : []),
                ...(contest ? [`🏆 ประกาศผลประกวดมุก จ. ${Number(CONTEST.results.slice(8))} พ.ย. บนจอนี้`] : []),
              ];
              return (
                <TvIdle
                  look={look}
                  label={idlePrev.all ? IDLE_LABELS[look] : undefined}
                  next={
                    e && p && first
                      ? {
                          when: `${p.wd.replace(/\.$/, "")}. ${p.d} ${p.mon} ${thaiTime(e.startTime)}`,
                          title: screenTitle(e),
                          place: e.locationName ?? "",
                          inText: untilText(first.iso, e.startTime, Date.now()),
                          faces: people.slice(0, 4).map((x, k) => face(x, k, 44)),
                        }
                      : null
                  }
                  news={showcaseItems}
                  jokes={idleJokes}
                  stats={idleStats}
                  requests={teamRequests}
                  dates={dates}
                  still={staticMode}
                />
              );
            })()
          ) : todayCount === 0 ? (
            <p className="bm-empty">งานวันนี้เสร็จครบแล้ว 👍</p>
          ) : (
            <div className="bm-today-list" ref={fit.ref}>
              {fit.shown.map((e) => {
                const t = screenTitle(e);
                return (
                  <article className={`bm-job${isDone(e, now) ? " is-done" : ""}`} key={e.id} {...link(e)}>
                    <div className="bm-job-info">
                      <JobIconTile title={e.title} icon={e.icon} size="var(--bm-ic)" className="bm-job-icon" />
                      <div className="bm-job-text">
                        <div className="bm-job-time">
                          {thaiTime(e.startTime, e.endTime)}
                          {isDone(e, now) ? <span className="bm-done">✓ จบแล้ว</span> : null}
                          <span className="bm-time-place">📍 {e.locationName || "ไม่ระบุสถานที่"}</span>
                        </div>
                        <h2 className={`bm-job-title ${titleSize(t)}`}><ThaiText text={t} /></h2>
                        <p className="bm-job-place">📍 {e.locationName || "ไม่ระบุสถานที่"}</p>
                        {e.shortNote ? <p className="bm-job-note">📝 {e.shortNote}</p> : null}
                      </div>
                    </div>
                    {/* ทุกคนในงาน ไม่ตัด "+ อีก n คน" (owner, 4 Nov 2026): 4–5 คนแถวชิด · 6+ สองคอลัมน์ */}
                    <div className={`bm-job-people${e.assigneeDetail.length > 3 ? " is-grid" : ""}${e.assigneeDetail.length > 5 ? " is-two" : ""}`}>
                      {e.assigneeDetail.map((p, k) => (
                        <div className="bm-pp" key={`${p.name}-${k}`}>
                          {face(p, k, 64)}
                          <span>
                            <b>{shortName(p.name)}</b> <i>{p.role}</i>
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {fit.pages > 1 ? (
            <div className="bm-pages" aria-label={`หน้า ${fit.page + 1} จาก ${fit.pages}`}>
              {Array.from({ length: fit.pages }, (_, i) => <i key={i} className={i === fit.page ? "on" : ""} />)}
              <span>งานวันนี้ {todayCount} งาน · สลับทุก 8 วิ</span>
            </div>
          ) : null}
        </section>

        <section className="bm-days">
          {Array.from({ length: 4 }, (_, i) => board?.dayRows[i]).map((d, i) => {
            if (!d) {
              // ม้านั่งทีมอยู่ในช่องว่างแรก กินที่ทุกช่องว่างที่เหลือ
              const filled = board?.dayRows.length ?? 0;
              if (i === filled) return <TeamBench key="bench" span={4 - filled} still={calm} />;
              return null;
            }
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
                    <div className="bm-day-one" {...link(one)}>
                      <JobIconTile title={one.title} icon={one.icon} size="calc(54 * var(--u))" />
                      <div className="bm-day-text">
                        <div className={`bm-day-title ${titleSize(screenTitle(one))}`}>
                          <em>{thaiTime(one.startTime)}</em> <ThaiText text={screenTitle(one)} />
                        </div>
                        <p className="bm-day-place">📍 {one.locationName || "ไม่ระบุสถานที่"}</p>
                        {one.shortNote ? <p className="bm-day-note">📝 {one.shortNote}</p> : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      {d.events.slice(0, d.events.length > 3 ? 2 : 3).map((e) => (
                        <div className="bm-day-line" key={e.id} {...link(e)}>
                          <JobIconTile title={e.title} icon={e.icon} size="calc(30 * var(--u))" className="bm-inline-icon" />
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

      <footer className="bm-cells" ref={cellsRef}>
        {(board?.cells ?? []).map((c) => {
          const p = dayParts(c.iso);
          return (
            <div className={`bm-cell${c.events.length ? " has" : ""}`} key={c.iso}>
              <div className="bm-cell-h">
                <b>{p.d}</b> {p.mon} <i>{p.wd}</i>
              </div>
              <div className="bm-cell-body">
                <div className="bm-cell-roll">
                  {c.events.map((e) => (
                    <div className="bm-cell-x" key={e.id} {...link(e)}>
                      <JobIconTile title={e.title} icon={e.icon} size="calc(22 * var(--u))" className="bm-inline-icon" />
                      <em>{thaiTime(e.startTime)}</em> <ThaiText text={screenTitle(e)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {board && board.cells.length < 6 ? (
          <div className={`bm-cell bm-cell-rest${showcaseItems.length || teamRequests.length ? " has-sc" : ""}`} style={{ gridColumn: `span ${6 - board.cells.length}` }}>
            <TvShowcase
              items={showcaseItems}
              requests={teamRequests}
              look={scLook}
              still={staticMode}
              fallback={`✨ ${board.cells.length || board.dayRows.length ? "หลังจากนี้ยังว่าง" : "ยังไม่มีงานข้างหน้า"} · งานใหม่ขึ้นทันทีที่เผยแพร่`}
            />
          </div>
        ) : null}
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
      <TvCast still={calm} people={castPeople} off={team.off} events={events} festival={festival} />
      {bday ? <BirthdayShow bday={bday} still={staticMode} off={team.off} team={castPeople} /> : null}
      {welcome ? <WelcomeShow welcome={welcome} still={staticMode} off={team.off} team={castPeople} /> : null}
      <TvJokeAd jokes={adJokes} still={staticMode} events={events} team={castPeople} off={team.off} />
      <TvDayEdge events={events} still={staticMode} team={castPeople} off={team.off} />
    </div>
  );
}

/**
 * งานวันนี้ต้องเห็นครบทุกงาน (owner, 4 Nov 2026: งานทับกันเมื่อมี 3 งาน + หมายเหตุ).
 * Makes room first, then shrinks (owner: เน้นงานวันนี้ให้หมดก่อน):
 *   1 the three number tiles fold into one line, today's card grows to the top
 *   2 the bottom row of 6 days steps aside, today's card grows to the bottom
 *   3 fit-1 people in a row · 4 fit-2 people beside the job · 5 fit-3 one line each
 * Still too tall → whole jobs a page at a time (8 s each).
 */
function useTodayFit(jobs: MonitorEvent[], now: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [level, setLevel] = useState(0);
  const [perPage, setPerPage] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const key = jobs.map((e) => `${e.id}:${e.shortNote ?? ""}:${e.assigneeDetail.length}:${isDone(e, now) ? 1 : 0}`).join("|");
  const [size, setSize] = useState(0);

  // The screen size (not the card's: the card itself grows as room is made).
  useEffect(() => {
    const on = () => setSize(window.innerWidth * 10000 + window.innerHeight);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Start over whenever the jobs or the screen change.
  useLayoutEffect(() => { setLevel(0); setPerPage(null); setPage(0); }, [key, size]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || perPage !== null) return;
    if (el.scrollHeight <= el.clientHeight + 2) return;
    if (level < 5) { setLevel(level + 1); return; }
    // Still too tall at the smallest size: as many whole jobs as fit, page by page.
    const kids = Array.from(el.children) as HTMLElement[];
    let used = 0, n = 0;
    for (const k of kids) { used += k.offsetHeight + 12; if (used > el.clientHeight) break; n++; }
    setPerPage(Math.max(1, n));
  });

  const pages = perPage ? Math.ceil(jobs.length / perPage) : 1;
  useEffect(() => {
    if (pages <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages), 8000);
    return () => clearInterval(t);
  }, [pages]);
  const shown = perPage ? jobs.slice((page % pages) * perPage, (page % pages) * perPage + perPage) : jobs;
  return { ref, level, shown, pages, page: page % pages };
}
