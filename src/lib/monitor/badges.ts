// "ม้านั่งทีม" on the TV + monthly badges (owner, 3 Nov 2026: staff come to
// look at the TV because they like the cartoons; chose layout B, without the
// admin). Badges are praise only — nobody is ever shown as behind.
//   job5 / job10 / job15  ขยันออกงาน (bronze / silver / gold): jobs done this month
//   fast                  ไวทันใจ: every assignment notice (≥2) acknowledged within 30 min
//   help                  เพื่อนช่วยเพื่อน: joined a job after someone on it said ไม่สะดวก
//   self                  ลงงานเอง: added a job themselves (not the head of PR / admins)
// Days 1–7 of a month still show last month's badges, so the bench is never bare.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminRecipientIds } from "@/lib/line/data";
import { shortName } from "@/lib/names";
import { isTestTitle } from "@/lib/monitor/team-stats";

export type BadgeKey = "job5" | "job10" | "job15" | "fast" | "help" | "self";

export const BADGE_LABEL: Record<BadgeKey, string> = {
  job5: "🏅 ขยันออกงาน (ทองแดง)",
  job10: "🏅 ขยันออกงาน (เงิน)",
  job15: "🏅 ขยันออกงาน (ทอง)",
  fast: "⚡ ไวทันใจ",
  help: "🤝 เพื่อนช่วยเพื่อน",
  self: "✍️ ลงงานเอง",
};

export type BenchPerson = { personId: string; name: string; avatarOff: boolean; out: boolean; badges: BadgeKey[] };
export type Bench = { monthLabel: string; month: string; people: BenchPerson[] };

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** What the TV calls each person (first name when not listed). */
const NICKNAMES: Record<string, string> = {
  "00000000-0000-0000-0000-000000000501": "พี่ไป๋",
  "00000000-0000-0000-0000-000000000502": "พี่เอิร์ธ",
  "00000000-0000-0000-0000-000000000503": "กุ๊ก",
  "00000000-0000-0000-0000-000000000504": "นัท",
  "00000000-0000-0000-0000-000000000505": "แป้ง",
  "00000000-0000-0000-0000-000000000506": "แข",
  "dd5a7eb4-d62a-45bc-b11b-33dae93d6b49": "พัท",
  "1b378ad3-73a3-461c-985e-b1d52189dbee": "พี่เอ๋",
};
export const nickname = (id: string, displayName: string) => NICKNAMES[id] ?? shortName(displayName);

/** The month whose badges are on show: last month during days 1–7. */
export function shownMonth(todayIso: string): { start: string; end: string; key: string; label: string } {
  let y = Number(todayIso.slice(0, 4));
  let m = Number(todayIso.slice(5, 7));
  const day = Number(todayIso.slice(8, 10));
  if (day <= 7) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const key = `${y}-${String(m).padStart(2, "0")}`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthEnd = `${key}-${String(last).padStart(2, "0")}`;
  return { start: `${key}-01`, end: monthEnd < todayIso ? monthEnd : todayIso, key, label: `${THAI_MONTHS[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}` };
}

export function jobBadge(n: number): BadgeKey | null {
  return n >= 15 ? "job15" : n >= 10 ? "job10" : n >= 5 ? "job5" : null;
}

/** ⚡: at least two fair notices, every one acknowledged within 30 minutes. */
export function isFast(notices: Array<{ sentAt: number; ackAt: number | null }>, now: number): boolean {
  const fair = notices.filter((n) => now - n.sentAt >= 3600_000);
  return fair.length >= 2 && fair.every((n) => n.ackAt !== null && n.ackAt - n.sentAt <= 30 * 60_000);
}

type Ev = { id: string; title: string; event_date: string; status: string; metadata: Record<string, unknown> | null; created_at: string };

