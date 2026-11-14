// สรุปมุกประกวดให้กรรมการ (พี่เอิร์ธ ยืนยัน 13 Nov 2026 ผ่านป๊อปปี้: "บอทจะเป็นคน
// รวบรวมมุก สรุปรายงานส่งพร้อมรายละเอียด ให้ตัดสินเมื่อครบกำหนด"). When the window
// closes (CONTEST.end) the scheduler sends every admin one numbered list of all the
// jokes — the same "มุกที่ N" the TV used — with sender, time and text, plus a
// per-person tally. Sent once; audit_logs action "contest_report" is the guard.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTEST, contestNumbers } from "@/lib/monitor/contest";
import { getAdminRecipientIds, getPeopleByIds } from "@/lib/line/data";
import { esc, sendTelegram } from "@/lib/telegram/api";
import { nickname } from "@/lib/monitor/nicknames";
import { splitJoke } from "@/lib/tv-jokes";
import { TH_MONTH_SHORT, TH_WEEKDAY_SHORT } from "@/lib/monitor/thai-time";

export type ContestEntry = { id: string; name: string; text: string; at: string; no: number | null; status: "ok" | "no" | "wait" };

const TG_MAX = 3500;

function bkkStamp(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return `${TH_WEEKDAY_SHORT[wd] ?? ""} ${get("day")} ${TH_MONTH_SHORT[Number(get("month")) - 1] ?? ""} ${get("hour")}:${get("minute")}`;
}

/** Report text as Telegram HTML, split into messages under the 4096-char limit. */
export function buildContestReport(entries: ContestEntry[], resultsDay = CONTEST.results): string[] {
  const numbered = entries.filter((e) => e.no !== null).sort((a, b) => a.no! - b.no!);
  const rejected = entries.filter((e) => e.status === "no");
  const tally = new Map<string, number>();
  for (const e of numbered) tally.set(e.name, (tally.get(e.name) ?? 0) + 1);
  const people = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${esc(n)} ${c}`).join(" · ");
  const rd = resultsDay.split("-").map(Number);
  const resultsText = `${TH_WEEKDAY_SHORT[new Date(`${resultsDay}T00:00:00Z`).getUTCDay()]} ${rd[2]} ${TH_MONTH_SHORT[rd[1] - 1]}`;

  const head =
    `🏆 <b>สรุปมุกประกวด · ปิดรับแล้ว</b>\n` +
    `รับมา ${entries.length} มุก · เข้าประกวด ${numbered.length} มุก${rejected.length ? ` (ไม่ใช้ ${rejected.length})` : ""} · จาก ${tally.size} คน\n` +
    `หมายเลขตรงกับที่ขึ้นจอทีวี · ตัดสินแล้วแจ้งป๊อปปี้ จะประกาศบนทีวี ${resultsText}`;
  const lines = numbered.map((e) => {
    const { setup, punch } = splitJoke(e.text);
    return `<b>มุกที่ ${e.no}</b> · ${esc(e.name)} · ${bkkStamp(e.at)}\n${setup ? `${esc(setup)}\n→ ${esc(punch)}` : esc(punch || e.text)}`;
  });
  const foot = numbered.length ? `📊 ส่งต่อคน: ${people}` : "ไม่มีมุกเข้าประกวดครับ";
  const foot2 = rejected.length ? `\n🚫 ไม่ใช้ (ไม่มีหมายเลข): ${rejected.map((e) => `${esc(e.name)} — ${esc(e.text).slice(0, 40)}`).join(" · ")}` : "";

  const out: string[] = [];
  let cur = head;
  for (const l of lines) {
    if (cur.length + l.length + 2 > TG_MAX) {
      out.push(cur);
      cur = l;
    } else cur += `\n\n${l}`;
  }
  const tail = `\n\n${foot}${foot2}`;
  if (cur.length + tail.length > TG_MAX) {
    out.push(cur);
    cur = tail.trim();
  } else cur += tail;
  out.push(cur);
  return out;
}

/** Due once the window has closed; false until then or when it was already sent. */
export function contestReportDue(now: Date, alreadySent: boolean): boolean {
  return !alreadySent && now.getTime() >= Date.parse(CONTEST.end);
}

/** Load every joke of the window with its number and decision. */
export async function loadContestEntries(admin: SupabaseClient): Promise<ContestEntry[]> {
  const { data } = await admin.from("audit_logs").select("id, entity_id, new_values, changed_at").eq("action", "tv_joke").gte("changed_at", CONTEST.start).lte("changed_at", CONTEST.end).order("changed_at", { ascending: true }).limit(1000);
  type Row = { id: string; entity_id: string; new_values: { text?: string } | null; changed_at: string };
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: oks }, { data: nos }] = await Promise.all([
    admin.from("audit_logs").select("entity_id").eq("action", "tv_joke_ok").in("entity_id", ids),
    admin.from("audit_logs").select("entity_id").eq("action", "tv_joke_no").in("entity_id", ids),
  ]);
  const ok = new Set((oks ?? []).map((r: { entity_id: string }) => r.entity_id));
  const no = new Set((nos ?? []).map((r: { entity_id: string }) => r.entity_id));
  const nums = contestNumbers(rows.map((r) => ({ id: r.id, at: r.changed_at })), no);
  const people = await getPeopleByIds(admin, [...new Set(rows.map((r) => r.entity_id))]);
  const nameOf = new Map(people.map((p) => [p.id, nickname(p.id, p.displayName)]));
  return rows.map((r) => ({
    id: r.id,
    name: nameOf.get(r.entity_id) ?? "ทีม ปชส.",
    text: String(r.new_values?.text ?? ""),
    at: r.changed_at,
    no: nums.get(r.id) ?? null,
    status: no.has(r.id) ? "no" : ok.has(r.id) ? "ok" : "wait",
  }));
}

/** Scheduler hook: send the report to the admins once the window has closed. Returns messages sent. */
export async function sendContestReport(admin: SupabaseClient, now = new Date()): Promise<number> {
  const { data: done } = await admin.from("audit_logs").select("id").eq("action", "contest_report").eq("entity_id", CONTEST.end).limit(1);
  if (!contestReportDue(now, (done ?? []).length > 0)) return 0;
  const entries = await loadContestEntries(admin);
  const parts = buildContestReport(entries);
  const ids = await getAdminRecipientIds(admin);
  const admins = (await getPeopleByIds(admin, ids)).filter((p) => p.telegramChatId);
  // Guard first so two overlapping runs never send it twice.
  await admin.from("audit_logs").insert({ entity_type: "contest", entity_id: CONTEST.end, action: "contest_report", changed_by: null, summary: `ส่งสรุปมุกประกวดให้กรรมการ ${admins.length} คน`, new_values: { jokes: entries.length, parts: parts.length } });
  let sent = 0;
  for (const p of admins) {
    for (const text of parts) {
      const r = await sendTelegram(p.telegramChatId!, { text });
      if (r.ok) sent += 1;
    }
  }
  return sent;
}
