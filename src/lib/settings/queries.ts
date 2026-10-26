// Settings/master-data reads for the admin settings page.

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { LAST_RUN_KEY, schedulerHealth, type LastRun, type SchedulerHealth } from "@/lib/notifications/health";
import { budgetLabel, budgetPlan, priorityOf, type BudgetState, type Priority } from "@/lib/notifications/budget";
import { isLineMessagingConfigured, isSupabaseConfigured } from "@/lib/env";
import { getFriendStatus, getQuotaStatus, type FriendStatus } from "@/lib/line/api";
import { quotaView, type QuotaView } from "@/lib/notifications/quota-view";
import { getPendingRegistrations } from "@/lib/line/data";
import type { PendingRegistration } from "@/lib/line/registrations";
import type { AppRole } from "@/lib/auth/roles";
import {
  departments as mockDepartments,
  events as mockEvents,
  locations as mockLocations,
  people as mockPeople,
  roles as mockRoles,
} from "@/data/mock-data";

export type StaffPerson = {
  id: string;
  displayName: string;
  position: string;
  email?: string;
  isActive: boolean;
  lineLinked: boolean;
};

export type Account = {
  id: string;
  email: string;
  username: string | null;
  role: AppRole;
  personId: string | null;
  displayName: string | null;
  /** From Supabase Auth; null = never signed in (or unknown in demo mode). */
  lastSignInAt: string | null;
  /** Auth ban in force (set by "ระงับบัญชี"). */
  suspended: boolean;
  /** The linked person has a LINE account attached. */
  lineLinked: boolean;
  /** When the person last linked LINE (latest audit_logs line_link), if known. */
  lineLinkedAt: string | null;
};

export type AuthUserInfo = { lastSignInAt: string | null; suspended: boolean };

/**
 * Sign-in and suspension state from Supabase Auth, keyed by user id. Needs the
 * service-role key; returns an empty map rather than failing the page.
 */
export async function getAuthUserInfo(): Promise<Map<string, AuthUserInfo>> {
  const out = new Map<string, AuthUserInfo>();
  try {
    const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return out;
    const now = Date.now();
    for (const u of data.users) {
      const bannedUntil = (u as { banned_until?: string | null }).banned_until ?? null;
      out.set(u.id, {
        lastSignInAt: u.last_sign_in_at ?? null,
        suspended: Boolean(bannedUntil && new Date(bannedUntil).getTime() > now),
      });
    }
  } catch {
    // Missing service key or Auth unreachable: show no sign-in data.
  }
  return out;
}

/** Latest line_link time per person id, from audit_logs. */
export async function getLineLinkTimes(personIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (personIds.length === 0) return out;
  try {
    const { data } = await createAdminClient()
      .from("audit_logs")
      .select("entity_id, changed_at")
      .eq("entity_type", "person")
      .eq("action", "line_link")
      .in("entity_id", personIds)
      .order("changed_at", { ascending: false });
    for (const row of data ?? []) {
      if (!out.has(row.entity_id as string)) out.set(row.entity_id as string, row.changed_at as string);
    }
  } catch {
    // leave empty
  }
  return out;
}

