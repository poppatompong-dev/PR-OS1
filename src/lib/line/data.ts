/* eslint-disable @typescript-eslint/no-explicit-any */
// Data access for the LINE bot and the scheduled LINE jobs. Runs with the
// service-role client: LINE requests carry no Supabase session, so every
// function here does its own "is this really that person" check instead of
// relying on RLS.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PENDING_REGISTRATIONS_KEY,
  mergePendingRegistration,
  parsePendingRegistrations,
  type PendingRegistration,
} from "@/lib/line/registrations";

const one = (v: any) => (Array.isArray(v) ? v[0] : v);

export type LinePerson = {
  id: string;
  displayName: string;
  lineUserId: string | null;
  /** Telegram chat (owner, 29 Oct 2026): when set, notifications go there instead of LINE. */
  telegramChatId?: number | null;
};

export type TaskItem = {
  assignmentId: string;
  assignmentVersion: number;
  personId: string;
  personName: string;
  lineUserId: string | null;
  telegramChatId?: number | null;
  roleName: string;
  acknowledged: boolean;
  unavailable: boolean;
  unavailableReason: string | null;
  /** Taken off the job (assignment_status = removed). Only loaded for the "you are off this job" notice. */
  removed?: boolean;
  event: {
    id: string;
    title: string;
    eventDate: string;
    startTime: string;
    endTime: string | null;
    locationName: string;
    shortNote: string | null;
    status: string;
    cancellationReason: string | null;
    /** Files on the job (not deleted); the card offers "ดูไฟล์แนบ" when > 0. */
    attachmentCount?: number;
  };
};

export async function findPersonByLineUserId(admin: SupabaseClient, lineUserId: string): Promise<LinePerson | null> {
  const { data } = await admin
    .from("people")
    .select("id, display_name, line_user_id, telegram_chat_id, is_active")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return { id: data.id, displayName: data.display_name, lineUserId: data.line_user_id, telegramChatId: tgId(data.telegram_chat_id) };
}

export async function findPersonByTelegramChatId(admin: SupabaseClient, chatId: number): Promise<LinePerson | null> {
  const { data } = await admin
    .from("people")
    .select("id, display_name, line_user_id, telegram_chat_id, is_active")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return { id: data.id, displayName: data.display_name, lineUserId: data.line_user_id, telegramChatId: tgId(data.telegram_chat_id) };
}

/** bigint comes back as a number or a string depending on size; chat ids fit in a JS number. */
function tgId(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** people.id of everyone who gets the admin-side LINE messages. */
export async function getAllowedGroupIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.from("settings").select("value").eq("key", "line_allowed_group_ids").maybeSingle();
  return Array.isArray(data?.value) ? data.value.map(String) : [];
}

export async function allowGroup(admin: SupabaseClient, groupId: string, by: string | null) {
  const ids = await getAllowedGroupIds(admin);
  if (ids.includes(groupId)) return;
  await admin.from("settings").upsert({
    key: "line_allowed_group_ids",
    value: [...ids, groupId],
    description: "groupId ของกลุ่มไลน์ที่บอทตอบคำสั่ง",
    updated_by: by,
  });
}

/** Release a run claim (used for the processor's lock). */
export async function releaseRun(admin: SupabaseClient, runKey: string) {
  await admin.from("notification_runs").delete().eq("run_key", runKey);
}

/** Age in ms of a claim, or null if nobody holds it. */
export async function runAge(admin: SupabaseClient, runKey: string): Promise<number | null> {
  const { data } = await admin.from("notification_runs").select("created_at").eq("run_key", runKey).maybeSingle();
  return data ? Date.now() - new Date(data.created_at).getTime() : null;
}

export async function getAdminRecipientIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.from("settings").select("value").eq("key", "line_admin_person_ids").maybeSingle();
  const raw = data?.value;
  if (Array.isArray(raw) && raw.length > 0) return raw.map(String);
  // Not configured yet: whoever is linked to an admin account.
  const { data: profiles } = await admin.from("profiles").select("person_id").eq("role", "admin");
  return (profiles ?? []).map((p: any) => p.person_id).filter(Boolean);
}

