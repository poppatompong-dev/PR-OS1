// Tell people when they earn a badge (owner, 3 Nov 2026: "บอกสั้น ๆ" — at most
// one message a week per person, never 21:00–07:59). Runs from the
// notification processor, once an hour. Only the current month's badges are
// announced; the record is an audit row per person, month and badge.

import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGE_LABEL, loadBench, type BadgeKey } from "@/lib/monitor/badges";
import { claimRun } from "@/lib/line/data";
import { esc, sendTelegram } from "@/lib/telegram/api";

const WEEK = 7 * 24 * 3600_000;

export function badgeMessage(name: string, badges: BadgeKey[], monthLabel: string): string {
  return [
    `🎉 <b>ยินดีด้วยครับ${esc(name)}</b>`,
    `ได้เหรียญประจำเดือน ${esc(monthLabel)}: ${badges.map((b) => esc(BADGE_LABEL[b])).join(" · ")}`,
    "ขึ้นจอทีวีแล้วนะครับ 🙌",
  ].join("\n");
}

export async function announceBadges(admin: SupabaseClient, todayIso: string, now = Date.now()): Promise<number> {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date(now)));
  if (hour < 8 || hour >= 21) return 0;
  if (Number(todayIso.slice(8, 10)) <= 7) return 0; // the bench still shows last month
  if (!(await claimRun(admin, `badges:${todayIso}:${hour}`))) return 0;

  const bench = await loadBench(admin, todayIso, now);
  const { data: logs } = await admin
    .from("audit_logs")
    .select("entity_id, new_values, changed_at")
    .eq("action", "badge_awarded")
    .gte("changed_at", new Date(now - 45 * 24 * 3600_000).toISOString());
  const rows = (logs ?? []) as Array<{ entity_id: string; new_values: { month?: string; badges?: BadgeKey[] }; changed_at: string }>;

  let sent = 0;
  for (const p of bench.people) {
    const had = new Set(rows.filter((r) => r.entity_id === p.personId && r.new_values?.month === bench.month).flatMap((r) => r.new_values?.badges ?? []));
    const fresh = p.badges.filter((b) => !had.has(b));
    if (!fresh.length) continue;
    const lastTold = Math.max(0, ...rows.filter((r) => r.entity_id === p.personId).map((r) => Date.parse(r.changed_at)));
    if (now - lastTold < WEEK) continue; // tell them later, together
    const { data: person } = await admin.from("people").select("telegram_chat_id").eq("id", p.personId).maybeSingle();
    if (person?.telegram_chat_id) {
      const res = await sendTelegram(Number(person.telegram_chat_id), { text: badgeMessage(p.name, fresh, bench.monthLabel) });
      if (!res.ok) continue;
      sent++;
    }
    await admin.from("audit_logs").insert({
      entity_type: "person",
      entity_id: p.personId,
      action: "badge_awarded",
      changed_by: null,
      summary: `ได้เหรียญ ${fresh.map((b) => BADGE_LABEL[b]).join(", ")} (${bench.monthLabel})`,
      new_values: { month: bench.month, badges: fresh, told: Boolean(person?.telegram_chat_id) },
    });
  }
  return sent;
}
