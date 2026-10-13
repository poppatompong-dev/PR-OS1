// Delivery rules checked at send time, kept free of I/O so they can be
// tested on their own (tests/notification-rules.test.mjs).
//
// A queued notification was correct when it was queued; by the time it is
// due the job may have been moved, cancelled or reassigned, the person may
// have acknowledged or said ไม่สะดวก. Each rule here answers one question:
// should this still go out, and how.

export type RuleNotificationType =
  | "assignment"
  | "reminder"
  | "change"
  | "cancellation"
  | "declined"
  | "escalation"
  | "digest";

export type RuleInput = {
  type: RuleNotificationType;
  scheduledFor: string; // ISO timestamp
  now: Date;
  event?: {
    status: string;
    deletedAt: string | null;
    eventDate: string; // YYYY-MM-DD, Thai local
    startTime: string; // HH:MM[:SS], Thai local
  } | null;
  assignment?: {
    status: string; // assigned | removed
    version: number;
    acknowledgedVersions: number[];
    declinedVersion: number | null;
  } | null;
  // escalation only: how many on the job have not answered / said ไม่สะดวก
  openCounts?: { pending: number; declined: number };
};

export type RuleDecision =
  | { send: true; channel: "as_queued" | "email_only" }
  | { send: false; reason: string };

// Same-day reminders are queued 90 minutes before the start; anything closer
// than two hours is treated as one, advance reminders sit a day out.
const SAME_DAY_WINDOW_MS = 2 * 60 * 60 * 1000;

export function eventStart(eventDate: string, startTime: string): Date {
  return new Date(`${eventDate}T${startTime.slice(0, 5)}:00+07:00`);
}

export function decideDelivery(input: RuleInput): RuleDecision {
  const { type, event, assignment, now } = input;
  const skip = (reason: string): RuleDecision => ({ send: false, reason });

  if (type === "digest") return { send: true, channel: "as_queued" };

  if (!event) return skip("ไม่พบข้อมูลงาน");
  if (event.deletedAt) return skip("งานถูกลบแล้ว");

  const liveOnly =
    type === "assignment" || type === "reminder" || type === "escalation" || type === "declined";
  if (liveOnly && event.status !== "published") return skip("งานไม่ได้อยู่ในสถานะเผยแพร่แล้ว");

  const start = eventStart(event.eventDate, event.startTime);
  if ((type === "reminder" || type === "escalation") && start.getTime() <= now.getTime()) {
    return skip("เลยเวลาเริ่มงานแล้ว");
  }

  const acknowledged =
    assignment != null && assignment.acknowledgedVersions.includes(assignment.version);
  const declined =
    assignment != null && !acknowledged && assignment.declinedVersion === assignment.version;

  if (type === "assignment" || type === "reminder" || type === "change") {
    if (!assignment) return skip("ไม่พบการมอบหมาย");
    if (assignment.status !== "assigned") return skip("ถูกนำออกจากงานแล้ว");
  }

  if (type === "reminder") {
    if (declined) return skip("ผู้รับงานแจ้งไม่สะดวกแล้ว");
    const sameDay = start.getTime() - new Date(input.scheduledFor).getTime() <= SAME_DAY_WINDOW_MS;
    // Owner decision 2026-10-13: the 1.5-hour reminder spends LINE quota only
    // on people who have not acknowledged; the rest get it by email.
    if (sameDay && acknowledged) return { send: true, channel: "email_only" };
  }

  if (type === "declined") {
    // The supervisor may already have acted, or the person changed their mind.
    if (!assignment || assignment.status !== "assigned") return skip("ถูกเปลี่ยนตัวแล้ว");
    if (!declined) return skip("ผู้รับงานกลับมารับทราบแล้ว");
  }

  if (type === "escalation") {
    const open = input.openCounts ?? { pending: 0, declined: 0 };
    if (open.pending === 0 && open.declined === 0) return skip("ทุกคนรับทราบแล้ว");
  }

  return { send: true, channel: "as_queued" };
}

/** YYYY-MM-DD in Asia/Bangkok for an instant. */
export function bangkokDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Hour of day (0-23) in Asia/Bangkok for an instant. */
export function bangkokHour(at: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return Number(hour);
}

/**
 * When today's digest is due, if it is due yet. The digest covers tomorrow
 * and is created only on the same Bangkok day after the configured hour: a
 * scheduler that was down all evening must not send "tomorrow's work" the
 * next morning, when tomorrow has become today.
 */
export function digestWindow(
  now: Date,
  digestHour: number,
): { dueAt: string; forDate: string; today: string } | null {
  if (!Number.isInteger(digestHour) || digestHour < 0 || digestHour > 23) return null;
  if (bangkokHour(now) < digestHour) return null;
  const today = bangkokDate(now);
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const hh = String(digestHour).padStart(2, "0");
  return {
    dueAt: new Date(`${today}T${hh}:00:00+07:00`).toISOString(),
    forDate: next.toISOString().slice(0, 10),
    today,
  };
}
