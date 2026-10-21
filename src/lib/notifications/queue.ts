// Notification sender. Called every 5 minutes, 06:00–20:55 Bangkok, by Supabase
// pg_cron (migration 0015), right after a job is published / changed /
// cancelled (kick.ts), as a backup by
// .github/workflows/notifications.yml (POST /api/notifications/process) and by
// the admin "ประมวลผลคิว" button in /settings.
//
// LINE only — the owner chose no e-mail fallback (19 Oct 2026). The design
// fits the 300-message free quota (STATE.md, "ตัดสินใจแล้ว — LINE bot"):
//
//   queue rows   assignment / change / cancellation → push now, with buttons
//                reminder (1.5 h before) → only if still not acknowledged
//   07:00        one summary per person, only on days they have work
//   17:00        admins: who has not acknowledged tomorrow's work
//   quota        budget.ts paces the month: job cards always, low-priority
//                messages only while they keep to their share; admins warned
//                once when ~30 messages are left; at zero we stop
//
// Until LINE credentials exist, due rows are marked 'skipped' (simulation),
// exactly as before, so nothing piles up.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { LAST_RUN_KEY, RETRY_TAG, isTransientFailure } from "@/lib/notifications/health";
import { budgetAllows, priorityOf, type BudgetState, type Priority } from "@/lib/notifications/budget";
import { isLineMessagingConfigured } from "@/lib/env";
import { addDays } from "@/lib/date";
import { getQuotaStatus, pushMessages, type LineMessage } from "@/lib/line/api";
import {
  claimRun,
  getAdminRecipientIds,
  getPeopleByIds,
  loadTask,
  loadTasks,
  logPush,
  releaseRun,
  runAge,
  type TaskItem,
} from "@/lib/line/data";
import { loadChangeDiff, type FieldChange } from "@/lib/line/change-diff";
import {
  adminReportMessage,
  cancellationMessage,
  dailySummaryMessage,
  quotaWarningMessage,
  taskMessage,
} from "@/lib/line/messages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

export const QUOTA_WARNING_REMAINING = 30;

type Settings = { lineEnabled: boolean; lineMonthlyQuota: number };

