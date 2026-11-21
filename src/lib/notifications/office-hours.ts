// บอทส่งข้อความในเวลาราชการ (owner via พี่เอิร์ธ, 20 Nov 2026 — "บอทสื่อสารถี่ บ่อยเกินไป
// โดยเฉพาะเวลานอกราชการ"): Mon–Fri 08:00–16:30, Bangkok. Outside it only what is urgent
// goes out — a job that starts before the next office morning (+90 min, so an 08:30 job
// still gets its card), and only to the people on it. The rest waits for 08:00.
// No public-holiday calendar: holidays count as working days.

export const OPEN_MIN = 8 * 60;
export const CLOSE_MIN = 16 * 60 + 30;
export const URGENT_SLACK_MIN = 90;

function bkkParts(now: Date) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")), date: `${g("year")}-${g("month")}-${g("day")}`, min: (Number(g("hour")) % 24) * 60 + Number(g("minute")) };
}

export const isWeekday = (now = new Date()) => {
  const wd = bkkParts(now).wd;
  return wd >= 1 && wd <= 5;
};

export function officeOpen(now = new Date()): boolean {
  const { wd, min } = bkkParts(now);
  return wd >= 1 && wd <= 5 && min >= OPEN_MIN && min < CLOSE_MIN;
}

/** The next moment the office opens (now, if it is open). */
export function nextOfficeOpen(now = new Date()): Date {
  if (officeOpen(now)) return now;
  for (let k = 0; k < 8; k++) {
    const day = new Date(now.getTime() + k * 86400_000);
    const { wd, date } = bkkParts(day);
    if (wd < 1 || wd > 5) continue;
    const open = new Date(`${date}T08:00:00+07:00`);
    if (open.getTime() > now.getTime()) return open;
  }
  return now;
}

/** May a message about a job starting at `startMs` go out now? */
export function mayNotifyJob(startMs: number, now = new Date()): boolean {
  if (officeOpen(now)) return true;
  return startMs < nextOfficeOpen(now).getTime() + URGENT_SLACK_MIN * 60_000;
}

export const jobStartMs = (date: string, time: string | null | undefined) => Date.parse(`${date}T${String(time || "09:00").slice(0, 5)}:00+07:00`);
