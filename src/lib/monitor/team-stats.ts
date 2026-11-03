// TV header stats (owner, 3 Nov 2026: "สถิติในมุมเล็ก ๆ บนหน้าจอมอนิเตอร์" —
// team output this month + how fast the team acknowledges, a small, pretty
// animation, next to the clock). Team totals only, never a name.
//   month   jobs done this month (published, date ≤ today) · person-slots
//   ack     last 7 days: share of assignment notices acknowledged ·
//           median minutes from the notice to the tap · the fastest
//           tapper's face (owner asked for it: praise, not blame)
// Test jobs ("ทดสอบ" in the title) are left out.

import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamStats = {
  month: { jobs: number; slots: number; label: string };
  ack: { rate: number | null; medianMin: number | null; sent: number; fastest?: { personId: string; minutes: number } | null };
};

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const isTestTitle = (t: string | null | undefined) => /ทดสอบ/.test(t ?? "");

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Notices sent in the window vs. the first acknowledgement after each one. */
export function ackStats(
  sent: Array<{ assignmentId: string; sentAt: string; personId?: string | null }>,
  acks: Array<{ assignmentId: string; at: string }>,
  now = Date.now(),
): TeamStats["ack"] {
  // A notice under an hour old has not had a fair chance yet.
  const fair = sent.filter((s) => now - Date.parse(s.sentAt) >= 3600_000);
  if (!fair.length) return { rate: null, medianMin: null, sent: 0, fastest: null };
  const ackTimes = new Map<string, number[]>();
  for (const a of acks) ackTimes.set(a.assignmentId, [...(ackTimes.get(a.assignmentId) ?? []), Date.parse(a.at)]);
  const mins: number[] = [];
  let acked = 0;
  let fastest: { personId: string; minutes: number } | null = null;
  for (const s of fair) {
    const sentAt = Date.parse(s.sentAt);
    // The first tap after this notice (a minute of clock slack).
    const after = (ackTimes.get(s.assignmentId) ?? []).filter((t) => t >= sentAt - 60_000);
    if (!after.length) continue;
    acked++;
    const m = Math.max(0, (Math.min(...after) - sentAt) / 60_000);
    mins.push(m);
    if (s.personId && (!fastest || m < fastest.minutes)) fastest = { personId: s.personId, minutes: m };
  }
  const med = median(mins);
  return {
    rate: Math.round((acked / fair.length) * 100),
    medianMin: med === null ? null : Math.max(1, Math.round(med)),
    sent: fair.length,
    fastest: fastest ? { personId: fastest.personId, minutes: Math.max(1, Math.round(fastest.minutes)) } : null,
  };
}

export async function loadTeamStats(admin: SupabaseClient, todayIso: string, now = Date.now()): Promise<TeamStats> {
  const [y, m] = todayIso.split("-").map(Number);
  const monthStart = `${todayIso.slice(0, 7)}-01`;

  const { data: evs } = await admin
    .from("events")
    .select("id, title")
    .eq("status", "published")
    .is("deleted_at", null)
    .gte("event_date", monthStart)
    .lte("event_date", todayIso);
  const real = (evs ?? []).filter((e) => !isTestTitle(e.title));
  let slots = 0;
  if (real.length) {
    const { count } = await admin
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("assignment_status", "assigned")
      .in("event_id", real.map((e) => e.id));
    slots = count ?? 0;
  }

  const since = new Date(now - 7 * 24 * 3600_000).toISOString();
  const { data: notes } = await admin
    .from("notifications")
    .select("assignment_id, person_id, sent_at, event:events(title, deleted_at)")
    .eq("notification_type", "assignment")
    .eq("status", "sent")
    .gte("sent_at", since)
    .not("assignment_id", "is", null);
  const sent = ((notes ?? []) as unknown as Array<{ assignment_id: string; person_id: string | null; sent_at: string; event: { title: string; deleted_at: string | null } | null }>)
    .filter((n) => n.event && !n.event.deleted_at && !isTestTitle(n.event.title))
    .map((n) => ({ assignmentId: n.assignment_id, sentAt: n.sent_at, personId: n.person_id }));
  let acks: Array<{ assignmentId: string; at: string }> = [];
  if (sent.length) {
    const { data: k } = await admin
      .from("acknowledgements")
      .select("assignment_id, acknowledged_at")
      .in("assignment_id", [...new Set(sent.map((s) => s.assignmentId))]);
    acks = (k ?? []).map((r) => ({ assignmentId: r.assignment_id as string, at: r.acknowledged_at as string }));
  }

  return {
    month: { jobs: real.length, slots, label: `${THAI_MONTHS[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}` },
    ack: ackStats(sent, acks, now),
  };
}
