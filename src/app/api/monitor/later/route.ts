import { NextResponse } from "next/server";
import { addDays, todayInBangkok } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/server";
import type { MonitorEvent } from "@/lib/monitor/types";

// Jobs 15–60 days ahead for the TV (owner, 3 Nov 2026: พี่เอิร์ธ added ลอยกระทง
// for 24 Nov and it never showed — get_monitor_events() stops at 14 days).
// Same monitor-safe fields as that RPC; public, like the rest of /api/monitor.
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET() {
  try {
    const admin = createAdminClient();
    const today = todayInBangkok();
    const { data: evs, error } = await admin
      .from("events")
      .select("id, title, event_date, start_time, end_time, short_note, status, cancellation_reason, screen_title, icon, has_changes, location:locations(name), department:departments(short_name)")
      .in("status", ["published", "canceled"])
      .is("deleted_at", null)
      .gt("event_date", addDays(today, 14))
      .lte("event_date", addDays(today, 60))
      .order("event_date")
      .order("start_time");
    if (error) throw error;
    const rows = (evs ?? []) as any[];
    const ids = rows.map((e) => e.id);
    const asgRows: any[] = ids.length
      ? ((await admin.from("assignments").select("id, event_id, person_id, unavailable_at, role_names, person:people(display_name)").eq("assignment_status", "assigned").in("event_id", ids)).data ?? [])
      : [];
    const ackRows: any[] = asgRows.length
      ? ((await admin.from("v_assignment_ack_status").select("assignment_id, ack_status").in("assignment_id", asgRows.map((a) => a.id))).data ?? [])
      : [];
    const acked = new Set(ackRows.filter((k) => k.ack_status === "acknowledged").map((k) => k.assignment_id));

    const out: MonitorEvent[] = rows.map((e) => {
      const detail = asgRows
        .filter((a) => a.event_id === e.id)
        .map((a) => ({
          name: String(a.person?.display_name ?? ""),
          role: String(a.role_names ?? ""),
          ack: acked.has(a.id),
          unavailable: Boolean(a.unavailable_at),
          personId: String(a.person_id),
        }));
      return {
        id: e.id,
        title: e.title,
        eventDate: e.event_date,
        startTime: String(e.start_time ?? "").slice(0, 5),
        endTime: e.end_time ? String(e.end_time).slice(0, 5) : "",
        shortNote: e.short_note ?? "",
        locationName: e.location?.name ?? "—",
        departmentShort: e.department?.short_name ?? "—",
        roles: [...new Set(detail.map((d) => d.role))],
        assignees: detail.map((d) => `${d.name} (${d.role})`),
        assigneeDetail: detail,
        allAck: detail.length > 0 && detail.every((d) => d.ack),
        hasChanges: Boolean(e.has_changes),
        status: e.status,
        cancellationReason: e.cancellation_reason ?? "",
        screenTitle: e.screen_title ?? "",
        icon: e.icon ?? "",
      };
    });
    return NextResponse.json({ events: out }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ events: [] }, { status: 503 });
  }
}
