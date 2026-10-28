// "แบบ A · งานถัดไปเด่น" (owner picked it on 28 Oct 2026): which job gets the big
// card, and what its tag and bar say. Pure, Bangkok wall-clock minutes in,
// covered by tests/monitor-hero.unit.test.ts.

import type { MonitorEvent } from "@/lib/monitor/types";

export type HeroState =
  | { kind: "running"; event: MonitorEvent; minutesLeft: number; progress: number }
  | { kind: "upcoming"; event: MonitorEvent; minutesTo: number; sameDay: boolean; progress: number }
  | { kind: "none" };

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** A job with no end time is treated as two hours long (same rule as the clash check). */
function endMinutes(e: MonitorEvent): number {
  return e.endTime ? minutesOf(e.endTime) : minutesOf(e.startTime) + 120;
}

/** Days between two YYYY-MM-DD dates (b − a). */
function dayDiff(a: string, b: string): number {
  const t = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/**
 * The job happening now, else the nearest one still to come in the feed
 * (today first, then the days ahead). Canceled work never takes the card.
 * The bar: while it runs, how much of it is left; before it starts, how much
 * of the last two hours of preparation is left.
 */
export function pickHero(events: MonitorEvent[], today: string, now: number): HeroState {
  const live = events
    .filter((e) => e.status !== "canceled" && e.eventDate >= today)
    .sort((a, b) => (a.eventDate === b.eventDate ? a.startTime.localeCompare(b.startTime) : a.eventDate.localeCompare(b.eventDate)));

  const running = live.find((e) => e.eventDate === today && minutesOf(e.startTime) <= now && endMinutes(e) > now);
  const next = live.find((e) => e.eventDate > today || minutesOf(e.startTime) > now);

  // Something starting within 15 minutes matters more than the tail of a running job.
  if (next && next.eventDate === today && minutesOf(next.startTime) - now <= 15 && running) {
    const minutesTo = minutesOf(next.startTime) - now;
    return { kind: "upcoming", event: next, minutesTo, sameDay: true, progress: clamp(minutesTo / 120) };
  }
  if (running) {
    const start = minutesOf(running.startTime);
    const end = endMinutes(running);
    return { kind: "running", event: running, minutesLeft: end - now, progress: clamp((end - now) / Math.max(1, end - start)) };
  }
  if (next) {
    const minutesTo = dayDiff(today, next.eventDate) * 1440 + minutesOf(next.startTime) - now;
    return { kind: "upcoming", event: next, minutesTo, sameDay: next.eventDate === today, progress: clamp(minutesTo / 120) };
  }
  return { kind: "none" };
}

function clamp(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** "อีก 20 นาที", "อีก 1 ชม. 5 นาที", "อีก 2 ชม." — for the tag on the card. */
export function inMinutes(m: number): string {
  if (m <= 0) return "เริ่มแล้ว";
  if (m < 60) return `อีก ${m} นาที`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `อีก ${h} ชม. ${r} นาที` : `อีก ${h} ชม.`;
}
