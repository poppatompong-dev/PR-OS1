// TV "แบบแถว" (Kook's layout, 29 Oct 2026): every job is the same-size row,
// nearest first. Jobs already over today drop off so the next ones get the
// space; canceled work stays in the ticker, never in the list. Pure, Bangkok
// wall-clock minutes in; tests/monitor-rows.unit.test.ts covers it.

import type { MonitorEvent } from "@/lib/monitor/types";
import { inMinutes, minutesOf, pickHero } from "@/lib/monitor/hero";
import { addDaysIso } from "@/lib/monitor/thai-time";

export const ROWS_ON_SCREEN = 8;

export type MonitorRow = {
  event: MonitorEvent;
  day: "today" | "tomorrow" | "later";
  /** The one job the gold frame / green frame goes on. */
  state: "running" | "next" | null;
  /** Small chip text on the row, "" for none. */
  chip: string;
};

function endMinutes(e: MonitorEvent): number {
  return e.endTime ? minutesOf(e.endTime) : minutesOf(e.startTime) + 120;
}

export function pickRows(events: MonitorEvent[], today: string, now: number, limit = ROWS_ON_SCREEN): MonitorRow[] {
  const tomorrow = addDaysIso(today, 1);
  const hero = pickHero(events, today, now);
  const heroId = hero.kind === "none" ? null : hero.event.id;
  return events
    .filter((e) => e.status !== "canceled" && e.eventDate >= today)
    .filter((e) => e.eventDate > today || endMinutes(e) > now)
    .sort((a, b) => (a.eventDate === b.eventDate ? a.startTime.localeCompare(b.startTime) : a.eventDate.localeCompare(b.eventDate)))
    .slice(0, limit)
    .map((event) => {
      const day = event.eventDate === today ? "today" : event.eventDate === tomorrow ? "tomorrow" : "later";
      let state: MonitorRow["state"] = null;
      let chip = event.hasChanges ? "มีการเปลี่ยนแปลง" : "";
      if (event.id === heroId && hero.kind === "running") {
        state = "running";
        chip = `กำลังดำเนินการ · เหลือ ${inMinutes(hero.minutesLeft).replace("อีก ", "")}`;
      } else if (event.id === heroId && hero.kind === "upcoming") {
        state = "next";
        chip = hero.sameDay ? `งานถัดไป · ${inMinutes(hero.minutesTo)}` : "งานถัดไป";
      }
      return { event, day, state, chip };
    });
}

/** "นางสาวณัฏฐ์ จิรจีรังชัย" → "ณัฏฐ์": a row has room for first names only. */
export function shortName(full: string): string {
  const t = full.trim().replace(/^(นางสาว|นาย|นาง|น\.ส\.|ว่าที่ร้อยตรี|ว่าที่ ร\.ต\.)\s*/u, "");
  return t.split(/\s+/)[0] || full.trim();
}
