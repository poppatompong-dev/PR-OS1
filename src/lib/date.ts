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
