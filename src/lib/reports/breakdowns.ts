/**
 * The three reports the department is asked for, derived from the events
 * already loaded for the range — no extra tables, no extra queries.
 *
 *   - byPeriod   : month / quarter / year totals
 *   - byPerson   : what each person actually did, for the annual appraisal
 *   - byActivity : which kinds of work take the effort
 */

import type { PrEvent } from "@/types/domain";

export type Granularity = "month" | "quarter" | "year";

export type PeriodRow = {
  key: string;
  label: string;
  total: number;
  published: number;
  completed: number;
  canceled: number;
  changed: number;
  assignments: number;
};

export type PersonRow = {
  personName: string;
  total: number;
  acknowledged: number;
  pending: number;
  ackRate: number;
  urgent: number;
  roles: { roleName: string; count: number }[];
  departments: string[];
  lastDate: string;
};

export type ActivityRow = {
  activity: string;
  total: number;
  published: number;
  canceled: number;
  assignments: number;
  people: number;
  topDepartment: string;
};

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** Buddhist-era year, which is what every municipal document uses. */
function beYear(gregorian: number): number {
  return gregorian + 543;
}

function periodKeyAndLabel(iso: string, granularity: Granularity): { key: string; label: string } {
  const [yearText, monthText] = iso.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (granularity === "year") {
    return { key: yearText, label: `ปี ${beYear(year)}` };
  }
  if (granularity === "quarter") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    return { key: `${yearText}-Q${quarter}`, label: `ไตรมาส ${quarter}/${beYear(year)}` };
  }
  return { key: `${yearText}-${monthText}`, label: `${TH_MONTHS[month - 1]} ${beYear(year)}` };
}

export function byPeriod(events: PrEvent[], granularity: Granularity): PeriodRow[] {
  const rows = new Map<string, PeriodRow>();

  for (const event of events) {
    const { key, label } = periodKeyAndLabel(event.eventDate, granularity);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        label,
        total: 0,
        published: 0,
        completed: 0,
        canceled: 0,
        changed: 0,
        assignments: 0,
      };
      rows.set(key, row);
    }
    row.total += 1;
    if (event.status === "published") row.published += 1;
    if (event.status === "completed") row.completed += 1;
    if (event.status === "canceled") row.canceled += 1;
    if (event.hasChanges) row.changed += 1;
    row.assignments += event.assignments.length;
  }

  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function byPerson(events: PrEvent[]): PersonRow[] {
  type Acc = Omit<PersonRow, "roles" | "departments" | "ackRate"> & {
    roles: Map<string, number>;
    departments: Set<string>;
  };
  const rows = new Map<string, Acc>();

  for (const event of events) {
    // A canceled job was not work done; counting it would inflate an appraisal.
    if (event.status === "canceled") continue;

    for (const assignment of event.assignments) {
      const name = assignment.person.displayName;
      let row = rows.get(name);
      if (!row) {
        row = {
          personName: name,
          total: 0,
          acknowledged: 0,
          pending: 0,
          urgent: 0,
          lastDate: event.eventDate,
          roles: new Map(),
          departments: new Set(),
        };
        rows.set(name, row);
      }
      row.total += 1;
      if (assignment.ackStatus === "acknowledged") row.acknowledged += 1;
      if (assignment.ackStatus === "pending") row.pending += 1;
      // "ไม่สะดวก" with a reason is an answer, not a missed acknowledgement, so
      // it counts in neither column and does not lower anyone's response rate.
      if (event.urgency !== "normal") row.urgent += 1;
      if (event.eventDate > row.lastDate) row.lastDate = event.eventDate;
      row.roles.set(assignment.role.name, (row.roles.get(assignment.role.name) ?? 0) + 1);
      row.departments.add(event.ownerDepartment.shortName);
    }
  }

  return [...rows.values()]
    .map((row) => {
      // Jobs that never required an acknowledgement are not held against anyone.
      const answerable = row.acknowledged + row.pending;
      return {
        personName: row.personName,
        total: row.total,
        acknowledged: row.acknowledged,
        pending: row.pending,
        ackRate: answerable === 0 ? 1 : row.acknowledged / answerable,
        urgent: row.urgent,
        lastDate: row.lastDate,
        roles: [...row.roles.entries()]
          .map(([roleName, count]) => ({ roleName, count }))
          .sort((a, b) => b.count - a.count),
        departments: [...row.departments].sort(),
      };
    })
    .sort((a, b) => b.total - a.total || a.personName.localeCompare(b.personName, "th"));
}

export function byActivity(events: PrEvent[]): ActivityRow[] {
  type Acc = {
    activity: string;
    total: number;
    published: number;
    canceled: number;
    assignments: number;
    people: Set<string>;
    departments: Map<string, number>;
  };
  const rows = new Map<string, Acc>();

  for (const event of events) {
    const activity = event.eventType?.trim() || "ไม่ระบุประเภท";
    let row = rows.get(activity);
    if (!row) {
      row = {
        activity,
        total: 0,
        published: 0,
        canceled: 0,
        assignments: 0,
        people: new Set(),
        departments: new Map(),
      };
      rows.set(activity, row);
    }
    row.total += 1;
    if (event.status === "published") row.published += 1;
    if (event.status === "canceled") row.canceled += 1;
    row.assignments += event.assignments.length;
    for (const assignment of event.assignments) row.people.add(assignment.person.displayName);
    const dept = event.ownerDepartment.shortName;
    row.departments.set(dept, (row.departments.get(dept) ?? 0) + 1);
  }

  return [...rows.values()]
    .map((row) => ({
      activity: row.activity,
      total: row.total,
      published: row.published,
      canceled: row.canceled,
      assignments: row.assignments,
      people: row.people.size,
      topDepartment:
        [...row.departments.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
    }))
    .sort((a, b) => b.total - a.total);
}