export async function getAllPeople(): Promise<StaffPerson[]> {
  if (!isSupabaseConfigured()) {
    return mockPeople.map((person) => ({
      id: person.id,
      displayName: person.displayName,
      position: person.position,
      email: person.email,
      isActive: person.isActive,
      lineLinked: false,
    }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    // "position" is reserved; alias to a safe key.
    .select("id, display_name, position_title:position, email, is_active, line_user_id")
    .order("display_name");
  if (error) throw new Error(`getAllPeople: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    displayName: p.display_name as string,
    position: (p.position_title as string) ?? "",
    email: (p.email as string) ?? undefined,
    isActive: p.is_active as boolean,
    lineLinked: Boolean(p.line_user_id),
  }));
}

export type MasterItem = { id: string; name: string; extra: string; isActive: boolean };
export type MasterLists = {
  departments: MasterItem[];
  locations: MasterItem[];
  eventTypes: MasterItem[];
  roles: MasterItem[];
};

export async function getMasterLists(): Promise<MasterLists> {
  if (!isSupabaseConfigured()) {
    return {
      departments: mockDepartments.map((d) => ({ id: d.id, name: d.name, extra: d.shortName, isActive: true })),
      locations: mockLocations.map((l) => ({ id: l.id, name: l.name, extra: l.description ?? "", isActive: true })),
      eventTypes: [...new Set(mockEvents.map((e) => e.eventType))].map((name, i) => ({
        id: `type_${i}`,
        name,
        extra: "",
        isActive: true,
      })),
      roles: mockRoles.map((r) => ({ id: r.id, name: r.name, extra: r.code, isActive: true })),
    };
  }

  const supabase = await createClient();
  const [d, l, t, r] = await Promise.all([
    supabase.from("departments").select("id, name, short_name, is_active").order("name"),
    supabase.from("locations").select("id, name, description, is_active").order("name"),
    supabase.from("event_types").select("id, name, color, is_active").order("name"),
    supabase.from("roles").select("id, name, code, color, is_active").order("name"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = (rows: any[] | null, extraKey: string): MasterItem[] =>
    (rows ?? []).map((x) => ({
      id: x.id,
      name: x.name,
      extra: x[extraKey] ?? "",
      isActive: x.is_active,
    }));

  return {
    departments: map(d.data, "short_name"),
    locations: map(l.data, "description"),
    eventTypes: map(t.data, "color"),
    roles: map(r.data, "code"),
  };
}

export async function getAccounts(): Promise<Account[]> {
  if (!isSupabaseConfigured()) {
    // The six accounts the department is to be given, as roles rather than as
    // real sign-ins: demo mode has no auth table and invents no credentials.
    const demoRoles: AppRole[] = ["admin", "supervisor", "staff", "assignee", "assignee", "display"];
    return mockPeople.slice(0, demoRoles.length).map((person, i) => ({
      id: `demo_${i}`,
      email: "— ตั้งค่าเมื่อเชื่อมฐานข้อมูลจริง —",
      username: null,
      role: demoRoles[i],
      personId: person.id,
      displayName: person.displayName,
      lastSignInAt: null,
      suspended: false,
      lineLinked: false,
      lineLinkedAt: null,
    }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accounts");
  if (error) throw new Error(`getAccounts: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[]) ?? [];
  const personIds = [...new Set(rows.map((a) => a.person_id).filter(Boolean) as string[])];
  const [authInfo, linkTimes, linked] = await Promise.all([
    getAuthUserInfo(),
    getLineLinkTimes(personIds),
    personIds.length
      ? supabase.from("people").select("id, line_user_id").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; line_user_id: string | null }[] }),
  ]);
  const lineByPerson = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((linked.data as any[]) ?? []).map((p) => [p.id as string, Boolean(p.line_user_id)]),
  );

  return rows.map((a) => {
    const auth = authInfo.get(a.id);
    const personId = (a.person_id as string | null) ?? null;
    const lineLinked = personId ? lineByPerson.get(personId) ?? false : false;
    return {
      id: a.id,
      email: a.email,
      username: a.username ?? null,
      role: a.role as AppRole,
      personId,
      displayName: a.display_name ?? null,
      lastSignInAt: auth?.lastSignInAt ?? null,
      suspended: auth?.suspended ?? false,
      lineLinked,
      lineLinkedAt: lineLinked && personId ? linkTimes.get(personId) ?? null : null,
    };
  });
}

