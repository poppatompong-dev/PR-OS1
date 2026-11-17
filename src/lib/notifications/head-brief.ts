// หัวหน้าฝ่ายรับรู้ความเคลื่อนไหวงานทาง Telegram (owner, 17 Nov 2026 — grilled):
//   07:30   สรุปภาพรวม: งานวันนี้/พรุ่งนี้ + ใครไป + สถานะ, เรื่องต้องติดตาม
//           (ยังไม่มีใครรับทราบ / ไม่สะดวก / ยังไม่มอบหมาย) และงานเพิ่ม-แก้ไข-ยกเลิก
//           ตั้งแต่สรุปครั้งก่อน · วันทำการส่งทุกวัน · เสาร์-อาทิตย์เฉพาะวันที่มีงาน
//           · ถึงหัวหน้าฝ่าย + แอดมินทุกคน
//   ทันที   งานเหลือไม่ถึง 24 ชม. แต่ยังไม่มีใครรับทราบ → หัวหน้า + แอดมิน (ครั้งเดียวต่องาน)
//           มีคนแจ้งไม่สะดวก → หัวหน้าได้เพิ่ม (แอดมินได้อยู่แล้ว, alerts.ts)
//   กลางคืน 21:00–07:00 เรื่องด่วนส่งทันทีแบบไม่มีเสียง
// Telegram only (free); read-only, one button to the jobs list. Polite always.
// HEAD_LIVE stays false until the owner has seen the preview (/api/head-brief/preview).

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayInBangkok } from "@/lib/date";
import { claimRun, getAdminRecipientIds, getPeopleByIds, loadTasks, type LinePerson, type TaskItem } from "@/lib/line/data";
import { appUrl } from "@/lib/line/messages";
import { esc, sendTelegram, type TgButton, type TgMessage } from "@/lib/telegram/api";
import { titleFor } from "@/lib/telegram/chat";
import { nickname } from "@/lib/monitor/nicknames";
import { jobIcon } from "@/lib/events/job-icon";

/** คุณสมัชชา ปาลวัตร์ หัวหน้าฝ่ายบริการและเผยแพร่วิชาการ. */
export const HEAD_IDS = ["774174ff-e0cc-4bc5-922e-13fd1b05750d"];
/** Off until the owner approves the preview; then heads + admins get everything below. */
export const HEAD_LIVE = false;
export const BRIEF_WINDOW = { from: 7 * 60 + 30, to: 8 * 60 }; // 07:30–07:59
export const NOBODY_HOURS = 24;

export type BriefPerson = { id: string; name: string; ack: boolean; off: boolean; reason: string | null };
export type BriefJob = { id: string; title: string; icon: string | null; date: string; start: string; place: string; people: BriefPerson[] };
export type BriefChange = { kind: "add" | "edit" | "cancel"; title: string; icon: string | null; date: string; start: string; reason?: string | null };

const ic = (j: { title: string; icon?: string | null }) => jobIcon(j.title, j.icon).emoji;
const dot = (t: string) => t.replace(":", ".");

