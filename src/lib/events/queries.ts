/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-side data access for the schedule.
// One nested PostgREST query pulls events + assignments + people + roles + ack
// in a single round trip (no N+1), then maps DB rows into the PrEvent domain type
// so existing UI components work unchanged.
// Supabase nested-select results are dynamically shaped (no generated DB types),
// so `any` is used at the mapping boundary — consistent with the monitor modules.

import { createClient } from "@/lib/supabase/server";
import type { AckStatus, Assignment, Department, PrEvent } from "@/types/domain";

export type ScheduleFilters = {
  from?: string;
  to?: string;
  status?: string; // draft | published | completed | canceled | all
  departmentId?: string; // master id | all
  search?: string;
};

const EVENT_SELECT = `
  id, title, description, event_date, start_time, end_time,
  intake_channel, status, urgency, short_note, internal_note, has_changes,
  cancellation_reason, updated_at,
  location:locations(id, name, description),
  owner_department:departments(id, name, short_name),
  event_type:event_types(id, name, color),
  assignments(
    id, assignment_version, assignment_status, note,
    person:people(id, display_name, position, is_active),
    role:roles(id, code, name, color),
    acknowledgements(assignment_version, acknowledged_at)
  )
`;

export async function getScheduleEvents(
  filters: ScheduleFilters = {},
): Promise<PrEvent[]> {
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .is("deleted_at", null)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(100);

  if (filters.from) query = query.gte("event_date", filters.from);
  if (filters.to) query = query.lte("event_date", filters.to);
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.departmentId && filters.departmentId !== "all") {
    query = query.eq("owner_department_id", filters.departmentId);
  }
  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getScheduleEvents: ${error.message}`);

  return (data ?? []).map(mapEvent);
}

export type AuditEntry = {
  id: string;
  action: string;
  summary: string;
  changedAt: string;
};

// Audit history for one event. RLS limits reads to admin/supervisor;
// other roles simply get an empty list.
export async function getEventAuditLog(eventId: string): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, summary, changed_at")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .order("changed_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    summary: r.summary,
    changedAt: r.changed_at,
  }));
}

export type EventFormData = {
  locations: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  eventTypes: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  people: { id: string; display_name: string }[];
};

export async function getEventFormData(): Promise<EventFormData> {
  const supabase = await createClient();
  const [locations, departments, eventTypes, roles, people] = await Promise.all([
    supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    supabase.from("event_types").select("id, name").eq("is_active", true).order("name"),
    supabase.from("roles").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("people")
      .select("id, display_name")
      .eq("is_active", true)
      .order("display_name"),
  ]);

  return {
    locations: locations.data ?? [],
    departments: departments.data ?? [],
    eventTypes: eventTypes.data ?? [],
    roles: roles.data ?? [],
    people: people.data ?? [],
  };
}

export async function getDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`getDepartments: ${error.message}`);

  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    shortName: d.short_name ?? "",
  }));
}

// --- mapping ---------------------------------------------------------------

// PostgREST returns to-one embeds as either an object or a single-item array
// depending on inference; normalize to one object.
function one<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function trimTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

function mapEvent(row: any): PrEvent {
  const location = one<any>(row.location);
  const department = one<any>(row.owner_department);
  const eventType = one<any>(row.event_type);
  const published = row.status === "published";

  const assignments: Assignment[] = (row.assignments ?? [])
    .filter((a: any) => a.assignment_status === "assigned")
    .map((a: any): Assignment => {
      const person = one<any>(a.person);
      const role = one<any>(a.role);
      const acks = Array.isArray(a.acknowledgements) ? a.acknowledgements : [];
      const matched = acks.find(
        (ack: any) => ack.assignment_version === a.assignment_version,
      );

      // Ack only matters for published events; drafts are "not required" yet.
      const ackStatus: AckStatus = !published
        ? "not_required"
        : matched
          ? "acknowledged"
          : "pending";

      return {
        id: a.id,
        person: {
          id: person?.id ?? "",
          displayName: person?.display_name ?? "—",
          position: person?.position ?? "",
          isActive: person?.is_active ?? true,
        },
        role: {
          id: role?.id ?? "",
          code: role?.code ?? "",
          name: role?.name ?? "—",
          color: role?.color ?? "gray",
        },
        ackStatus,
        acknowledgedAt: matched?.acknowledged_at ?? undefined,
        note: a.note ?? undefined,
      };
    });

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    eventDate: row.event_date,
    startTime: trimTime(row.start_time),
    endTime: row.end_time ? trimTime(row.end_time) : undefined,
    location: {
      id: location?.id ?? "",
      name: location?.name ?? "—",
      description: location?.description ?? undefined,
    },
    ownerDepartment: {
      id: department?.id ?? "",
      name: department?.name ?? "—",
      shortName: department?.short_name ?? "—",
    },
    eventType: eventType?.name ?? "—",
    intakeChannel: row.intake_channel ?? "",
    status: row.status,
    urgency: row.urgency,
    shortNote: row.short_note ?? undefined,
    internalNote: row.internal_note ?? undefined,
    hasChanges: Boolean(row.has_changes),
    assignments,
    updatedAt: row.updated_at,
  };
}

export type EventDetail = PrEvent & {
  cancellationReason?: string;
  eventTypeId?: string;
};

export async function getEventById(id: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getEventById: ${error.message}`);
  if (!data) return null;

  return {
    ...mapEvent(data),
    cancellationReason: (data as any).cancellation_reason ?? undefined,
    eventTypeId: one<any>((data as any).event_type)?.id,
  };
}
