// ใบสรุปผลการปฏิบัติงานรายบุคคล ประกอบการประเมิน (owner, 4 Nov 2026 · เลือกแบบ C).
// One person, one range (usually an appraisal round). `computePersonSheet` is pure
// (unit-tested); `loadPersonSheet` reads the rows with the service-role client —
// the page must check can.viewReports before calling it.
//
// Rules (also printed in the sheet's footer):
//   งาน          = assignments (status assigned) on published/completed jobs in range,
//                  no "ทดสอบ" titles
//   ชั่วโมง       = end − start; a job without an end time is counted, not timed
//   นอกเวลา       = a weekday job starting before 08:30 or ending after 16:30;
//                  weekend = Sat/Sun by date (its whole time counts as outside hours)
//   รับทราบ       = acknowledged ÷ cards that actually reached them; a card skipped
//                  because they had no Telegram/LINE is "ไม่ได้รับแจ้ง", never a miss
//   ช่วยเพื่อน     = joined a job after someone else on it pressed ไม่สะดวก
//   ลงงานเอง      = jobs they created themselves (not counted for heads/admins)

import { todayInBangkok } from "@/lib/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isTestTitle } from "@/lib/monitor/team-stats";
import { BADGE_LABEL, type BadgeKey } from "@/lib/monitor/badges";
import { getAdminRecipientIds } from "@/lib/line/data";

export type SheetJob = {
  eventId: string;
  title: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string | null;
  urgent: boolean;
  dept: string;
  people: number;
  roles: string[];
  sentAt: string | null; // first card that reached them
  ackAt: string | null;
  unreached: boolean; // skipped "ยังไม่ผูก…", never sent
  helped: boolean;
  attachments: number;
};

export type SheetInput = {
  from: string;
  to: string;
  jobs: SheetJob[];
  selfAdded: number;
  /** jobs per staff member in the same range, for the team average (this person included). */
  teamJobs: number[];
  badges: Array<{ month: string; badges: BadgeKey[] }>;
};

export type PersonSheet = {
  jobs: number;
  hours: number;
  untimed: number;
  afterHours: number;
  weekend: number;
  outsideHours: number;
  urgent: number;
  reached: number;
  acked: number;
  ackRate: number | null;
  ackMedianMin: number | null;
  unreached: number;
  helped: number;
  selfAdded: number;
  attachments: number;
  teamAvgJobs: number | null;
  teamAvgPerMonth: number | null;
  months: Array<{ key: string; label: string; count: number }>;
  roles: Array<{ name: string; count: number }>;
  depts: Array<{ name: string; count: number }>;
  top: Array<{ date: string; title: string; roles: string; dept: string; urgent: boolean }>;
  badges: Array<{ label: string; months: number }>;
};

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const DAY_START = 8 * 60 + 30;
const DAY_END = 16 * 60 + 30;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function monthsBetween(from: string, to: string): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  for (let guard = 0; guard < 24; guard++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > end) break;
    out.push({ key, label: TH_MONTHS[m - 1] });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const isWeekend = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};

const tally = (xs: string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
};

