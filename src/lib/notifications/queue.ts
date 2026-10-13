// Real (non-simulation) notification queue processor. Called by the admin
// "ประมวลผลคิว" button (src/lib/settings/mutations.ts) and by the external
// cron endpoint (src/app/api/notifications/process/route.ts).
//
// Falls back to the old simulation behavior (mark 'skipped') only when
// neither provider is configured at all, so nothing breaks before LINE/Email
// credentials are set. Once configured, real sends happen here — the SQL
// process_notification_queue() function in migration 0006 is no longer
// called by the app and is left in place only as historical reference.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { env, isEmailConfigured, isLineMessagingConfigured } from "@/lib/env";
import { pushLineMessage } from "@/lib/notifications/line";
import { sendEmail } from "@/lib/notifications/email";
import {
  buildDigestText,
  buildNotificationText,
  type DigestItem,
  type NotificationContext,
} from "@/lib/notifications/templates";
import { decideDelivery, type RuleNotificationType } from "@/lib/notifications/rules";
import { enqueueDailyDigests } from "@/lib/notifications/digest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

type Settings = {
  lineEnabled: boolean;
  emailEnabled: boolean;
  lineMonthlyQuota: number;
  fallbackWhenLineFails: boolean;
  fallbackWhenQuotaExceeded: boolean;
};

async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin
    .from("settings")
    .select("key, value")
    .in("key", [
      "line_enabled",
      "email_enabled",
      "line_monthly_quota",
      "fallback_to_email_when_line_fails",
      "fallback_to_email_when_quota_exceeded",
    ]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const asBool = (v: unknown, fallback: boolean) =>
    v === undefined ? fallback : v === true || v === "true";
  const asNum = (v: unknown, fallback: number) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    lineEnabled: asBool(map.get("line_enabled"), true),
    emailEnabled: asBool(map.get("email_enabled"), true),
    lineMonthlyQuota: asNum(map.get("line_monthly_quota"), 300),
    fallbackWhenLineFails: asBool(map.get("fallback_to_email_when_line_fails"), true),
    fallbackWhenQuotaExceeded: asBool(map.get("fallback_to_email_when_quota_exceeded"), true),
  };
}

async function countLineSentThisMonth(admin: SupabaseClient, quotaMonth: string): Promise<number> {
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("channel", "line")
    .eq("status", "sent")
    .eq("quota_month", quotaMonth);
  return count ?? 0;
}

async function loadChangeSummary(admin: SupabaseClient, eventId: string): Promise<string | undefined> {
  const { data } = await admin
    .from("audit_logs")
    .select("summary")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .eq("action", "significant_change")
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.summary ?? undefined;
}

type DeliveryResult = { sentVia: "line" | "email" | null; providerMessageId?: string; error?: string };

async function attemptDelivery(
  admin: SupabaseClient,
  settings: Settings,
  channel: "line" | "email",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  person: any,
  subject: string,
  body: string,
  quotaMonth: string,
): Promise<DeliveryResult> {
  const emailFallback = async (reason: string, allowed: boolean): Promise<DeliveryResult> => {
    if (allowed && person?.email && settings.emailEnabled && isEmailConfigured()) {
      const result = await sendEmail(person.email, subject, body);
      if (result.ok) return { sentVia: "email", providerMessageId: result.providerMessageId };
      return { sentVia: null, error: `${reason} / email fallback: ${result.error}` };
    }
    return { sentVia: null, error: reason };
  };

  if (channel === "line") {
    if (person?.line_user_id && settings.lineEnabled && isLineMessagingConfigured()) {
      const usedThisMonth = await countLineSentThisMonth(admin, quotaMonth);
      if (usedThisMonth >= settings.lineMonthlyQuota) {
        return emailFallback("เกินโควต้า LINE รายเดือน", settings.fallbackWhenQuotaExceeded);
      }
      const result = await pushLineMessage(person.line_user_id, body);
      if (result.ok) return { sentVia: "line", providerMessageId: result.providerMessageId };
      return emailFallback(result.error ?? "ส่ง LINE ไม่สำเร็จ", settings.fallbackWhenLineFails);
    }
    return emailFallback("LINE ปิดใช้งานหรือยังไม่ได้ตั้งค่า", settings.fallbackWhenLineFails);
  }

  if (person?.email && settings.emailEnabled && isEmailConfigured()) {
    const result = await sendEmail(person.email, subject, body);
    if (result.ok) return { sentVia: "email", providerMessageId: result.providerMessageId };
    return { sentVia: null, error: result.error };
  }
  return { sentVia: null, error: "ไม่มีอีเมลในระบบ หรือ Email ปิดใช้งาน/ยังไม่ได้ตั้งค่า" };
}