async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data } = await admin.from("settings").select("key, value").in("key", ["line_enabled", "line_monthly_quota"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const enabled = map.get("line_enabled");
  const quota = Number(map.get("line_monthly_quota"));
  return {
    lineEnabled: enabled === undefined ? true : enabled === true || enabled === "true",
    lineMonthlyQuota: Number.isFinite(quota) && quota > 0 ? quota : 300,
  };
}

/** Bangkok wall clock: { date: YYYY-MM-DD, month: YYYY-MM, minutes since midnight }. */
export function bangkokClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: `${parts.year}-${parts.month}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Windows for the scheduled messages. A late cron run still sends; a very late one does not. */
export const WINDOWS = {
  // 07:00 – 07:29 only. It was 07:00 – 11:59 to cover a late GitHub cron, but
  // with the 5-minute Supabase cron and instant sends that wide window made a
  // job added at 09:17 trigger a second "good morning" push to someone who had
  // no work at 07:00 (found in the 21 Oct 2026 test): a wasted message, since
  // the new job's own card already went out.
  daily: { from: 7 * 60, to: 7 * 60 + 30 },
  adminReport: { from: 17 * 60, to: 20 * 60 + 30 }, // 17:00 – 20:29
};

/**
 * Keeps us under the quota and paces it over the month (budget.ts). LINE's own
 * counter wins when we can read it; otherwise our notifications table.
 */
export class QuotaGuard {
  constructor(
    public used: number,
    public limit: number,
    public date: string,
    public sent: Record<Priority, number> = { critical: 0, reminder: 0, low: 0 },
  ) {}
  static async load(admin: SupabaseClient, settingsLimit: number, month: string, date: string) {
    const { data } = await admin
      .from("notifications")
      .select("notification_type")
      .eq("channel", "line")
      .eq("status", "sent")
      .eq("quota_month", month)
      .limit(5000);
    const sent: Record<Priority, number> = { critical: 0, reminder: 0, low: 0 };
    for (const r of data ?? []) sent[priorityOf(String(r.notification_type))] += 1;
    const ours = sent.critical + sent.reminder + sent.low;
    const live = await getQuotaStatus();
    // limit null = LINE says this OA has no cap (a paid plan): do not stop at 300.
    if (live) return new QuotaGuard(live.used, live.limit ?? Number.POSITIVE_INFINITY, date, sent);
    return new QuotaGuard(ours, settingsLimit, date, sent);
  }
  get remaining() {
    return Math.max(0, this.limit - this.used);
  }
  get state(): BudgetState {
    return { used: this.used, limit: this.limit, date: this.date, sent: { ...this.sent } };
  }
  /** May a message of this type go out now? */
  allows(type: string) {
    return budgetAllows(priorityOf(type), this.state);
  }
  record(type: string) {
    this.used += 1;
    this.sent[priorityOf(type)] += 1;
  }
}

export type ProcessSummary = {
  processed: number;
  sent: number;
  failed: number;
  /** Rows put back in the queue for one more try. */
  retried: number;
  skipped: number;
  /** Held back by the monthly budget (budget.ts) to keep job cards safe. */
  budgetHeld: number;
  dailySummaries: number;
  adminReports: number;
  quotaWarning: boolean;
  quotaRemaining: number | null;
  /** Another run held the lock; this call did nothing. */
  busy?: boolean;
};

async function mark(
  admin: SupabaseClient,
  id: string,
  status: "sent" | "failed" | "skipped",
  extra: Record<string, unknown> = {},
) {
  await admin
    .from("notifications")
    .update({ status, sent_at: new Date().toISOString(), ...extra })
    .eq("id", id);
}

/** Decide what (if anything) a queue row should send. No message = skip, with the reason. */
/** When the event starts, as an instant (event times are Bangkok wall-clock). */
export function eventStart(task: TaskItem): Date {
  return new Date(`${task.event.eventDate}T${task.event.startTime || "09:00"}:00+07:00`);
}

export function messageForRow(
  type: string,
  task: TaskItem | null,
  changes: FieldChange[] = [],
  opts: { now?: Date; scheduledFor?: string } = {},
): { message: LineMessage | null; skipReason?: string } {
  if (!task) return { message: null, skipReason: "นำชื่อออกจากงานแล้ว หรือไม่พบงาน" };
  if (type === "cancellation") return { message: cancellationMessage(task) };
  if (task.event.status !== "published") return { message: null, skipReason: "งานไม่ได้อยู่ในสถานะเผยแพร่แล้ว" };
  if (type === "reminder") {
    const start = eventStart(task);
    const now = opts.now ?? new Date();
    // The cron sleeps 20:00–06:00, so a reminder for a late-evening start would
    // otherwise arrive the next morning, after the event.
    if (start.getTime() <= now.getTime()) return { message: null, skipReason: "เลยเวลาเริ่มงานแล้ว" };
    // Timed off an old start (the event was moved): the new one is queued separately.
    if (opts.scheduledFor) {
      const due = start.getTime() - 90 * 60 * 1000;
      if (Math.abs(new Date(opts.scheduledFor).getTime() - due) > 60 * 1000) {
        return { message: null, skipReason: "เวลางานเปลี่ยนแล้ว (ใช้การเตือนรอบใหม่)" };
      }
    }
    if (task.acknowledged) return { message: null, skipReason: "รับทราบแล้ว ไม่ต้องเตือน" };
    if (task.unavailable) return { message: null, skipReason: "แจ้งไม่สะดวกแล้ว" };
    return { message: taskMessage(task, "reminder") };
  }
  if (type === "change") return { message: taskMessage(task, "change", changes) };
  if (type === "assignment") {
    if (task.acknowledged) return { message: null, skipReason: "รับทราบไปแล้ว" };
    return { message: taskMessage(task, "assignment") };
  }
  return { message: null, skipReason: `ไม่รู้จักประเภท ${type}` };
}

async function processQueue(
  admin: SupabaseClient,
  settings: Settings,
  quota: QuotaGuard,
  summary: ProcessSummary,
  month: string,
) {
  const { data, error } = await admin
    .from("notifications")
    .select("id, event_id, assignment_id, notification_type, scheduled_for, error_message, person:people(display_name, line_user_id)")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(200);
  if (error) throw new Error(`processQueue: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    summary.processed += 1;
    const person = one(row.person);

    if (!settings.lineEnabled) {
      await mark(admin, row.id, "skipped", { error_message: "ปิดการส่ง LINE ในหน้าตั้งค่า" });
      summary.skipped += 1;
      continue;
    }
    if (!person?.line_user_id) {
      await mark(admin, row.id, "skipped", { error_message: "ยังไม่ผูก LINE" });
      summary.skipped += 1;
      continue;
    }

    const task = row.assignment_id ? await loadTask(admin, row.assignment_id) : null;
    const changes =
      row.notification_type === "change" && row.event_id ? await loadChangeDiff(admin, row.event_id, task) : [];
    const { message, skipReason } = messageForRow(row.notification_type, task, changes, {
      scheduledFor: row.scheduled_for,
    });
    if (!message) {
      await mark(admin, row.id, "skipped", { error_message: skipReason });
      summary.skipped += 1;
      continue;
    }
    const budget = quota.allows(row.notification_type);
    if (!budget.ok) {
      await mark(admin, row.id, "skipped", { error_message: budget.reason });
      summary.skipped += 1;
      summary.budgetHeld += 1;
      continue;
    }

    const res = await pushMessages(person.line_user_id, [message], row.id);
    if (res.ok) {
      quota.record(row.notification_type);
      await mark(admin, row.id, "sent", {
        channel: "line",
        provider_message_id: res.providerMessageId ?? null,
        quota_month: month,
      });
      summary.sent += 1;
    } else if (isTransientFailure(res.status) && !String(row.error_message ?? "").startsWith(RETRY_TAG)) {
      // One more try on the next run (5 minutes) for a LINE hiccup; a second
      // failure is final and shows in the 17:00 admin report.
      await admin
        .from("notifications")
        .update({
          scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          error_message: `${RETRY_TAG} ${res.error ?? `HTTP ${res.status ?? "?"}`}`,
        })
        .eq("id", row.id);
      summary.retried += 1;
    } else {
      await mark(admin, row.id, "failed", { error_message: res.error ?? "ส่งไม่สำเร็จ" });
      summary.failed += 1;
    }
  }
}

