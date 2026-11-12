// The office TV is on 08:30–16:30 on government working days and switched off after work
// (owner, 12 Nov 2026). Nothing is forbidden outside these hours — whoever turns the TV on
// for a weekend job still gets the full board — but anything *timed* is planned inside them.

import type { MonitorEvent } from "@/lib/monitor/types";
import { addDaysIso, isoParts } from "@/lib/monitor/thai-time";

export const TV_ON_MIN = 8 * 60 + 30;
export const TV_OFF_MIN = 16 * 60 + 30;

/** Good-morning card: the first half hour the TV is on. */
export const AM_FROM = TV_ON_MIN - 30; // a TV turned on a little early still gets it
export const AM_TO = TV_ON_MIN + 30;
/** Before-you-go card: the last half hour. */
export const PM_FROM = TV_OFF_MIN - 30;
export const PM_TO = TV_OFF_MIN + 15;

export type Edge = "am" | "pm";
export function edgeNow(minutes: number): Edge | null {
  if (minutes >= AM_FROM && minutes < AM_TO) return "am";
  if (minutes >= PM_FROM && minutes < PM_TO) return "pm";
  return null;
}

const live = (e: Pick<MonitorEvent, "status">) => e.status !== "canceled";
const byTime = (a: MonitorEvent, b: MonitorEvent) => a.eventDate.localeCompare(b.eventDate) || a.startTime.localeCompare(b.startTime);

/** Today's jobs, in time order (cancelled ones left out). */
export function jobsToday<T extends MonitorEvent>(events: T[], today: string): T[] {
  return events.filter((e) => e.eventDate === today && live(e)).sort(byTime);
}

/** Tomorrow through the next working day: Mon–Thu → tomorrow; Fri → Sat, Sun, Mon; Sat → Sun, Mon. */
export function daysUntilBack(today: string): string[] {
  const out: string[] = [];
  for (let k = 1; k <= 4; k++) {
    const d = addDaysIso(today, k);
    out.push(d);
    const wd = isoParts(d).weekday;
    if (wd >= 1 && wd <= 5) break;
  }
  return out;
}

/** What people should know before the TV goes off: tonight's jobs, and those until they are back. */
export function jobsBeforeBack<T extends MonitorEvent>(events: T[], today: string, offMin = TV_OFF_MIN): { tonight: T[]; next: T[]; days: string[] } {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const days = daysUntilBack(today);
  return {
    tonight: events.filter((e) => e.eventDate === today && live(e) && mins(e.startTime || "00:00") >= offMin).sort(byTime),
    next: events.filter((e) => days.includes(e.eventDate) && live(e)).sort(byTime),
    days,
  };
}
