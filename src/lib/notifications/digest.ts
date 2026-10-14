// Daily digest: at the configured hour (default 17:00 Bangkok), queue one
// notification per person who has published work tomorrow. The message body
// is built at send time from what is true then (queue.ts), so this only
// decides who gets one.
//
// Called at the start of every queue run. Rows carry a dedupe key
// (digest:<person>:<date>) with a unique index behind it (migration 0014),
// so the cron and the admin "ประมวลผลคิว" button can both run it safely.

import type { SupabaseClient } from "@supabase/supabase-js";
import { digestWindow } from "@/lib/notifications/rules";

async function readSetting(admin: SupabaseClient, key: string): Promise<unknown> {
  const { data } = await admin.from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value;
}

export async function enqueueDailyDigests(admin: SupabaseClient, now = new Date()): Promise<number> {
  const enabled = await readSetting(admin, "daily_digest_enabled");
  // Missing key = migration 0014 not run yet: stay off rather than guess.
  if (!(enabled === true || enabled === "true")) return 0;

  const hourValue = Number(await readSetting(admin, "daily_digest_hour"));
  const window = digestWindow(now, Number.isFinite(hourValue) ? hourValue : 17);
  if (!window) return 0;

  const { data: events, error: eventsError } = await admin
    .from("events")
    .select("id")
    .eq("event_date", window.forDate)
    .eq("status", "published")
    .is("deleted_at", null);
  if (eventsError) throw new Error(`enqueueDailyDigests events: ${eventsError.message}`);
  if (!events?.length) return 0;

  const { data: assignments, error: asgError } = await admin
    .from("assignments")
    .select("person_id, person:people(is_active, line_user_id)")
    .in(
      "event_id",
      events.map((e) => e.id),
    )
    .eq("assignment_status", "assigned");
  if (asgError) throw new Error(`enqueueDailyDigests assignments: ${asgError.message}`);

  const people = new Map<string, { line: boolean }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (assignments ?? []) as any[]) {
    const person = Array.isArray(a.person) ? a.person[0] : a.person;
    if (!person || person.is_active === false) continue;
    people.set(a.person_id, { line: Boolean(person.line_user_id) });
  }
  if (people.size === 0) return 0;

  const quotaMonth = window.today.slice(0, 7);
  const rows = [...people.entries()].map(([personId, { line }]) => ({
    event_id: null,
    assignment_id: null,
    person_id: personId,
    channel: line ? "line" : "email",
    notification_type: "digest",
    scheduled_for: window.dueAt,
    status: "queued",
    quota_month: quotaMonth,
    dedupe_key: `digest:${personId}:${window.forDate}`,
  }));

  const { data: inserted, error } = await admin
    .from("notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`enqueueDailyDigests insert: ${error.message}`);
  return inserted?.length ?? 0;
}
