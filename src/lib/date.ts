/**
 * Calendar helpers. Everything in this system is scheduled in Thai local
 * time, so "today" must be resolved in Asia/Bangkok — never from the
 * server's own clock, which on Vercel is UTC and rolls over 7 hours late.
 */

/** Today's date in Asia/Bangkok, as YYYY-MM-DD. */
export function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type RangePreset =
  | "this-month"
  | "this-quarter"
  | "fiscal-year"
  | "last-12-months"
  | "next-30-days";

/** Last day of a month, as YYYY-MM-DD. */
function endOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Named ranges, resolved against today in Bangkok.
 *
 * "fiscal-year" is the Thai government year: 1 October to 30 September,
 * named by the Buddhist-era year it ends in. Calendar-year totals are not
 * what a municipal annual report is written against.
 */
export function resolveRange(preset: RangePreset, today = todayInBangkok()): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);

  switch (preset) {
    case "this-month":
      return { from: `${y}-${pad(m)}-01`, to: endOfMonth(y, m) };

    case "this-quarter": {
      const firstMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${y}-${pad(firstMonth)}-01`, to: endOfMonth(y, firstMonth + 2) };
    }

    case "fiscal-year": {
      const startYear = m >= 10 ? y : y - 1;
      return { from: `${startYear}-10-01`, to: `${startYear + 1}-09-30` };
    }

    case "last-12-months": {
      const startYear = m === 12 ? y : y - 1;
      const startMonth = m === 12 ? 1 : m + 1;
      return { from: `${startYear}-${pad(startMonth)}-01`, to: endOfMonth(y, m) };
    }

    case "next-30-days":
    default:
      return { from: today, to: addDays(today, 30) };
  }
}

/** The Buddhist-era label for the fiscal year that `today` falls in. */
export function fiscalYearLabel(today = todayInBangkok()): string {
  const [y, m] = today.split("-").map(Number);
  const endYear = m >= 10 ? y + 1 : y;
  return `ปีงบประมาณ ${endYear + 543}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date written YYYY-MM-DD. "2026-02-30" and
 *  anything that merely looks date-shaped are rejected, because they reach
 *  Intl and Postgres from a hand-edited or stale URL and crash the page. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** A report range that is always safe to query and to print: bad input falls
 *  back, and a range entered backwards is turned the right way round rather
 *  than silently returning nothing. */
export function safeRange(
  from: unknown,
  to: unknown,
  fallbackFrom: string,
  fallbackTo: string,
): { from: string; to: string } {
  let f = isIsoDate(from) ? from : fallbackFrom;
  let t = isIsoDate(to) ? to : fallbackTo;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}