export function computePersonSheet(input: SheetInput): PersonSheet {
  const jobs = input.jobs;
  let minutes = 0;
  let untimed = 0;
  let afterHours = 0;
  let weekend = 0;
  let outside = 0;
  for (const j of jobs) {
    const s = toMin(j.start);
    if (!j.end) {
      untimed += 1;
      if (isWeekend(j.date)) weekend += 1;
      else if (s < DAY_START) afterHours += 1;
      continue;
    }
    let e = toMin(j.end);
    if (e < s) e += 24 * 60; // past midnight
    const dur = e - s;
    minutes += dur;
    if (isWeekend(j.date)) {
      weekend += 1;
      outside += dur;
    } else {
      const out = Math.max(0, Math.min(e, DAY_START) - s) + Math.max(0, e - Math.max(s, DAY_END));
      if (s < DAY_START || e > DAY_END) afterHours += 1;
      outside += out;
    }
  }

  const reached = jobs.filter((j) => j.sentAt);
  const acked = reached.filter((j) => j.ackAt);
  const waits = acked.map((j) => Math.max(0, (Date.parse(j.ackAt!) - Date.parse(j.sentAt!)) / 60000));

  const span = monthsBetween(input.from, input.to);
  const perMonth = new Map(span.map((m) => [m.key, 0]));
  for (const j of jobs) {
    const k = j.date.slice(0, 7);
    if (perMonth.has(k)) perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
  }

  const team = input.teamJobs.filter((n) => n >= 0);
  const teamAvg = team.length ? team.reduce((a, b) => a + b, 0) / team.length : null;

  const top = [...jobs]
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.people - a.people || a.date.localeCompare(b.date))
    .slice(0, 5)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((j) => ({ date: j.date, title: j.title, roles: j.roles.join(" · "), dept: j.dept, urgent: j.urgent }));

  const badgeCount = new Map<BadgeKey, Set<string>>();
  for (const b of input.badges) for (const k of b.badges) {
    const set = badgeCount.get(k) ?? new Set<string>();
    set.add(b.month);
    badgeCount.set(k, set);
  }

  const round1 = (x: number) => Math.round(x * 10) / 10;
  return {
    jobs: jobs.length,
    hours: round1(minutes / 60),
    untimed,
    afterHours,
    weekend,
    outsideHours: round1(outside / 60),
    urgent: jobs.filter((j) => j.urgent).length,
    reached: reached.length,
    acked: acked.length,
    ackRate: reached.length ? acked.length / reached.length : null,
    ackMedianMin: waits.length ? Math.round(median(waits)!) : null,
    unreached: jobs.filter((j) => j.unreached && !j.ackAt).length,
    helped: jobs.filter((j) => j.helped).length,
    selfAdded: input.selfAdded,
    attachments: jobs.reduce((a, j) => a + j.attachments, 0),
    teamAvgJobs: teamAvg === null ? null : round1(teamAvg),
    teamAvgPerMonth: teamAvg === null || !span.length ? null : round1(teamAvg / span.length),
    months: span.map((m) => ({ ...m, count: perMonth.get(m.key) ?? 0 })),
    roles: tally(jobs.flatMap((j) => j.roles)),
    depts: tally(jobs.map((j) => j.dept)),
    top,
    badges: [...badgeCount].map(([k, months]) => ({ label: BADGE_LABEL[k], months: months.size })),
  };
}

// ---------------------------------------------------------------- loader

export type SheetPerson = { id: string; name: string; position: string; avatarOff: boolean };

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

async function chunked<T>(ids: string[], fn: (part: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await fn(ids.slice(i, i + 200));
    if (error) throw new Error(`person-sheet: ${(error as { message?: string }).message ?? error}`);
    out.push(...(data ?? []));
  }
  return out;
}