export async function getPeopleByIds(admin: SupabaseClient, ids: string[]): Promise<LinePerson[]> {
  if (ids.length === 0) return [];
  const { data } = await admin
    .from("people")
    .select("id, display_name, line_user_id, telegram_chat_id, is_active")
    .in("id", ids);
  return (data ?? [])
    .filter((p: any) => p.is_active !== false)
    .map((p: any) => ({ id: p.id, displayName: p.display_name, lineUserId: p.line_user_id, telegramChatId: tgId(p.telegram_chat_id) }));
}

const TASK_SELECT = `
  id, assignment_version, person_id, unavailable_at, unavailable_reason,
  role:roles(name), role_names,
  person:people(display_name, line_user_id, telegram_chat_id),
  acknowledgements(assignment_version),
  event:events!inner(
    id, title, event_date, start_time, end_time, short_note, status, cancellation_reason, deleted_at,
    location:locations(name),
    attachments:event_attachments(id, deleted_at)
  )
`;

function toTask(a: any): TaskItem | null {
  const ev = one(a.event);
  if (!ev || ev.deleted_at) return null;
  const acks = Array.isArray(a.acknowledgements) ? a.acknowledgements : [];
  const person = one(a.person);
  return {
    assignmentId: a.id,
    assignmentVersion: a.assignment_version,
    personId: a.person_id,
    personName: person?.display_name ?? "—",
    lineUserId: person?.line_user_id ?? null,
    telegramChatId: tgId(person?.telegram_chat_id),
    roleName: a.role_names ?? one(a.role)?.name ?? "—",
    acknowledged: acks.some((k: any) => k.assignment_version === a.assignment_version),
    unavailable: Boolean(a.unavailable_at),
    unavailableReason: a.unavailable_reason ?? null,
    removed: a.assignment_status === "removed",
    event: {
      id: ev.id,
      title: ev.title,
      eventDate: ev.event_date,
      startTime: String(ev.start_time ?? "").slice(0, 5),
      endTime: ev.end_time ? String(ev.end_time).slice(0, 5) : null,
      locationName: one(ev.location)?.name ?? "—",
      shortNote: ev.short_note ?? null,
      status: ev.status,
      cancellationReason: ev.cancellation_reason ?? null,
      attachmentCount: Array.isArray(ev.attachments) ? ev.attachments.filter((f: any) => !f.deleted_at).length : 0,
    },
  };
}

function byTime(x: TaskItem, y: TaskItem) {
  return `${x.event.eventDate}${x.event.startTime}${x.personName}`.localeCompare(
    `${y.event.eventDate}${y.event.startTime}${y.personName}`,
  );
}

/**
 * Active assignments on published events between two dates (inclusive).
 * Drafts never leave the office; canceled events are excluded unless asked.
 */
export async function loadTasks(
  admin: SupabaseClient,
  opts: { from: string; to: string; personId?: string; includeCanceled?: boolean },
): Promise<TaskItem[]> {
  let q = admin
    .from("assignments")
    .select(TASK_SELECT)
    .eq("assignment_status", "assigned")
    .gte("event.event_date", opts.from)
    .lte("event.event_date", opts.to)
    .in("event.status", opts.includeCanceled ? ["published", "canceled"] : ["published"]);
  if (opts.personId) q = q.eq("person_id", opts.personId);
  const { data, error } = await q;
  if (error) throw new Error(`loadTasks: ${error.message}`);
  return (data ?? []).map(toTask).filter((t): t is TaskItem => t !== null).sort(byTime);
}

export async function loadTask(
  admin: SupabaseClient,
  assignmentId: string,
  opts: { includeRemoved?: boolean } = {},
): Promise<TaskItem | null> {
  const { data } = await admin
    .from("assignments")
    .select(`${TASK_SELECT}, assignment_status`)
    .eq("id", assignmentId)
    .maybeSingle();
  if (!data) return null;
  if ((data as any).assignment_status !== "assigned" && !opts.includeRemoved) return null;
  return toTask(data);
}

/** The newest audit row of one kind for an event (reason / old values of a postponement or change). */
export async function latestEventAudit(
  admin: SupabaseClient,
  eventId: string,
  actions: string[],
): Promise<{ action: string; changed_at: string; old_values: any; new_values: any } | null> {
  const { data } = await admin
    .from("audit_logs")
    .select("action, changed_at, old_values, new_values")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .in("action", actions)
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any) ?? null;
}

export type AckOutcome = "ok" | "already" | "stale" | "not_yours" | "not_found" | "closed";

