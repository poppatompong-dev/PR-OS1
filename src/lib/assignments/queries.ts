// Read-side data access for the assignee mobile page.

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import type { EventStatus } from "@/types/domain";

export type MyTask = {
  assignmentId: string;
  assignmentVersion: number;
  roleName: string;
  acknowledged: boolean;
  event: {
    id: string;
    title: string;
    eventDate: string;
    startTime: string;
    endTime?: string;
    locationName: string;
    departmentName: string;
    shortNote?: string;
    status: EventStatus;
    hasChanges: boolean;
  };
};

export type MyAssignments = {
  displayName: string | null;
  personLinked: boolean;
  lineLinked: boolean;
  tasks: MyTask[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

export async function getMyAssignments(): Promise<MyAssignments> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) return { displayName: null, personLinked: false, lineLinked: false, tasks: [] };
  if (!user.personId) {
    return { displayName: user.displayName, personLinked: false, lineLinked: false, tasks: [] };
  }

  const { data: personRow } = await supabase
    .from("people")
    .select("line_user_id")
    .eq("id", user.personId)
    .maybeSingle();
  const lineLinked = Boolean(personRow?.line_user_id);

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      id, assignment_version, assignment_status,
      role:roles(name),
      acknowledgements(assignment_version),
      event:events!inner(
        id, title, event_date, start_time, end_time, short_note, status, has_changes, deleted_at,
        location:locations(name),
        owner_department:departments(name)
      )
    `,
    )
    .eq("person_id", user.personId)
    .eq("assignment_status", "assigned");

  if (error) throw new Error(`getMyAssignments: ${error.message}`);

  const tasks: MyTask[] = (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => ({ a, ev: one(a.event) }))
    // Assignees see published/canceled/completed work, not unpublished drafts.
    .filter(({ ev }) => ev && !ev.deleted_at && ev.status !== "draft")
    .map(({ a, ev }) => {
      const acks = Array.isArray(a.acknowledgements) ? a.acknowledgements : [];
      const acknowledged = acks.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (k: any) => k.assignment_version === a.assignment_version,
      );
      return {
        assignmentId: a.id,
        assignmentVersion: a.assignment_version,
        roleName: one(a.role)?.name ?? "—",
        acknowledged,
        event: {
          id: ev.id,
          title: ev.title,
          eventDate: ev.event_date,
          startTime: (ev.start_time ?? "").slice(0, 5),
          endTime: ev.end_time ? String(ev.end_time).slice(0, 5) : undefined,
          locationName: one(ev.location)?.name ?? "—",
          departmentName: one(ev.owner_department)?.name ?? "—",
          shortNote: ev.short_note ?? undefined,
          status: ev.status as EventStatus,
          hasChanges: Boolean(ev.has_changes),
        },
      };
    })
    .sort((x, y) =>
      `${x.event.eventDate}${x.event.startTime}`.localeCompare(
        `${y.event.eventDate}${y.event.startTime}`,
      ),
    );

  return { displayName: user.displayName, personLinked: true, lineLinked, tasks };
}
