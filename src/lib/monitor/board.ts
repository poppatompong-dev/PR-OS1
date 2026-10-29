// TV "ผังคุณกุ๊ก" (29 Oct 2026), pure layout logic:
//   top-left  3 numbers: งานวันนี้ · ยังไม่รับงาน (today) · 7 วันข้างหน้า
//   left card today's jobs still to come (a finished one drops off)
//   right     the next 4 days that have work (empty days skipped)
//   bottom    the 6 calendar days after those, up to 2 jobs each
// Covered by tests/monitor-board.unit.test.ts.

import type { MonitorEvent } from "@/lib/monitor/types";
import { minutesOf } from "@/lib/monitor/hero";
import { addDaysIso } from "@/lib/monitor/thai-time";

export type DayGroup = { iso: string; events: MonitorEvent[] };

export type Board = {
  stats: { today: number; pending: number; week: number };
  todayJobs: MonitorEvent[];
  dayRows: DayGroup[];
  cells: DayGroup[];
};

const byTime = (a: MonitorEvent, b: MonitorEvent) =>
  a.eventDate === b.eventDate ? a.startTime.localeCompare(b.startTime) : a.eventDate.localeCompare(b.eventDate);

function endMinutes(e: MonitorEvent): number {
  return e.endTime ? minutesOf(e.endTime) : minutesOf(e.startTime) + 120;
}

export function buildBoard(events: MonitorEvent[], today: string, now: number, opts: { rows?: number; cells?: number; horizonDays?: number } = {}): Board {
  const rows = opts.rows ?? 4;
  const cellCount = opts.cells ?? 6;
  const horizon = addDaysIso(today, opts.horizonDays ?? 14);
  const live = events.filter((e) => e.status !== "canceled" && e.eventDate >= today && e.eventDate <= horizon).sort(byTime);
  const todays = live.filter((e) => e.eventDate === today);
  const week = addDaysIso(today, 7);

  const later = new Map<string, MonitorEvent[]>();
  for (const e of live) if (e.eventDate > today) later.set(e.eventDate, [...(later.get(e.eventDate) ?? []), e]);
  const dayRows = [...later.keys()].sort().slice(0, rows).map((iso) => ({ iso, events: later.get(iso)! }));

  const start = dayRows.length ? dayRows[dayRows.length - 1].iso : today;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const iso = addDaysIso(start, i + 1);
    return { iso, events: later.get(iso) ?? [] };
  });

  return {
    stats: {
      today: todays.length,
      pending: todays.flatMap((e) => e.assigneeDetail).filter((p) => !p.ack && !p.unavailable).length,
      week: live.filter((e) => e.eventDate > today && e.eventDate <= week).length,
    },
    todayJobs: todays.filter((e) => endMinutes(e) > now),
    dayRows,
    cells,
  };
}

/** "09:30" → "09.30 น."; with an end: "09.30 น. - 11.30 น." */
export function thaiTime(start: string, end?: string | null): string {
  const t = (s: string) => `${s.replace(":", ".")} น.`;
  return end ? `${t(start)} - ${t(end)}` : t(start);
}

/** The short screen title when the job has one. */
export function screenTitle(e: MonitorEvent): string {
  return (e.screenTitle || "").trim() || e.title;
}

/** Shrink long titles a step or two before they are cut off. */
export function titleSize(text: string): "" | "is-long" | "is-xlong" {
  const n = [...text].length;
  return n > 46 ? "is-xlong" : n > 28 ? "is-long" : "";
}
