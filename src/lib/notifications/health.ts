// Is the notification scheduler alive? (loop-engineering: an escalation path.)
//
// On 20 Oct 2026 the GitHub cron ran once in an afternoon and, later, the
// Supabase job was rejected with 401 for a while — both silently. Every
// processing run now stamps settings.notifications_last_run; this turns that
// stamp into a state the admin can see on /settings and /api/health, at no
// LINE quota cost.

export const LAST_RUN_KEY = "notifications_last_run";

/** Bangkok minutes when pg_cron calls every 5 minutes (06:00–20:55, migration 0015). */
export const SCHEDULE_WINDOW = { from: 6 * 60, to: 20 * 60 + 55 };
/** A run is expected every 5 minutes; allow two misses before raising a flag. */
export const STALE_AFTER_MIN = 12;

export type LastRun = { at: string; processed?: number; sent?: number; failed?: number; retried?: number };
export type SchedulerState = "ok" | "stale" | "sleeping" | "never";
export type SchedulerHealth = { state: SchedulerState; ageMinutes: number | null; lastRunAt: string | null; label: string };

function bangkokMinutes(d: Date): number {
  const t = new Date(d.getTime() + 7 * 3600 * 1000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

export function schedulerHealth(last: LastRun | null, now = new Date()): SchedulerHealth {
  const minutes = bangkokMinutes(now);
  const inWindow = minutes >= SCHEDULE_WINDOW.from && minutes <= SCHEDULE_WINDOW.to;
  if (!last?.at) {
    return { state: "never", ageMinutes: null, lastRunAt: null, label: "ยังไม่เคยมีรอบส่งคิว — ตรวจตัวตั้งเวลา Supabase" };
  }
  const ageMinutes = Math.max(0, Math.round((now.getTime() - new Date(last.at).getTime()) / 60000));
  const ago = ageMinutes < 1 ? "เมื่อสักครู่" : ageMinutes < 120 ? `${ageMinutes} นาทีที่แล้ว` : `${Math.round(ageMinutes / 60)} ชั่วโมงที่แล้ว`;
  if (!inWindow) {
    return { state: "sleeping", ageMinutes, lastRunAt: last.at, label: `นอกเวลาส่ง (ส่ง 06:00–20:55) · รอบล่าสุด ${ago}` };
  }
  // Just after 06:00 the last run is naturally from last night.
  const sinceWindowOpened = minutes - SCHEDULE_WINDOW.from;
  if (ageMinutes > STALE_AFTER_MIN && sinceWindowOpened > STALE_AFTER_MIN) {
    return { state: "stale", ageMinutes, lastRunAt: last.at, label: `ตัวตั้งเวลาไม่ได้ส่งคิวมา ${ago} — ตรวจ Supabase cron / ค่าลับ` };
  }
  return { state: "ok", ageMinutes, lastRunAt: last.at, label: `ทำงานปกติ · รอบล่าสุด ${ago}` };
}

/** LINE failures worth one more try: network errors, 5xx, rate limit. 4xx (blocked, bad id) are final. */
export function isTransientFailure(status: number | undefined): boolean {
  return status === undefined || status === 0 || status === 429 || status >= 500;
}

export const RETRY_TAG = "ลองใหม่อีกครั้ง:";