export async function loadPersonSheet(
  admin: SupabaseClient,
  personId: string,
  from: string,
  to: string,
): Promise<{ person: SheetPerson; sheet: PersonSheet } | null> {
  const { data: p } = await admin.from("people").select("id, display_name, position, metadata").eq("id", personId).maybeSingle();
  if (!p) return null;
  const person: SheetPerson = {
    id: p.id,
    name: p.display_name,
    position: p.position ?? "",
    avatarOff: (p.metadata as { avatar?: string } | null)?.avatar === "off",
  };

  const { data: evRows, error: evErr } = await admin
    .from("events")
    .select("id, title, event_date, start_time, end_time, status, urgency, metadata, owner_department:departments(short_name, name)")
    .is("deleted_at", null)
    .in("status", ["published", "completed"])
    .gte("event_date", from)
    // Work done = up to today; jobs booked later in the round are not "ปฏิบัติ" yet.
    .lte("event_date", to < todayInBangkok() ? to : todayInBangkok())
    .limit(5000);
  if (evErr) throw new Error(`person-sheet events: ${evErr.message}`);
  const events = ((evRows ?? []) as any[]).filter((e) => !isTestTitle(e.title));
  const evById = new Map(events.map((e) => [e.id as string, e]));
  const evIds = [...evById.keys()];

  const asg = await chunked<any>(evIds, (part) =>
    admin
      .from("assignments")
      .select("id, event_id, person_id, assignment_version, assignment_status, created_at, unavailable_at, role_names, role:roles(name), acknowledgements(assignment_version, acknowledged_at), person:people(display_name, is_active)")
      .in("event_id", part),
  );
  const live = asg.filter((a) => a.assignment_status === "assigned" && !String(one<any>(a.person)?.display_name ?? "").startsWith("[ทดสอบ]"));
  const mine = live.filter((a) => a.person_id === personId);
  const mineIds = mine.map((a) => a.id as string);

  const notes = await chunked<any>(mineIds, (part) =>
    admin.from("notifications").select("assignment_id, status, error_message, sent_at").in("assignment_id", part).in("status", ["sent", "skipped"]),
  );
  const firstSent = new Map<string, string>();
  const unlinked = new Set<string>();
  for (const n of notes) {
    if (n.status === "sent" && n.sent_at) {
      const prev = firstSent.get(n.assignment_id);
      if (!prev || n.sent_at < prev) firstSent.set(n.assignment_id, n.sent_at);
    } else if (n.status === "skipped" && String(n.error_message ?? "").includes("ยังไม่ผูก")) unlinked.add(n.assignment_id);
  }

  const myEventIds = [...new Set(mine.map((a) => a.event_id as string))];
  const files = await chunked<any>(myEventIds, (part) => admin.from("event_attachments").select("event_id").is("deleted_at", null).in("event_id", part));
  const filesPer = new Map<string, number>();
  for (const f of files) filesPer.set(f.event_id, (filesPer.get(f.event_id) ?? 0) + 1);

  const peoplePer = new Map<string, number>();
  for (const a of live) peoplePer.set(a.event_id, (peoplePer.get(a.event_id) ?? 0) + 1);

  const jobs: SheetJob[] = mine.map((a) => {
    const e = evById.get(a.event_id);
    const acks = Array.isArray(a.acknowledgements) ? a.acknowledgements : [];
    const ack = acks.find((k: any) => k.assignment_version === a.assignment_version);
    const joined = Date.parse(a.created_at);
    const helped = live.some((b) => b.event_id === a.event_id && b.person_id !== personId && b.unavailable_at && Date.parse(b.unavailable_at) < joined);
    const dept = one<any>(e.owner_department);
    const roles = String(a.role_names ?? one<any>(a.role)?.name ?? "—")
      .split(" · ")
      .map((r) => r.trim())
      .filter(Boolean);
    return {
      eventId: e.id,
      title: e.title,
      date: e.event_date,
      start: String(e.start_time ?? "00:00").slice(0, 5),
      end: e.end_time ? String(e.end_time).slice(0, 5) : null,
      urgent: e.urgency && e.urgency !== "normal",
      dept: dept?.short_name || dept?.name || "ไม่ระบุหน่วยงาน",
      people: peoplePer.get(a.event_id) ?? 1,
      roles,
      sentAt: firstSent.get(a.id) ?? null,
      ackAt: ack?.acknowledged_at ?? null,
      unreached: !firstSent.has(a.id) && unlinked.has(a.id),
      helped,
      attachments: filesPer.get(a.event_id) ?? 0,
    };
  });

  // Team: active staff (no admin / TV / test / demo accounts).
  const [{ data: staff }, { data: profiles }, headList] = await Promise.all([
    admin.from("people").select("id, display_name").eq("is_active", true),
    admin.from("profiles").select("person_id, role"),
    getAdminRecipientIds(admin),
  ]);
  const roleOf = new Map(((profiles ?? []) as any[]).map((r) => [r.person_id, r.role]));
  const team = ((staff ?? []) as any[]).filter(
    (s) => roleOf.get(s.id) !== "admin" && roleOf.get(s.id) !== "display" && s.display_name !== "ป๊อปปี้" && !String(s.display_name).startsWith("[ทดสอบ]"),
  );
  const perPerson = new Map(team.map((s) => [s.id as string, 0]));
  for (const a of live) if (perPerson.has(a.person_id)) perPerson.set(a.person_id, (perPerson.get(a.person_id) ?? 0) + 1);

  const heads = new Set([...headList, ...[...roleOf].filter(([, r]) => r === "admin").map(([id]) => id as string)]);
  const selfAdded = heads.has(personId) ? 0 : events.filter((e) => (e.metadata as { created_by_person_id?: string } | null)?.created_by_person_id === personId).length;

  const { data: logs } = await admin.from("audit_logs").select("new_values").eq("action", "badge_awarded").eq("entity_id", personId);
  const badges = ((logs ?? []) as any[])
    .map((l) => ({ month: String(l.new_values?.month ?? ""), badges: (l.new_values?.badges ?? []) as BadgeKey[] }))
    .filter((b) => b.month >= from.slice(0, 7) && b.month <= to.slice(0, 7));

  return { person, sheet: computePersonSheet({ from, to, jobs, selfAdded, teamJobs: [...perPerson.values()], badges }) };
}