export type NotificationRow = {
  id: string;
  type: string;
  channel: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  errorMessage: string | null;
  eventTitle: string;
  personName: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const first = (v: any) => (Array.isArray(v) ? v[0] : v);

export async function getNotificationFeed(): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured()) {
    return mockEvents
      .flatMap((event) =>
        event.assignments.map((assignment) => ({
          id: `${event.id}-${assignment.id}`,
          type: event.hasChanges ? "change" : "assignment",
          channel: "line",
          status: assignment.ackStatus === "acknowledged" ? "sent" : "queued",
          scheduledFor: `${event.eventDate}T07:00:00+07:00`,
          sentAt: assignment.acknowledgedAt ?? null,
          errorMessage: null,
          eventTitle: event.title,
          personName: assignment.person.displayName,
        })),
      )
      .slice(0, 30);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, notification_type, channel, status, scheduled_for, sent_at, error_message, event:events(title), person:people(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`getNotificationFeed: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((n) => ({
    id: n.id,
    type: n.notification_type,
    channel: n.channel,
    status: n.status,
    scheduledFor: n.scheduled_for,
    sentAt: n.sent_at ?? null,
    errorMessage: n.error_message ?? null,
    eventTitle: first(n.event)?.title ?? "—",
    personName: first(n.person)?.display_name ?? "—",
  }));
}

export type NotificationSettings = {
  lineEnabled: boolean;
  lineMonthlyQuota: number;
  sameDayReminderEnabled: boolean;
  adminPersonIds: string[];
  quotaUsedThisMonth: number;
  /** Is the 5-minute scheduler alive? (lib/notifications/health.ts) */
  scheduler: SchedulerHealth;
  /** LINE pushes that failed for good in the last 24 hours. */
  failedLast24h: number;
  /** Monthly pacing (lib/notifications/budget.ts), from our own count. */
  budget: {
    mode: "normal" | "saving" | "critical-only" | "unlimited";
    text: string;
    sent: Record<Priority, number>;
    criticalReserve: number;
    lowAllowedSoFar: number;
    plannedCritical: number;
  };
};

function budgetView(state: BudgetState): NotificationSettings["budget"] {
  const plan = budgetPlan(state);
  const label = budgetLabel(state);
  return {
    mode: label.mode,
    text: label.text,
    sent: state.sent,
    criticalReserve: plan.criticalReserve,
    lowAllowedSoFar: plan.lowAllowedSoFar,
    plannedCritical: plan.plan.critical,
  };
}

const bangkokDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (!isSupabaseConfigured()) {
    return {
      lineEnabled: true,
      lineMonthlyQuota: 300,
      sameDayReminderEnabled: true,
      adminPersonIds: [],
      quotaUsedThisMonth: 0,
      scheduler: schedulerHealth(null),
      failedLast24h: 0,
      budget: budgetView({ used: 0, limit: 300, date: bangkokDate(), sent: { critical: 0, reminder: 0, low: 0 } }),
    };
  }

  const supabase = await createClient();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(new Date());
  const [{ data }, { data: sentRows }, { count: failed }] = await Promise.all([
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["line_enabled", "line_monthly_quota", "same_day_reminder_enabled", "line_admin_person_ids", LAST_RUN_KEY]),
    supabase
      .from("notifications")
      .select("notification_type")
      .eq("channel", "line")
      .eq("status", "sent")
      .eq("quota_month", month)
      .limit(5000),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
  ]);

  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asBool = (v: any, fallback: boolean) => (v === undefined ? fallback : v === true || v === "true");
  const admins = map.get("line_admin_person_ids");
  const sent: Record<Priority, number> = { critical: 0, reminder: 0, low: 0 };
  for (const r of sentRows ?? []) sent[priorityOf(String(r.notification_type))] += 1;
  const used = sent.critical + sent.reminder + sent.low;
  const limit = Number(map.get("line_monthly_quota")) || 300;

  return {
    lineEnabled: asBool(map.get("line_enabled"), true),
    lineMonthlyQuota: Number(map.get("line_monthly_quota")) || 300,
    sameDayReminderEnabled: asBool(map.get("same_day_reminder_enabled"), true),
    adminPersonIds: Array.isArray(admins) ? admins.map(String) : [],
    quotaUsedThisMonth: used,
    scheduler: schedulerHealth((map.get(LAST_RUN_KEY) as LastRun | undefined) ?? null),
    failedLast24h: failed ?? 0,
    budget: budgetView({ used, limit, date: bangkokDate(), sent }),
  };
}

export type PendingLineView = PendingRegistration & { friend: FriendStatus };

/**
 * LINE accounts that tapped "ลงทะเบียนรับแจ้งงาน" in the team group, waiting
 * for an admin to say who they are, each with whether they have added the bot
 * as a friend yet (LINE pushes only to friends).
 */
export async function getPendingLineRegistrations(): Promise<PendingLineView[]> {
  if (!isSupabaseConfigured()) {
    const now = Date.now();
    return [
      { lineUserId: "Udemo1", displayName: "Somjai ✿", pictureUrl: null, groupId: null, at: new Date(now - 6e5).toISOString(), friend: "friend" },
      { lineUserId: "Udemo2", displayName: "นก", pictureUrl: null, groupId: null, at: new Date(now - 36e5).toISOString(), friend: "not_friend" },
    ];
  }
  try {
    const list = await getPendingRegistrations(createAdminClient());
    if (!isLineMessagingConfigured()) return list.map((r) => ({ ...r, friend: "unknown" as const }));
    const friends = await Promise.all(list.map((r) => getFriendStatus(r.lineUserId)));
    return list.map((r, i) => ({ ...r, friend: friends[i] }));
  } catch {
    return [];
  }
}

/**
 * Numbers for the quota bar (home page + /settings, admins only). LINE's own
 * counter when it answers — that is the one that stops delivery — and our
 * notifications table for the split by kind.
 */
export async function getQuotaBar(): Promise<QuotaView> {
  const date = bangkokDate();
  if (!isSupabaseConfigured()) {
    return quotaView({ date, sent: { critical: 44, reminder: 4, low: 12 }, settingsLimit: 300, line: null });
  }
  const supabase = await createClient();
  const month = date.slice(0, 7);
  const [{ data: limitRow }, { data: sentRows }, line] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "line_monthly_quota").maybeSingle(),
    supabase
      .from("notifications")
      .select("notification_type")
      .eq("channel", "line")
      .eq("status", "sent")
      .eq("quota_month", month)
      .limit(5000),
    isLineMessagingConfigured() ? getQuotaStatus() : Promise.resolve(null),
  ]);
  const sent: Record<Priority, number> = { critical: 0, reminder: 0, low: 0 };
  for (const r of sentRows ?? []) sent[priorityOf(String(r.notification_type))] += 1;
  return quotaView({ date, sent, settingsLimit: Number(limitRow?.value) || 300, line });
}