function dayShort(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00+07:00`));
}

export function bangkokMinutes(now = new Date()): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return (g("hour") % 24) * 60 + g("minute");
}

/** 21:00–07:00: urgent notes still go, without a sound. */
export const isQuietHour = (minutes: number) => minutes >= 21 * 60 || minutes < 7 * 60;

/** Weekdays always; Saturday/Sunday only when there is work today or tomorrow. */
export function briefDue(dateIso: string, jobCount: number): boolean {
  const wd = new Date(`${dateIso}T12:00:00+07:00`).getUTCDay();
  return (wd !== 0 && wd !== 6) || jobCount > 0;
}

/** Nobody on the job has acknowledged it (or nobody is assigned at all). */
export const nobodyYet = (j: BriefJob) => !j.people.some((p) => p.ack);

const markOf = (p: BriefPerson) => (p.ack ? "✅" : p.off ? "⛔" : "⏳");
const peopleLine = (j: BriefJob) => (j.people.length ? j.people.map((p) => `${esc(p.name)} ${markOf(p)}`).join(" · ") : "<i>ยังไม่ได้มอบหมาย</i>");

/** What needs a follow-up, one line per job. */
export function followUps(jobs: BriefJob[]): string[] {
  const out: string[] = [];
  for (const j of jobs) {
    const at = `${dot(j.start)} ${esc(j.title)}`;
    if (!j.people.length) out.push(`• ${at} — ยังไม่ได้มอบหมายผู้รับผิดชอบ`);
    for (const p of j.people.filter((x) => x.off)) out.push(`• ${at} — ${esc(p.name)} ไม่สะดวก${p.reason ? `: ${esc(p.reason)}` : ""}`);
    if (j.people.length && nobodyYet(j) && !j.people.every((p) => p.off)) out.push(`• ${at} — ยังไม่มีใครรับทราบ`);
  }
  return out;
}

export const jobsListButton = (): TgButton => ({ text: "📋 เปิดรายการงาน", web_app: { url: appUrl("/liff/add-event/jobs?tg=1") } });

export function buildHeadBrief(o: { greet: string; today: string; jobs: BriefJob[]; changes: BriefChange[] }): TgMessage {
  const tomorrow = addDays(o.today, 1);
  const todays = o.jobs.filter((j) => j.date === o.today);
  const tomorrows = o.jobs.filter((j) => j.date === tomorrow);
  const block = (j: BriefJob) => [`${ic(j)} <b>${dot(j.start)}</b> ${esc(j.title)}`, `      📍 ${esc(j.place)}`, `      👥 ${peopleLine(j)}`];
  const lines = [`☀️ สวัสดีตอนเช้าครับ ${esc(o.greet)}`, `📋 <b>สรุปงานฝ่าย ปชส.</b> · ${esc(dayShort(o.today))}`];
  lines.push("", `📌 <b>วันนี้</b> · ${todays.length ? `${todays.length} งาน` : "ไม่มีงาน"}`, ...todays.flatMap(block));
  lines.push("", `🗓 <b>พรุ่งนี้</b> · ${esc(dayShort(tomorrow))} · ${tomorrows.length ? `${tomorrows.length} งาน` : "ไม่มีงาน"}`, ...tomorrows.flatMap(block));
  const fu = followUps(o.jobs);
  if (fu.length) lines.push("", `⚠️ <b>ต้องติดตาม</b> · ${fu.length} เรื่อง`, ...fu);
  if (o.changes.length) {
    const head = { add: "➕ เพิ่ม", edit: "✏️ แก้ไข/เลื่อน", cancel: "❌ ยกเลิก" } as const;
    lines.push("", "🔄 <b>ความเคลื่อนไหวตั้งแต่สรุปครั้งก่อน</b>");
    for (const c of o.changes.slice(0, 15)) {
      lines.push(`${head[c.kind]} · ${esc(dayShort(c.date))} ${dot(c.start)} ${ic(c)} ${esc(c.title)}${c.kind === "cancel" && c.reason ? ` (${esc(c.reason)})` : ""}`);
    }
    if (o.changes.length > 15) lines.push(`… และอีก ${o.changes.length - 15} รายการ`);
  }
  if (!fu.length && o.jobs.length) lines.push("", "✅ ทุกงานมีผู้รับทราบแล้วครับ");
  lines.push("", "<i>✅ รับทราบ · ⏳ รอ · ⛔ ไม่สะดวก</i>");
  let text = lines.join("\n");
  if (text.length > 4000) text = `${text.slice(0, 3950)}\n…`;
  return { text, buttons: [[jobsListButton()]] };
}

export function hoursLeft(j: { date: string; start: string }, now = new Date()): number {
  return (Date.parse(`${j.date}T${j.start}:00+07:00`) - now.getTime()) / 3600_000;
}

export function buildNobodyAlert(j: BriefJob, now = new Date()): TgMessage {
  const h = Math.max(0, hoursLeft(j, now));
  const left = h < 1 ? "ไม่ถึง 1 ชม." : `อีกราว ${Math.floor(h)} ชม.`;
  return {
    text: [
      "⏰ <b>งานใกล้ถึง · ยังไม่มีผู้รับทราบ</b>",
      "",
      `${ic(j)} <b>${esc(j.title)}</b>`,
      `🗓 ${esc(dayShort(j.date))} ${dot(j.start)} น. (${left})`,
      `📍 ${esc(j.place)}`,
      `👥 ${peopleLine(j)}`,
    ].join("\n"),
    buttons: [[jobsListButton()], [{ text: "🔎 เปิดงานในระบบ", url: appUrl(`/events/${j.id}`) }]],
  };
}

export function buildHeadIntro(greet: string): TgMessage {
  return {
    text: [
      `🙏 เรียน${esc(greet)}`,
      "ระบบ PR-OS ได้เพิ่มการรายงานความเคลื่อนไหวงานฝ่าย ปชส. ให้ทาง Telegram นี้แล้วครับ",
      "",
      "📋 <b>ทุกเช้า 07:30</b> — สรุปงานวันนี้และพรุ่งนี้ ใครไปงานไหน สถานะการรับทราบ เรื่องที่ต้องติดตาม และงานที่เพิ่ม แก้ไข หรือยกเลิก (เสาร์-อาทิตย์ส่งเฉพาะวันที่มีงาน)",
      "🚨 <b>แจ้งทันที</b> — เมื่อมีผู้แจ้งไม่สะดวก และเมื่องานเหลือไม่ถึง 24 ชม. แต่ยังไม่มีใครรับทราบ (ช่วงกลางคืนส่งแบบไม่มีเสียง)",
      "",
      "<b>วิธีใช้เบื้องต้น</b>",
      "• กดปุ่ม 📋 เปิดรายการงาน ใต้ข้อความ เพื่อดูรายละเอียดงานทั้งหมด",
      "• สัญลักษณ์: ✅ รับทราบแล้ว · ⏳ รอรับทราบ · ⛔ ไม่สะดวก",
      "• ปุ่มด้านล่างแชท \"ทีมวันนี้\" \"ทีมพรุ่งนี้\" \"ใครยังไม่รับทราบ\" กดดูได้ตลอดเวลา",
      "",
      "หากต้องการปรับรูปแบบหรือเวลา แจ้งป๊อปปี้ได้เลยครับ 🙏",
    ].join("\n"),
    buttons: [[jobsListButton()]],
  };
}

// ---- data ------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Published jobs from..to with their people (unassigned jobs included). */
export async function loadBriefJobs(admin: SupabaseClient, from: string, to: string): Promise<BriefJob[]> {
  const [{ data: evs }, tasks] = await Promise.all([
    admin
      .from("events")
      .select("id, title, icon, event_date, start_time, location:locations(name)")
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date")
      .order("start_time"),
    loadTasks(admin, { from, to }),
  ]);
  const byEvent = new Map<string, TaskItem[]>();
  for (const t of tasks) byEvent.set(t.event.id, [...(byEvent.get(t.event.id) ?? []), t]);
  return ((evs ?? []) as any[]).map((e) => ({
    id: e.id,
    title: String(e.title),
    icon: e.icon ?? null,
    date: e.event_date,
    start: String(e.start_time ?? "").slice(0, 5),
    place: String(one<any>(e.location)?.name ?? "—"),
    people: (byEvent.get(e.id) ?? []).map((t) => ({ id: t.personId, name: nickname(t.personId, t.personName), ack: t.acknowledged, off: t.unavailable, reason: t.unavailableReason })),
  }));
}

/** Jobs added, changed or cancelled since `since` (yesterday onward only). */
export async function loadBriefChanges(admin: SupabaseClient, since: string, today: string): Promise<BriefChange[]> {
  const { data } = await admin
    .from("events")
    .select("id, title, icon, event_date, start_time, status, published_at, canceled_at, updated_at, cancellation_reason, deleted_at")
    .or(`published_at.gte.${since},canceled_at.gte.${since},updated_at.gte.${since}`)
    .gte("event_date", addDays(today, -1))
    .order("event_date")
    .order("start_time")
    .limit(60);
  const out: BriefChange[] = [];
  for (const e of (data ?? []) as any[]) {
    if (e.deleted_at) continue;
    const base = { title: String(e.title), icon: e.icon ?? null, date: e.event_date, start: String(e.start_time ?? "").slice(0, 5) };
    if (e.status === "canceled" && e.canceled_at && e.canceled_at >= since) out.push({ kind: "cancel", ...base, reason: e.cancellation_reason });
    else if (e.status === "published" && e.published_at && e.published_at >= since) out.push({ kind: "add", ...base });
    else if (e.status === "published") out.push({ kind: "edit", ...base });
  }
  return out;
}

/** Heads + admins with a Telegram chat, each once. */
export async function headRecipients(admin: SupabaseClient): Promise<LinePerson[]> {
  const ids = [...new Set([...HEAD_IDS, ...(await getAdminRecipientIds(admin))])];
  return (await getPeopleByIds(admin, ids)).filter((p) => p.telegramChatId);
}

async function lastBriefAt(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from("notification_runs").select("created_at").like("run_key", "head:%").order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;
}

/** The brief for one reader (also used by the preview). */
export async function composeBrief(admin: SupabaseClient, reader: { id: string; displayName: string }, today = todayInBangkok(), since?: string): Promise<{ msg: TgMessage; jobs: BriefJob[] }> {
  const jobs = await loadBriefJobs(admin, today, addDays(today, 1));
  const from = since ?? (await lastBriefAt(admin)) ?? new Date(Date.now() - 24 * 3600_000).toISOString();
  const changes = await loadBriefChanges(admin, from, today);
  return { msg: buildHeadBrief({ greet: titleFor(reader.id, reader.displayName), today, jobs, changes }), jobs };
}

/** Scheduler hook (every 5 min, 06:00–20:55). Returns messages sent. */
export async function runHeadDuties(admin: SupabaseClient, now = new Date()): Promise<{ brief: number; nobody: number }> {
  if (!HEAD_LIVE) return { brief: 0, nobody: 0 };
  const today = todayInBangkok();
  const minutes = bangkokMinutes(now);
  const silent = isQuietHour(minutes);
  const people = await headRecipients(admin);
  let brief = 0;
  let nobody = 0;

  if (minutes >= BRIEF_WINDOW.from && minutes < BRIEF_WINDOW.to) {
    const since = (await lastBriefAt(admin)) ?? new Date(now.getTime() - 24 * 3600_000).toISOString();
    const jobs = await loadBriefJobs(admin, today, addDays(today, 1));
    if (briefDue(today, jobs.length)) {
      const changes = await loadBriefChanges(admin, since, today);
      for (const p of people) {
        if (!(await claimRun(admin, `head:${today}:${p.id}`))) continue;
        const r = await sendTelegram(p.telegramChatId!, buildHeadBrief({ greet: titleFor(p.id, p.displayName), today, jobs, changes }));
        if (r.ok) brief += 1;
      }
    }
  }

  // งานเหลือไม่ถึง 24 ชม. แต่ยังไม่มีใครรับทราบ — once per job (per date, in case it moves).
  const soon = (await loadBriefJobs(admin, today, addDays(today, 1))).filter((j) => {
    const h = hoursLeft(j, now);
    return h > 0 && h <= NOBODY_HOURS && nobodyYet(j);
  });
  for (const j of soon) {
    if (!(await claimRun(admin, `nobody:${j.id}:${j.date}`))) continue;
    const msg = { ...buildNobodyAlert(j, now), silent };
    for (const p of people) {
      const r = await sendTelegram(p.telegramChatId!, msg);
      if (r.ok) nobody += 1;
    }
  }
  return { brief, nobody };
}

/** Heads who are not admins get the "ไม่สะดวก" alert too (admins already do). */
export async function tellHeadsUnavailable(admin: SupabaseClient, msg: TgMessage, now = new Date()): Promise<number> {
  if (!HEAD_LIVE) return 0;
  const adminIds = new Set(await getAdminRecipientIds(admin));
  const heads = (await getPeopleByIds(admin, HEAD_IDS.filter((id) => !adminIds.has(id)))).filter((p) => p.telegramChatId);
  let sent = 0;
  for (const h of heads) {
    const r = await sendTelegram(h.telegramChatId!, { ...msg, silent: isQuietHour(bangkokMinutes(now)) });
    if (r.ok) sent += 1;
  }
  return sent;
}
