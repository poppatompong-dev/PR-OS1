// ประกวดมุก (owner, 10 Nov 2026 · รางวัลจากพี่เอิร์ธ · พี่เอิร์ธตัดสิน): jokes sent with
// "มุก" in the bot during the window count. The TV shows a small chip under the
// title: days left + how many jokes are in, then "ปิดรับแล้ว · รอประกาศผล" until
// the results day. Next contest: change these dates.

export const CONTEST = {
  title: "ประกวดมุก",
  start: "2026-11-10T00:00:00+07:00",
  end: "2026-11-20T16:00:00+07:00",
  results: "2026-11-23",
};

export type ContestState = { phase: "open"; daysLeft: number; submitted: number } | { phase: "judging"; submitted: number } | null;

const bkkDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);

export function contestState(now: Date, submitted: number): ContestState {
  const t = now.getTime();
  if (t < Date.parse(CONTEST.start)) return null;
  if (t < Date.parse(CONTEST.end)) {
    const days = Math.round((Date.parse(`${bkkDay(new Date(CONTEST.end))}T00:00:00+07:00`) - Date.parse(`${bkkDay(now)}T00:00:00+07:00`)) / 86_400_000);
    return { phase: "open", daysLeft: Math.max(0, days), submitted };
  }
  return bkkDay(now) <= CONTEST.results ? { phase: "judging", submitted } : null;
}

export function contestChip(s: ContestState): string | null {
  if (!s) return null;
  if (s.phase === "judging") return `🎤 ปิดรับมุกแล้ว ${s.submitted} มุก · รอพี่เอิร์ธประกาศผล 🏆`;
  const left = s.daysLeft === 0 ? "วันสุดท้าย! ถึง 16.00 น." : `เหลือ ${s.daysLeft} วัน`;
  return `🎤 ประกวดมุก ${left} · ส่งแล้ว ${s.submitted} มุก`;
}

/** Approved contest jokes as ticker lines (owner, 10 Nov 2026: text first, the gag scene later). */
export function contestTickerLines(jokes: Array<{ name: string; setup: string; punch: string; at?: string; no?: number }>): string[] {
  const from = Date.parse(CONTEST.start), to = Date.parse(CONTEST.end);
  return jokes
    .filter((j) => j.at && Date.parse(j.at) >= from && Date.parse(j.at) <= to)
    .map((j) => `😂 มุกประกวด${j.no ? `ที่ ${j.no} ` : ""}จาก ${j.name}: ${j.setup ? `${j.setup} → ` : ""}${j.punch}`);
}

/**
 * มุกที่ N (owner + พี่เอิร์ธ, 12 Nov 2026): contest jokes are numbered in the order they
 * were sent, first = 1. Rejected ones take no number, so a joke's number never moves
 * once the admins have decided on the ones before it. The judging list uses the same numbers.
 */
export function contestNumbers(sent: Array<{ id: string; at: string }>, rejected: Set<string>): Map<string, number> {
  const from = Date.parse(CONTEST.start), to = Date.parse(CONTEST.end);
  const out = new Map<string, number>();
  let n = 0;
  for (const s of [...sent].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const t = Date.parse(s.at);
    if (t < from || t > to || rejected.has(s.id)) continue;
    out.set(s.id, ++n);
  }
  return out;
}