async function pushToAdmins(
  admin: SupabaseClient,
  quota: QuotaGuard,
  summary: ProcessSummary,
  type: "admin_report" | "quota_warning",
  message: LineMessage,
  month: string,
  claimPrefix?: string,
): Promise<number> {
  const admins = await getPeopleByIds(admin, await getAdminRecipientIds(admin));
  let sent = 0;
  for (const a of admins) {
    if (!a.lineUserId) continue;
    if (!quota.allows(type).ok) {
      summary.budgetHeld += 1;
      continue;
    }
    if (claimPrefix && !(await claimRun(admin, `${claimPrefix}:${a.id}`))) continue;
    const res = await pushMessages(a.lineUserId, [message]);
    if (res.ok) {
      quota.record(type);
      sent += 1;
    }
    await logPush(admin, {
      personId: a.id,
      type,
      ok: res.ok,
      providerMessageId: res.providerMessageId,
      error: res.error,
      quotaMonth: month,
    });
  }
  return sent;
}

async function sendDailySummaries(
  admin: SupabaseClient,
  quota: QuotaGuard,
  summary: ProcessSummary,
  today: string,
  month: string,
) {
  const tomorrow = addDays(today, 1);
  const tasks = await loadTasks(admin, { from: today, to: tomorrow });
  const byPerson = new Map<string, TaskItem[]>();
  for (const t of tasks) byPerson.set(t.personId, [...(byPerson.get(t.personId) ?? []), t]);

  // When the budget is tight, people with something still to acknowledge come first.
  const outstanding = (ts: TaskItem[]) => ts.filter((t) => !t.acknowledged && !t.unavailable).length;
  const ordered = [...byPerson].sort((a, b) => outstanding(b[1]) - outstanding(a[1]));

  let sent = 0;
  for (const [personId, mine] of ordered) {
    const lineUserId = mine[0].lineUserId;
    if (!lineUserId) continue;
    if (!quota.allows("daily_summary").ok) {
      summary.budgetHeld += 1;
      continue;
    }
    // Claimed per person, right before the push: a run that dies half way
    // leaves the rest for the next run instead of losing the whole morning.
    if (!(await claimRun(admin, `daily:${today}:${personId}`))) continue;
    const message = dailySummaryMessage(
      mine[0].personName,
      mine.filter((t) => t.event.eventDate === today),
      mine.filter((t) => t.event.eventDate === tomorrow),
    );
    const res = await pushMessages(lineUserId, [message]);
    if (res.ok) {
      quota.record("daily_summary");
      sent += 1;
    }
    await logPush(admin, {
      personId,
      type: "daily_summary",
      ok: res.ok,
      providerMessageId: res.providerMessageId,
      error: res.error,
      quotaMonth: month,
    });
  }
  return sent;
}

async function sendAdminReport(
  admin: SupabaseClient,
  quota: QuotaGuard,
  summary: ProcessSummary,
  today: string,
  month: string,
) {
  const tomorrow = addDays(today, 1);
  const tasks = await loadTasks(admin, { from: tomorrow, to: tomorrow });
  const pending = tasks.filter((t) => !t.acknowledged && !t.unavailable);
  const unavailable = tasks.filter((t) => t.unavailable);
  // LINE pushes that failed today (after their one retry): nobody else would notice them.
  const { count: failedToday } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", new Date(`${today}T00:00:00+07:00`).toISOString());
  // Owner rule: nothing outstanding = no message.
  if (pending.length === 0 && unavailable.length === 0 && !failedToday) return 0;
  return pushToAdmins(
    admin,
    quota,
    summary,
    "admin_report",
    adminReportMessage(tomorrow, pending, unavailable, failedToday ?? 0),
    month,
    `admin17:${today}`,
  );
}

