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
import { buildNotificationText, type NotificationContext } from "@/lib/notifications/templates";

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

export type ProcessSummary = { processed: number; sent: number; failed: number; skipped: number };

export async function processDueNotifications(): Promise<ProcessSummary> {
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const summary: ProcessSummary = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const { data, error } = await admin
    .from("notifications")
    .select(
      `
      id, event_id, assignment_id, person_id, channel, notification_type, quota_month,
      event:events(title, event_date, start_time, cancellation_reason, location:locations(name)),
      assignment:assignments(role:roles(name)),
      person:people(display_name, email, line_user_id)
      `,
    )
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(200);
  if (error) throw new Error(`processDueNotifications: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    summary.processed += 1;
    const ev = one(row.event);
    const assignment = one(row.assignment);
    const person = one(row.person);
    const quotaMonth = row.quota_month ?? new Date().toISOString().slice(0, 7);

    if (!ev || !person) {
      await admin
        .from("notifications")
        .update({
          status: "failed",
          sent_at: new Date().toISOString(),
          error_message: "ไม่พบข้อมูลงานหรือบุคคล",
        })
        .eq("id", row.id);
      summary.failed += 1;
      continue;
    }

    if (!isLineMessagingConfigured() && !isEmailConfigured()) {
      await admin
        .from("notifications")
        .update({
          status: "skipped",
          sent_at: new Date().toISOString(),
          error_message: "โหมดจำลอง: ยังไม่ได้เชื่อมต่อ LINE/Email provider",
        })
        .eq("id", row.id);
      summary.skipped += 1;
      continue;
    }

    const ctx: NotificationContext = {
      eventTitle: ev.title,
      eventDate: ev.event_date,
      startTime: String(ev.start_time ?? "").slice(0, 5),
      locationName: one(ev.location)?.name ?? "—",
      roleName: one(assignment?.role)?.name ?? "—",
      ackUrl: new URL("/mobile/my-tasks", env.appBaseUrl).toString(),
      changeSummary:
        row.notification_type === "change" ? await loadChangeSummary(admin, row.event_id) : undefined,
      cancellationReason: ev.cancellation_reason ?? undefined,
    };
    const { subject, body } = buildNotificationText(row.notification_type, ctx);

    const result = await attemptDelivery(admin, settings, row.channel, person, subject, body, quotaMonth);

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
      await admin
        .from("notifications")
        .update({
          status: "failed",
          sent_at: new Date().toISOString(),
          error_message: result.error ?? "ส่งไม่สำเร็จไม่ทราบสาเหตุ",
        })
        .eq("id", row.id);
      summary.failed += 1;
    }
  }

  return summary;
}
