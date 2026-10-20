/* eslint-disable @typescript-eslint/no-explicit-any */
// Everything the admin's per-person page shows. Call only after an admin
// check: it reads with the service-role client (people.line_user_id, other
// people's acknowledgements and LINE history are not readable under RLS).

import { createAdminClient } from "@/lib/supabase/server";
import { addDays, todayInBangkok } from "@/lib/date";
import type { AppRole } from "@/lib/auth/roles";
import { getAuthUserInfo, getLineLinkTimes } from "@/lib/settings/queries";

const one = (v: any) => (Array.isArray(v) ? v[0] : v);

export type PersonAccount = {
  id: string;
  username: string | null;
  role: AppRole;
  lastSignInAt: string | null;
  suspended: boolean;
};

export type PersonTask = {
  assignmentId: string;
  eventId: string;
  title: string;
  eventDate: string;
  startTime: string;
  eventStatus: string;
  roleName: string;
  ack: "acknowledged" | "unavailable" | "pending";
  unavailableReason: string | null;
};

export type PersonNotification = {
  id: string;
  type: string;
  status: string;
  at: string;
  eventTitle: string;
  error: string | null;
};

export type PersonAudit = { id: string; action: string; summary: string; at: string };

export type PersonDetail = {
  id: string;
  displayName: string;
  position: string;
  email: string | null;
  isActive: boolean;
  lineLinked: boolean;
  lineLinkedAt: string | null;
  accounts: PersonAccount[];
  upcoming: PersonTask[];
  past30: { assigned: number; acknowledged: number; unavailable: number };
  notifications: PersonNotification[];
  audit: PersonAudit[];
};

const TASK_SELECT = `
  id, assignment_version, unavailable_at, unavailable_reason,
  role:roles(name),
  acknowledgements(assignment_version),
  event:events!inner(id, title, event_date, start_time, status, deleted_at)
`;

function toTask(a: any): PersonTask | null {
  const ev = one(a.event);
  if (!ev || ev.deleted_at) return null;
  const acks = Array.isArray(a.acknowledgements) ? a.acknowledgements : [];
  const acknowledged = acks.some((k: any) => k.assignment_version === a.assignment_version);
  return {
    assignmentId: a.id,
    eventId: ev.id,
    title: ev.title,
    eventDate: ev.event_date,
    startTime: String(ev.start_time ?? "").slice(0, 5),
    eventStatus: ev.status,
    roleName: one(a.role)?.name ?? "—",
    ack: acknowledged ? "acknowledged" : a.unavailable_at ? "unavailable" : "pending",
    unavailableReason: a.unavailable_reason ?? null,
  };
}

export async function getPersonDetail(personId: string): Promise<PersonDetail | null> {
  const admin = createAdminClient();
  const { data: person, error } = await admin
    .from("people")
    .select("id, display_name, position_title:position, email, is_active, line_user_id")
    .eq("id", personId)
    .maybeSingle();
  if (error) throw new Error(`getPersonDetail: ${error.message}`);
  if (!person) return null;

  const today = todayInBangkok();
  const [profiles, authInfo, linkTimes, upcoming, past, notes, audit] = await Promise.all([
    admin.from("profiles").select("id, username, role").eq("person_id", personId),
    getAuthUserInfo(),
    getLineLinkTimes([personId]),
    admin
      .from("assignments")
      .select(TASK_SELECT)
      .eq("person_id", personId)
      .eq("assignment_status", "assigned")
      .gte("event.event_date", today)
      .lte("event.event_date", addDays(today, 30))
      .in("event.status", ["published", "draft"]),
    admin
      .from("assignments")
      .select(TASK_SELECT)
      .eq("person_id", personId)
      .eq("assignment_status", "assigned")
      .gte("event.event_date", addDays(today, -30))
      .lt("event.event_date", today)
      .in("event.status", ["published", "completed"]),
    admin
      .from("notifications")
      .select("id, notification_type, status, scheduled_for, sent_at, created_at, error_message, event:events(title)")
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("audit_logs")
      .select("id, action, summary, changed_at")
      .eq("entity_type", "person")
      .eq("entity_id", personId)
      .order("changed_at", { ascending: false })
      .limit(15),
  ]);

  const byTime = (x: PersonTask, y: PersonTask) =>
    `${x.eventDate}${x.startTime}`.localeCompare(`${y.eventDate}${y.startTime}`);
  const upcomingTasks = ((upcoming.data as any[]) ?? []).map(toTask).filter((t): t is PersonTask => t !== null).sort(byTime);
  const pastTasks = ((past.data as any[]) ?? []).map(toTask).filter((t): t is PersonTask => t !== null);
  const lineLinked = Boolean(person.line_user_id);

  return {
    id: person.id as string,
    displayName: person.display_name as string,
    position: (person.position_title as string) ?? "",
    email: (person.email as string) ?? null,
    isActive: person.is_active as boolean,
    lineLinked,
    lineLinkedAt: lineLinked ? linkTimes.get(personId) ?? null : null,
    accounts: ((profiles.data as any[]) ?? []).map((p) => ({
      id: p.id,
      username: p.username ?? null,
      role: p.role as AppRole,
      lastSignInAt: authInfo.get(p.id)?.lastSignInAt ?? null,
      suspended: authInfo.get(p.id)?.suspended ?? false,
    })),
    upcoming: upcomingTasks,
    past30: {
      assigned: pastTasks.length,
      acknowledged: pastTasks.filter((t) => t.ack === "acknowledged").length,
      unavailable: pastTasks.filter((t) => t.ack === "unavailable").length,
    },
    notifications: ((notes.data as any[]) ?? []).map((n) => ({
      id: n.id,
      type: n.notification_type,
      status: n.status,
      at: n.sent_at ?? n.scheduled_for ?? n.created_at,
      eventTitle: one(n.event)?.title ?? "—",
      error: n.error_message ?? null,
    })),
    audit: ((audit.data as any[]) ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      summary: r.summary,
      at: r.changed_at,
    })),
  };
}
