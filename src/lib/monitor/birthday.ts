// อวยพรวันเกิดบนทีวี (owner + กุ๊ก, 4 Nov 2026 · เลือก "B + A + C ผสม"):
// a job today whose title says วันเกิด / birthday / HBD = the people on that job
// are the birthday people. All day: a banner in the header. Every 30 min
// (07–19 น.; every 10 min in the first hour): a big show, alternating A (fireworks + big face) and C (the team's
// cartoons come out to celebrate). Nothing new to fill in — the job is the switch.

import type { MonitorEvent } from "./types";
import { nickname } from "@/lib/monitor/nicknames";

export type BirthdayPerson = { name: string; short: string; personId?: string };
export type Birthday = { people: BirthdayPerson[]; wish: string; names: string };

const RX = /วันเกิด|birthday|\bhbd\b/i;
export const BDAY_MAX_PEOPLE = 3;
export const BDAY_SHOW_EVERY_MIN = 30;
/** แป้ง ถ่ายรูปไม่ทัน (4 Nov 2026): every 10 min for the first hour of shows. */
export const BDAY_FIRST_HOUR_EVERY_MIN = 10;

export function isBirthdayJob(e: Pick<MonitorEvent, "title" | "screenTitle" | "status">): boolean {
  return e.status !== "canceled" && (RX.test(e.title) || RX.test(e.screenTitle ?? ""));
}

/** Today's birthday people, or null. `idOf` fills a missing personId from the team list. */
export function birthdayToday(
  events: MonitorEvent[],
  today: string,
  idOf: (name: string) => string | undefined = () => undefined,
): Birthday | null {
  const jobs = events.filter((e) => e.eventDate === today && isBirthdayJob(e));
  const seen = new Set<string>();
  const people: BirthdayPerson[] = [];
  for (const j of jobs) {
    for (const a of j.assigneeDetail) {
      const personId = a.personId ?? idOf(a.name);
      const key = personId ?? a.name;
      if (seen.has(key)) continue;
      seen.add(key);
      people.push({ name: a.name, short: nickname(personId, a.name), personId });
    }
  }
  if (!people.length) return null;
  const shown = people.slice(0, BDAY_MAX_PEOPLE);
  const wish = (jobs.map((j) => j.shortNote.trim()).find(Boolean) ?? "").replace(/\s+/g, " ");
  return {
    people: shown,
    wish: wish.length > 80 ? `${wish.slice(0, 79)}…` : wish,
    names: shown.map((p) => p.short).join(" · "),
  };
}
