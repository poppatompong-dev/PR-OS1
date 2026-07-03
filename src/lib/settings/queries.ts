// Settings/master-data reads for the admin settings page.

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";

export type StaffPerson = {
  id: string;
  displayName: string;
  position: string;
  email?: string;
  isActive: boolean;
};

export type Account = {
  id: string;
  email: string;
  username: string | null;
  role: AppRole;
  personId: string | null;
  displayName: string | null;
};

export async function getAllPeople(): Promise<StaffPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    // "position" is reserved; alias to a safe key.
    .select("id, display_name, position_title:position, email, is_active")
    .order("display_name");
  if (error) throw new Error(`getAllPeople: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    displayName: p.display_name as string,
    position: (p.position_title as string) ?? "",
    email: (p.email as string) ?? undefined,
    isActive: p.is_active as boolean,
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
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accounts");
  if (error) throw new Error(`getAccounts: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((a) => ({
    id: a.id,
    email: a.email,
    username: a.username ?? null,
    role: a.role as AppRole,
    personId: a.person_id ?? null,
    displayName: a.display_name ?? null,
  }));
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
  emailEnabled: boolean;
  lineMonthlyQuota: number;
  defaultReminderHours: number;
  sameDayReminderEnabled: boolean;
  fallbackWhenLineFails: boolean;
  fallbackWhenQuotaExceeded: boolean;
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "line_enabled",
      "email_enabled",
      "line_monthly_quota",
      "default_reminder_hours",
      "same_day_reminder_enabled",
      "fallback_to_email_when_line_fails",
      "fallback_to_email_when_quota_exceeded",
    ]);

  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asBool = (v: any, fallback = false) => (v === undefined ? fallback : v === true || v === "true");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asNum = (v: any) => (typeof v === "number" ? v : Number(v));

  return {
    lineEnabled: asBool(map.get("line_enabled")),
    emailEnabled: asBool(map.get("email_enabled")),
    lineMonthlyQuota: asNum(map.get("line_monthly_quota")) || 300,
    defaultReminderHours: asNum(map.get("default_reminder_hours")) || 24,
    sameDayReminderEnabled: asBool(map.get("same_day_reminder_enabled"), false),
    fallbackWhenLineFails: asBool(map.get("fallback_to_email_when_line_fails"), true),
    fallbackWhenQuotaExceeded: asBool(map.get("fallback_to_email_when_quota_exceeded"), true),
  };
}