/**
 * Record "รับทราบ" for one assignment version. Refuses when the person is not
 * the assignee, when the event changed since the button was sent (the person
 * must see the new details first), or when the event is no longer live.
 */
export async function recordAck(
  admin: SupabaseClient,
  opts: { assignmentId: string; version: number; personId: string; channel: "line" | "mobile_web" | "telegram" },
): Promise<{ outcome: AckOutcome; task: TaskItem | null }> {
  const task = await loadTask(admin, opts.assignmentId);
  if (!task) return { outcome: "not_found", task: null };
  if (task.personId !== opts.personId) return { outcome: "not_yours", task };
  if (task.event.status !== "published") return { outcome: "closed", task };
  if (task.assignmentVersion !== opts.version) return { outcome: "stale", task };
  if (task.acknowledged) return { outcome: "already", task };

  const { error } = await admin.from("acknowledgements").insert({
    assignment_id: task.assignmentId,
    assignment_version: task.assignmentVersion,
    acknowledged_by: opts.personId,
    acknowledgement_channel: opts.channel,
  });
  if (error && error.code !== "23505") throw new Error(`recordAck: ${error.message}`);
  return { outcome: error ? "already" : "ok", task: { ...task, acknowledged: true, unavailable: false } };
}

export type UnavailableOutcome = "ok" | "already" | "acknowledged" | "not_yours" | "not_found" | "closed";

export async function recordUnavailable(
  admin: SupabaseClient,
  opts: { assignmentId: string; personId: string; reason: string; changedBy?: string | null },
): Promise<{ outcome: UnavailableOutcome; task: TaskItem | null }> {
  const task = await loadTask(admin, opts.assignmentId);
  if (!task) return { outcome: "not_found", task: null };
  if (task.personId !== opts.personId) return { outcome: "not_yours", task };
  if (task.event.status !== "published") return { outcome: "closed", task };
  // An old card's button tapped again must not re-alert the admins (and spend quota).
  if (task.unavailable) return { outcome: "already", task };
  if (task.acknowledged) return { outcome: "acknowledged", task };

  const reason = opts.reason.trim().slice(0, 200) || "ไม่ระบุเหตุผล";
  // Conditional update: of two taps arriving together, only one wins.
  const { data: updated, error } = await admin
    .from("assignments")
    .update({ unavailable_at: new Date().toISOString(), unavailable_reason: reason })
    .eq("id", task.assignmentId)
    .is("unavailable_at", null)
    .select("id");
  if (error) throw new Error(`recordUnavailable: ${error.message}`);
  if (!updated || updated.length === 0) return { outcome: "already", task };

  await admin.from("audit_logs").insert({
    entity_type: "event",
    entity_id: task.event.id,
    action: "assignee_unavailable",
    changed_by: opts.changedBy ?? null,
    summary: `${task.personName} แจ้งไม่สะดวก: ${reason}`,
    new_values: { assignment_id: task.assignmentId, reason },
  });

  return { outcome: "ok", task: { ...task, unavailable: true, unavailableReason: reason } };
}

// ---- chat state: "type your reason" ---------------------------------------