export type ProcessSummary = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  digestsQueued: number;
};

const NOTIFICATION_SELECT = `
  id, event_id, assignment_id, person_id, channel, notification_type, quota_month, scheduled_for,
  event:events(id, title, event_date, start_time, status, deleted_at, cancellation_reason, location:locations(name)),
  assignment:assignments(
    assignment_status, assignment_version, declined_version, decline_reason,
    acknowledgements(assignment_version),
    role:roles(name),
    person:people(display_name)
  ),
  person:people(display_name, email, line_user_id)
`;

/** Who on a job has not answered, and who said ไม่สะดวก — for the supervisor alert. */
async function loadOpenAssignees(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ pending: string[]; declined: string[] }> {
  const { data } = await admin
    .from("assignments")
    .select(
      "assignment_version, declined_version, acknowledgements(assignment_version), role:roles(name), person:people(display_name)",
    )
    .eq("event_id", eventId)
    .eq("assignment_status", "assigned");
  const pending: string[] = [];
  const declined: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (data ?? []) as any[]) {
    const label = `${one(a.person)?.display_name ?? "—"} (${one(a.role)?.name ?? "—"})`;
    const acked = (a.acknowledgements ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (k: any) => k.assignment_version === a.assignment_version,
    );
    if (acked) continue;
    if (a.declined_version === a.assignment_version) declined.push(label);
    else pending.push(label);
  }
  return { pending, declined };
}

/** Tomorrow's work for one person, for the daily digest. */
async function loadDigestItems(
  admin: SupabaseClient,
  personId: string,
  date: string,
): Promise<DigestItem[]> {
  const { data } = await admin
    .from("assignments")
    .select(
      `assignment_version, declined_version,
       acknowledgements(assignment_version),
       role:roles(name),
       events!inner(title, event_date, start_time, status, deleted_at, location:locations(name))`,
    )
    .eq("person_id", personId)
    .eq("assignment_status", "assigned")
    .eq("events.event_date", date)
    .eq("events.status", "published")
    .is("events.deleted_at", null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map((a) => ({ a, ev: one(a.events) }))
    .filter(({ ev }) => ev && ev.event_date === date && ev.status === "published" && !ev.deleted_at)
    .map(({ a, ev }): DigestItem => {
      const acked = (a.acknowledgements ?? []).some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (k: any) => k.assignment_version === a.assignment_version,
      );
      return {
        startTime: String(ev.start_time ?? "").slice(0, 5),
        title: ev.title,
        locationName: one(ev.location)?.name ?? "—",
        roleName: one(a.role)?.name ?? "—",
        answer: acked
          ? "acknowledged"
          : a.declined_version === a.assignment_version
            ? "declined"
            : "pending",
      };
    })
    .sort((x, y) => x.startTime.localeCompare(y.startTime));
}

async function markRow(
  admin: SupabaseClient,
  id: string,
  status: "skipped" | "failed",
  message: string,
) {
  await admin
    .from("notifications")
    .update({ status, sent_at: new Date().toISOString(), error_message: message })
    .eq("id", id);
}

