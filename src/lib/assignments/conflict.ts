// How serious is it that someone has another job on the same day? (owner, 21 Oct 2026)
//   clash   — the times overlap, or one ends less than 30 minutes before the
//             other starts (no time to travel): an amber "เวลาชน" warning
//   sameDay — same day but well apart: a small grey note only
// A job with no end time is taken as one hour long.

export const TRAVEL_BUFFER_MIN = 30;
const DEFAULT_LENGTH_MIN = 60;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function span(start: string, end?: string | null): [number, number] {
  const s = toMin(start);
  const e = end ? toMin(end) : s + DEFAULT_LENGTH_MIN;
  return [s, Math.max(e, s + 1)];
}

export type ConflictLevel = "clash" | "sameDay";

export function conflictLevel(
  a: { startTime: string; endTime?: string | null },
  b: { startTime: string; endTime?: string | null },
  bufferMin = TRAVEL_BUFFER_MIN,
): ConflictLevel {
  const [as, ae] = span(a.startTime, a.endTime);
  const [bs, be] = span(b.startTime, b.endTime);
  const gap = Math.max(bs - ae, as - be); // < 0 means they overlap
  return gap < bufferMin ? "clash" : "sameDay";
}