export async function setPendingReason(admin: SupabaseClient, lineUserId: string, assignmentId: string) {
  await admin.from("line_chat_state").upsert({
    line_user_id: lineUserId,
    pending_action: "unavailable_reason",
    assignment_id: assignmentId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
}

export async function takePendingReason(admin: SupabaseClient, lineUserId: string): Promise<string | null> {
  const { data } = await admin
    .from("line_chat_state")
    .select("assignment_id, pending_action, expires_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!data) return null;
  await admin.from("line_chat_state").delete().eq("line_user_id", lineUserId);
  if (data.pending_action !== "unavailable_reason" || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.assignment_id;
}

/** Other one-step chat waits (e.g. "send your photo"); shares the reason table. */
export async function setPendingAction(admin: SupabaseClient, chatKey: string, action: "avatar_photo", minutes = 15) {
  await admin.from("line_chat_state").upsert({
    line_user_id: chatKey,
    pending_action: action,
    assignment_id: null,
    expires_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
  });
}

/** True (and cleared) when this chat was waiting for `action`. */
export async function takePendingAction(admin: SupabaseClient, chatKey: string, action: "avatar_photo"): Promise<boolean> {
  const { data } = await admin
    .from("line_chat_state")
    .select("pending_action, expires_at")
    .eq("line_user_id", chatKey)
    .maybeSingle();
  if (!data || data.pending_action !== action) return false;
  await admin.from("line_chat_state").delete().eq("line_user_id", chatKey);
  return new Date(data.expires_at).getTime() >= Date.now();
}

export async function clearPending(admin: SupabaseClient, lineUserId: string) {
  await admin.from("line_chat_state").delete().eq("line_user_id", lineUserId);
}

// ---- once-only scheduled runs ------------------------------------------------

/** Claim a run key. True for exactly one caller; later callers get false. */
export async function claimRun(admin: SupabaseClient, runKey: string, detail: Record<string, unknown> = {}): Promise<boolean> {
  const { error } = await admin.from("notification_runs").insert({ run_key: runKey, detail });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`claimRun: ${error.message}`);
}

/**
 * Per-user flood guard for the webhook (loop-engineering: backpressure on a hook).
 * Replies are free, but every event still costs a function run and database
 * reads; a stuck phone or a spammer tapping a button 100 times should not.
 * Allows `limit` events per user per minute; the rest are dropped silently.
 */
export const WEBHOOK_EVENTS_PER_MINUTE = 20;

export async function withinRateLimit(
  admin: SupabaseClient,
  lineUserId: string,
  now = new Date(),
  limit = WEBHOOK_EVENTS_PER_MINUTE,
): Promise<boolean> {
  const bucket = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM (UTC)
  const prefix = `rl:${lineUserId}:${bucket}:`;
  const { count, error } = await admin
    .from("notification_runs")
    .select("run_key", { count: "exact", head: true })
    .like("run_key", `${prefix}%`);
  if (error) return true; // never block real people because the guard itself failed
  if ((count ?? 0) >= limit) return false;
  await admin.from("notification_runs").insert({ run_key: `${prefix}${crypto.randomUUID()}`, detail: {} });
  return true;
}

/** Log a push that was not driven by a queue row, so the quota count sees it. */
export async function logPush(
  admin: SupabaseClient,
  row: {
    personId: string;
    type: "daily_summary" | "admin_report" | "unavailable" | "quota_warning";
    eventId?: string | null;
    assignmentId?: string | null;
    ok: boolean;
    providerMessageId?: string;
    error?: string;
    quotaMonth: string;
    /** Telegram pushes are logged too (history) but never count against the LINE quota. */
    channel?: "line" | "telegram";
  },
) {
  const now = new Date().toISOString();
  await admin.from("notifications").insert({
    person_id: row.personId,
    event_id: row.eventId ?? null,
    assignment_id: row.assignmentId ?? null,
    channel: row.channel ?? "line",
    notification_type: row.type,
    scheduled_for: now,
    sent_at: now,
    status: row.ok ? "sent" : "failed",
    provider_message_id: row.providerMessageId ?? null,
    error_message: row.ok ? null : (row.error ?? "ส่งไม่สำเร็จ"),
    quota_month: row.quotaMonth,
  });
}

// ---- registration from the team group -----------------------------------------

export async function getPendingRegistrations(admin: SupabaseClient): Promise<PendingRegistration[]> {
  const { data } = await admin.from("settings").select("value").eq("key", PENDING_REGISTRATIONS_KEY).maybeSingle();
  return parsePendingRegistrations(data?.value);
}

export async function savePendingRegistrations(admin: SupabaseClient, list: PendingRegistration[], by: string | null = null) {
  const { error } = await admin.from("settings").upsert(
    {
      key: PENDING_REGISTRATIONS_KEY,
      value: list,
      description: "LINE ที่กดลงทะเบียนในกลุ่มงาน รอแอดมินยืนยันว่าเป็นใคร",
      updated_by: by,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(`savePendingRegistrations: ${error.message}`);
}

/** Read-modify-write; fine for a ~10-person team tapping one at a time. */
export async function addPendingRegistration(admin: SupabaseClient, entry: PendingRegistration) {
  const list = await getPendingRegistrations(admin);
  await savePendingRegistrations(admin, mergePendingRegistration(list, entry));
}

export async function isPendingRegistration(admin: SupabaseClient, lineUserId: string): Promise<boolean> {
  return (await getPendingRegistrations(admin)).some((r) => r.lineUserId === lineUserId);
}