export async function processDueNotifications(now = new Date()): Promise<ProcessSummary> {
  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  const clock = bangkokClock(now);
  const summary: ProcessSummary = {
    processed: 0,
    sent: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    budgetHeld: 0,
    dailySummaries: 0,
    adminReports: 0,
    quotaWarning: false,
    quotaRemaining: null,
  };

  if (!isLineMessagingConfigured()) {
    // Simulation: no LINE channel yet. Retire due rows so they do not all
    // fire at once the moment credentials appear.
    const { data } = await admin
      .from("notifications")
      .update({
        status: "skipped",
        sent_at: new Date().toISOString(),
        error_message: "โหมดจำลอง: ยังไม่ได้เชื่อมต่อ LINE",
      })
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .select("id");
    summary.processed = summary.skipped = data?.length ?? 0;
    return summary;
  }

  // One sender at a time: the cron and the admin's "ประมวลผลคิว" button could
  // otherwise pick up the same queued rows and push them twice. A lock older
  // than 5 minutes belongs to a run that died, so it is taken over.
  if (!(await claimRun(admin, LOCK_KEY))) {
    const age = await runAge(admin, LOCK_KEY);
    if (age !== null && age < 5 * 60 * 1000) {
      summary.busy = true;
      return summary;
    }
    await releaseRun(admin, LOCK_KEY);
    if (!(await claimRun(admin, LOCK_KEY))) {
      summary.busy = true;
      return summary;
    }
  }
  try {
    await runLocked(admin, settings, clock, summary);
  } finally {
    await releaseRun(admin, LOCK_KEY);
    await stampLastRun(admin, summary);
  }
  return summary;
}

const LOCK_KEY = "lock:processor";

/** Heartbeat for /settings and /api/health (lib/notifications/health.ts). Best effort. */
async function stampLastRun(admin: SupabaseClient, summary: ProcessSummary) {
  try {
    await admin.from("settings").upsert({
      key: LAST_RUN_KEY,
      value: {
        at: new Date().toISOString(),
        processed: summary.processed,
        sent: summary.sent,
        failed: summary.failed,
        retried: summary.retried,
        budgetHeld: summary.budgetHeld,
      },
      description: "รอบส่งคิวแจ้งเตือนล่าสุด (ระบบเขียนเอง)",
    });
  } catch {
    // a missed stamp only makes the indicator look older; never fail the run for it
  }
}

async function runLocked(
  admin: SupabaseClient,
  settings: Settings,
  clock: ReturnType<typeof bangkokClock>,
  summary: ProcessSummary,
) {
  const quota = await QuotaGuard.load(admin, settings.lineMonthlyQuota, clock.month, clock.date);

  await processQueue(admin, settings, quota, summary, clock.month);

  if (settings.lineEnabled) {
    if (clock.minutes >= WINDOWS.daily.from && clock.minutes < WINDOWS.daily.to) {
      summary.dailySummaries = await sendDailySummaries(admin, quota, summary, clock.date, clock.month);
    }
    if (clock.minutes >= WINDOWS.adminReport.from && clock.minutes < WINDOWS.adminReport.to) {
      summary.adminReports = await sendAdminReport(admin, quota, summary, clock.date, clock.month);
    }
    if (quota.remaining <= QUOTA_WARNING_REMAINING && quota.remaining > 0) {
      if (await claimRun(admin, `quota:${clock.month}`, { used: quota.used, limit: quota.limit })) {
        summary.quotaWarning =
          (await pushToAdmins(admin, quota, summary, "quota_warning", quotaWarningMessage(quota.used, quota.limit), clock.month)) > 0;
      }
    }
  }

  // Old claim keys are only bookkeeping: webhook de-dup matters for LINE's
  // short retry window, daily/admin claims only for their own day.
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  await admin
    .from("notification_runs")
    .delete()
    .like("run_key", "rl:%")
    .lt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  for (const prefix of ["webhook:%", "daily:%", "admin17:%"]) {
    await admin.from("notification_runs").delete().like("run_key", prefix).lt("created_at", weekAgo);
  }

  summary.quotaRemaining = Number.isFinite(quota.remaining) ? quota.remaining : null;
}