export async function loadBench(admin: SupabaseClient, todayIso: string, now = Date.now()): Promise<Bench> {
  const mon = shownMonth(todayIso);

  const { data: peopleRows } = await admin.from("people").select("id, display_name, metadata").eq("is_active", true);
  const { data: profiles } = await admin.from("profiles").select("person_id, role");
  const roleOf = new Map((profiles ?? []).map((p: { person_id: string | null; role: string }) => [p.person_id, p.role]));
  const team = (peopleRows ?? []).filter(
    (p: { id: string; display_name: string }) =>
      roleOf.get(p.id) !== "admin" && roleOf.get(p.id) !== "display" && p.display_name !== "ป๊อปปี้" && !p.display_name.startsWith("[ทดสอบ]"),
  ) as Array<{ id: string; display_name: string; metadata: { avatar?: string } | null }>;
  const ids = new Set(team.map((p) => p.id));
  const headIds = new Set([...(await getAdminRecipientIds(admin)), ...[...roleOf].filter(([, r]) => r === "admin").map(([id]) => id as string)]);

  // Jobs in the month (published, not test) and their assignments.
  const { data: evRows } = await admin
    .from("events")
    .select("id, title, event_date, status, metadata, created_at")
    .is("deleted_at", null)
    .gte("event_date", mon.start)
    .lte("event_date", mon.end);
  const evs = ((evRows ?? []) as Ev[]).filter((e) => !isTestTitle(e.title));
  const published = evs.filter((e) => e.status === "published");
  const evIds = published.map((e) => e.id);

  const jobs = new Map<string, number>();
  const helped = new Set<string>();
  if (evIds.length) {
    const { data: asg } = await admin
      .from("assignments")
      .select("event_id, person_id, created_at, unavailable_at, assignment_status")
      .in("event_id", evIds);
    const rows = (asg ?? []) as Array<{ event_id: string; person_id: string; created_at: string; unavailable_at: string | null; assignment_status: string }>;
    for (const a of rows) if (a.assignment_status === "assigned") jobs.set(a.person_id, (jobs.get(a.person_id) ?? 0) + 1);
    for (const a of rows) {
      if (a.assignment_status !== "assigned") continue;
      const joined = Date.parse(a.created_at);
      const covered = rows.some((b) => b.event_id === a.event_id && b.person_id !== a.person_id && b.unavailable_at && Date.parse(b.unavailable_at) < joined);
      if (covered) helped.add(a.person_id);
    }
  }

  // Jobs people added themselves this month (by when they were added).
  const { data: added } = await admin
    .from("events")
    .select("title, metadata, created_at")
    .is("deleted_at", null)
    .gte("created_at", `${mon.start}T00:00:00+07:00`)
    .lte("created_at", `${mon.end}T23:59:59+07:00`);
  const selfers = new Set<string>();
  for (const e of (added ?? []) as Array<{ title: string; metadata: { created_by_person_id?: string } | null }>) {
    const by = e.metadata?.created_by_person_id;
    if (by && !isTestTitle(e.title) && !headIds.has(by)) selfers.add(by);
  }

  // ⚡ from assignment notices sent in the month.
  const { data: notes } = await admin
    .from("notifications")
    .select("assignment_id, person_id, sent_at, event:events(title, deleted_at)")
    .eq("notification_type", "assignment")
    .eq("status", "sent")
    .gte("sent_at", `${mon.start}T00:00:00+07:00`)
    .lte("sent_at", `${mon.end}T23:59:59+07:00`)
    .not("assignment_id", "is", null);
  const noteRows = ((notes ?? []) as unknown as Array<{ assignment_id: string; person_id: string; sent_at: string; event: { title: string; deleted_at: string | null } | null }>).filter(
    (n) => n.event && !n.event.deleted_at && !isTestTitle(n.event.title),
  );
  const ackAt = new Map<string, number[]>();
  if (noteRows.length) {
    const { data: k } = await admin
      .from("acknowledgements")
      .select("assignment_id, acknowledged_at")
      .in("assignment_id", [...new Set(noteRows.map((n) => n.assignment_id))]);
    for (const r of (k ?? []) as Array<{ assignment_id: string; acknowledged_at: string }>)
      ackAt.set(r.assignment_id, [...(ackAt.get(r.assignment_id) ?? []), Date.parse(r.acknowledged_at)]);
  }
  const perPerson = new Map<string, Array<{ sentAt: number; ackAt: number | null }>>();
  for (const n of noteRows) {
    const sentAt = Date.parse(n.sent_at);
    const after = (ackAt.get(n.assignment_id) ?? []).filter((t) => t >= sentAt - 60_000);
    perPerson.set(n.person_id, [...(perPerson.get(n.person_id) ?? []), { sentAt, ackAt: after.length ? Math.min(...after) : null }]);
  }

  // Who is out on a job today.
  const { data: todayAsg } = await admin
    .from("assignments")
    .select("person_id, event:events!inner(event_date, status, deleted_at, title)")
    .eq("assignment_status", "assigned")
    .eq("event.event_date", todayIso)
    .eq("event.status", "published")
    .is("event.deleted_at", null);
  const out = new Set(
    ((todayAsg ?? []) as unknown as Array<{ person_id: string; event: { title: string } }>).filter((a) => !isTestTitle(a.event.title)).map((a) => a.person_id),
  );

  const people: BenchPerson[] = team
    .map((p) => {
      const badges: BadgeKey[] = [];
      const jb = jobBadge(jobs.get(p.id) ?? 0);
      if (jb) badges.push(jb);
      if (isFast(perPerson.get(p.id) ?? [], now)) badges.push("fast");
      if (helped.has(p.id)) badges.push("help");
      if (selfers.has(p.id)) badges.push("self");
      return { personId: p.id, name: nickname(p.id, p.display_name), avatarOff: p.metadata?.avatar === "off", out: out.has(p.id), badges };
    })
    .filter((p) => ids.has(p.personId))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

  return { month: mon.key, monthLabel: mon.label, people };
}
