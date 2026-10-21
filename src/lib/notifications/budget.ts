// Automatic LINE quota budget ("กันงบอัตโนมัติ", owner decision 21 Oct 2026).
//
// The free plan gives 300 pushes a month. Owner's workload: about 40 jobs a
// month with 1–2 people each. The rule, in one sentence:
//
//   job cards (new / changed / cancelled) and "ไม่สะดวก" alerts ALWAYS go out;
//   the 1.5-hour reminder goes out while the reserve for job cards is safe;
//   the 07:00 summary and 17:00 admin report go out only while they keep to
//   their even daily share — so the quota lasts the whole month.
//
// The reserve grows by itself if a month turns out busier than planned: it
// uses whichever is higher, the plan or what this month has actually used.
// Pure functions only, so tests/quota-budget.unit.test.ts covers every case.

export const PLAN = {
  jobsPerMonth: 40,
  peoplePerJob: 1.5,
  /** Share of jobs that change time/date/place after publishing. */
  changeRate: 0.2,
  cancelRate: 0.1,
  /** "ไม่สะดวก" alerts to admins per month. */
  alertsPerMonth: 10,
  /** Share of assignments still unacknowledged 1.5 h before the start. */
  reminderRate: 0.3,
};

/** Extra job cards kept back for the rest of today, on top of the daily rate. */
export const TODAY_BUFFER = 5;
/** A little slack so one busy morning does not drop the summary on day 1. */
export const LOW_SLACK = 6;

export type Priority = "critical" | "reminder" | "low";

export function priorityOf(type: string): Priority {
  if (type === "reminder") return "reminder";
  if (type === "daily_summary" || type === "admin_report") return "low";
  // assignment, change, cancellation, unavailable, quota_warning, anything new
  return "critical";
}

export function plannedPerMonth() {
  const assignments = PLAN.jobsPerMonth * PLAN.peoplePerJob;
  const critical = Math.ceil(
    assignments + assignments * PLAN.changeRate + assignments * PLAN.cancelRate + PLAN.alertsPerMonth,
  );
  const reminder = Math.ceil(assignments * PLAN.reminderRate);
  return { critical, reminder };
}

export type BudgetState = {
  /** Pushes used this month (LINE's own counter when readable). */
  used: number;
  /** Monthly cap; Infinity = no cap (paid plan). */
  limit: number;
  /** Bangkok date, YYYY-MM-DD. */
  date: string;
  /** Sent this month, from our notifications table, by priority. */
  sent: Record<Priority, number>;
};

function monthDays(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { day: d, daysInMonth, daysLeftAfterToday: daysInMonth - d };
}

/** Numbers behind the decision — also what /settings shows. */
export function budgetPlan(s: BudgetState) {
  const { day, daysInMonth, daysLeftAfterToday } = monthDays(s.date);
  const plan = plannedPerMonth();
  const rate = (planned: number, actual: number) => Math.max(planned / daysInMonth, actual / day);
  const criticalPerDay = rate(plan.critical, s.sent.critical);
  const reminderPerDay = rate(plan.reminder, s.sent.reminder);
  const criticalReserve = Math.ceil(criticalPerDay * daysLeftAfterToday) + TODAY_BUFFER;
  const reminderReserve = Math.ceil(reminderPerDay * daysLeftAfterToday);
  const remaining = Number.isFinite(s.limit) ? Math.max(0, s.limit - s.used) : Number.POSITIVE_INFINITY;
  // Low-priority share of the month, spread evenly over its days.
  const lowMonth = Number.isFinite(s.limit) ? Math.max(0, s.limit - plan.critical - plan.reminder) : Number.POSITIVE_INFINITY;
  const lowAllowedSoFar = Math.floor((lowMonth * day) / daysInMonth) + LOW_SLACK;
  return { day, daysInMonth, remaining, criticalReserve, reminderReserve, lowMonth, lowAllowedSoFar, plan };
}

export type BudgetDecision = { ok: true } | { ok: false; reason: string };

export function budgetAllows(priority: Priority, s: BudgetState): BudgetDecision {
  if (!Number.isFinite(s.limit)) return { ok: true };
  const p = budgetPlan(s);
  if (p.remaining <= 0) return { ok: false, reason: "โควต้า LINE เดือนนี้หมดแล้ว" };
  if (priority === "critical") return { ok: true };
  if (p.remaining - 1 < p.criticalReserve) {
    return { ok: false, reason: `กันโควต้าไว้ให้การ์ดงาน (เหลือ ${p.remaining} ต้องกันไว้ ${p.criticalReserve})` };
  }
  if (priority === "reminder") return { ok: true };
  if (p.remaining - 1 < p.criticalReserve + p.reminderReserve) {
    return { ok: false, reason: "กันโควต้าไว้ให้การ์ดงานและการเตือนก่อนงาน" };
  }
  if (s.sent.low + 1 > p.lowAllowedSoFar) {
    return { ok: false, reason: `ข้อความสรุป/รายงานใช้ครบส่วนของวันนี้แล้ว (${s.sent.low}/${p.lowAllowedSoFar})` };
  }
  return { ok: true };
}

/** One line for /settings. */
export function budgetLabel(s: BudgetState): { mode: "normal" | "saving" | "critical-only" | "unlimited"; text: string } {
  if (!Number.isFinite(s.limit)) return { mode: "unlimited", text: "ไม่จำกัดโควต้า" };
  const p = budgetPlan(s);
  if (p.remaining <= 0) return { mode: "critical-only", text: "โควต้าหมด — ดูงานในเว็บหรือพิมพ์ถามบอท (ไม่เสียโควต้า)" };
  const low = budgetAllows("low", s);
  const reminder = budgetAllows("reminder", s);
  if (!reminder.ok) return { mode: "critical-only", text: `ส่งเฉพาะการ์ดงาน — กันไว้ ${p.criticalReserve} ข้อความถึงสิ้นเดือน` };
  if (!low.ok) return { mode: "saving", text: "ประหยัด — งดสรุปเช้า/รายงานเย็นชั่วคราว การ์ดงานและการเตือนส่งตามปกติ" };
  return { mode: "normal", text: `ปกติ — กันไว้ให้การ์ดงาน ${p.criticalReserve} ข้อความถึงสิ้นเดือน` };
}
