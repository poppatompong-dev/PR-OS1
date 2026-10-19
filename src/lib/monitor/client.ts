/* eslint-disable @typescript-eslint/no-explicit-any */
// Client-side fetchers for the public monitor screen.
// Call SECURITY DEFINER RPCs that return only monitor-safe fields, so the page
// works with the anon key and no user session. Falls back to mock data when
// Supabase is not configured.

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { events as mockEvents, people as mockPeople } from "@/data/mock-data";
import { todayInBangkok, addDays } from "@/lib/date";
import type { MonitorEvent, MonitorPerson } from "./types";

export async function fetchMonitorEvents(): Promise<MonitorEvent[]> {
  if (!isSupabaseConfigured()) {
    // Mirror get_monitor_events() exactly: same statuses, same 8-day window,
    // same ordering. When the two drifted apart the demo screen showed work
    // three weeks out that production would never send, and the layout was
    // being judged on data it would never actually receive.
    const from = todayInBangkok();
    const to = addDays(from, 7);
    return mockEvents
      .filter(
        (e) =>
          (e.status === "published" || e.status === "canceled") &&
          e.eventDate >= from &&
          e.eventDate <= to,
      )
      .sort((a, b) =>
        a.eventDate === b.eventDate
          ? a.startTime.localeCompare(b.startTime)
          : a.eventDate.localeCompare(b.eventDate),
      )
      .map((e) => ({
        id: e.id,
        title: e.title,
        eventDate: e.eventDate,
        startTime: e.startTime,
        endTime: e.endTime ?? "",
        shortNote: e.shortNote ?? "",
        locationName: e.location.name,
        departmentShort: e.ownerDepartment.shortName,
        roles: e.assignments.map((a) => a.role.name),
        assignees: e.assignments.map((a) => `${a.person.displayName} (${a.role.name})`),
        assigneeDetail: e.assignments.map((a) => ({
          name: a.person.displayName,
          role: a.role.name,
          ack: a.ackStatus === "acknowledged",
          unavailable: Boolean(a.unavailableReason) && a.ackStatus !== "acknowledged",
        })),
        allAck:
          e.assignments.length > 0 &&
          e.assignments.every((a) => a.ackStatus === "acknowledged"),
        hasChanges: e.hasChanges,
        status: e.status,
        // The mock rows carry the reason in shortNote; the real table has its
        // own cancellation_reason column.
        cancellationReason: e.status === "canceled" ? (e.shortNote ?? "") : "",
      }));
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_monitor_events");
  if (error || !data) return [];

  return (data as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    eventDate: r.event_date,
    startTime: (r.start_time ?? "").slice(0, 5),
    endTime: r.end_time ? String(r.end_time).slice(0, 5) : "",
    shortNote: r.short_note ?? "",
    locationName: r.location_name ?? "—",
    departmentShort: r.department_short ?? "—",
    roles: r.roles ?? [],
    assignees: r.assignees ?? [],
    assigneeDetail: ((r.assignee_detail ?? []) as any[]).map((p) => ({
      name: String(p?.name ?? ""),
      role: String(p?.role ?? ""),
      ack: Boolean(p?.ack),
      unavailable: Boolean(p?.unavailable),
    })),
    allAck: r.total_assignments > 0 && r.acknowledged_assignments >= r.total_assignments,
    hasChanges: Boolean(r.has_changes),
    status: r.status ?? "published",
    cancellationReason: r.cancellation_reason ?? "",
  }));
}

export async function fetchMonitorTeam(): Promise<MonitorPerson[]> {
  if (!isSupabaseConfigured()) {
    return mockPeople
      .filter((p) => p.isActive)
      .map((p) => ({ id: p.id, displayName: p.displayName, position: p.position }));
  }

  const supabase = createClient();
  const { data } = await supabase.rpc("get_monitor_team");
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    position: r.position_title ?? "",
  }));
}