export async function processDueNotifications(now = new Date()): Promise<ProcessSummary> {
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const summary: ProcessSummary = { processed: 0, sent: 0, failed: 0, skipped: 0, digestsQueued: 0 };

  // Create today's digest rows first (no-op before the digest hour or once
  // they exist), so the same run sends them.
  summary.digestsQueued = await enqueueDailyDigests(admin, now);

  const { data, error } = await admin
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("status", "queued")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(200);
  if (error) throw new Error(`processDueNotifications: ${error.message}`);

  const ackUrl = new URL("/mobile/my-tasks", env.appBaseUrl).toString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    summary.processed += 1;
    const type = row.notification_type as RuleNotificationType;
    const ev = one(row.event);
    const assignment = one(row.assignment);
    const person = one(row.person);
    const quotaMonth = row.quota_month ?? new Date().toISOString().slice(0, 7);

    if (!person) {
      await markRow(admin, row.id, "failed", "ไม่พบข้อมูลบุคคล");
      summary.failed += 1;
      continue;
    }

    const open =
      type === "escalation" && ev ? await loadOpenAssignees(admin, row.event_id) : undefined;

    const decision = decideDelivery({
      type,
      scheduledFor: row.scheduled_for,
      now,
      event: ev
        ? {
            status: ev.status,
            deletedAt: ev.deleted_at ?? null,
            eventDate: ev.event_date,
            startTime: String(ev.start_time ?? "00:00"),
          }
        : null,
      assignment: assignment
        ? {
            status: assignment.assignment_status,
            version: assignment.assignment_version,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            acknowledgedVersions: (assignment.acknowledgements ?? []).map((k: any) => k.assignment_version),
            declinedVersion: assignment.declined_version ?? null,
          }
        : null,
      openCounts: open ? { pending: open.pending.length, declined: open.declined.length } : undefined,
    });

    if (!decision.send) {
      await markRow(admin, row.id, "skipped", decision.reason);
      summary.skipped += 1;
      continue;
    }

    // Build the message before the simulation check, so a digest with nothing
    // in it is skipped for that reason rather than reported as simulated.
    let subject: string;
    let body: string;
    if (type === "digest") {
      const forDate = new Date(new Date(row.scheduled_for).getTime() + 24 * 60 * 60 * 1000);
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(forDate);
      const items = await loadDigestItems(admin, row.person_id, date);
      if (items.length === 0) {
        await markRow(admin, row.id, "skipped", "ไม่มีงานพรุ่งนี้แล้ว");
        summary.skipped += 1;
        continue;
      }
      ({ subject, body } = buildDigestText(date, items, ackUrl));
    } else {
      const ctx: NotificationContext = {
        eventTitle: ev.title,
        eventDate: ev.event_date,
        startTime: String(ev.start_time ?? "").slice(0, 5),
        locationName: one(ev.location)?.name ?? "—",
        roleName: one(assignment?.role)?.name ?? "—",
        ackUrl,
        eventUrl: new URL(`/events/${ev.id}`, env.appBaseUrl).toString(),
        personName: one(assignment?.person)?.display_name ?? undefined,
        declineReason: assignment?.decline_reason ?? undefined,
        pendingPeople: open?.pending,
        declinedPeople: open?.declined,
        changeSummary: type === "change" ? await loadChangeSummary(admin, row.event_id) : undefined,
        cancellationReason: ev.cancellation_reason ?? undefined,
      };
      ({ subject, body } = buildNotificationText(type, ctx));
    }

    if (!isLineMessagingConfigured() && !isEmailConfigured()) {
      await markRow(admin, row.id, "skipped", "โหมดจำลอง: ยังไม่ได้เชื่อมต่อ LINE/Email provider");
      summary.skipped += 1;
      continue;
    }

    let channel: "line" | "email" = row.channel;
    if (decision.channel === "email_only") {
      if (!person.email || !settings.emailEnabled || !isEmailConfigured()) {
        await markRow(admin, row.id, "skipped", "รับทราบแล้ว — ไม่ใช้โควต้า LINE (ไม่มีอีเมลสำรอง)");
        summary.skipped += 1;
        continue;
      }
      channel = "email";
    }

    const result = await attemptDelivery(admin, settings, channel, person, subject, body, quotaMonth);

    if (result.sentVia) {
      await admin
        .from("notifications")
        .update({
          status: "sent",
          channel: result.sentVia,
          sent_at: new Date().toISOString(),
          provider_message_id: result.providerMessageId ?? null,
          quota_month: quotaMonth,
        })
        .eq("id", row.id);
      summary.sent += 1;
    } else {
      await markRow(admin, row.id, "failed", result.error ?? "ส่งไม่สำเร็จไม่ทราบสาเหตุ");
      summary.failed += 1;
    }
  }

  return summary;
}
