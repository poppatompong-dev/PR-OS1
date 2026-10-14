// Management report aggregation. Reuses the N+1-free schedule query and
// computes KPIs / workload / unacknowledged in memory (pilot scale: 50-300 events).

import { getScheduleEvents } from "@/lib/events/queries";
import { buildSmartSummary } from "@/lib/reports/smart-summary";
import type { PrEvent } from "@/types/domain";
import { todayInBangkok } from "@/lib/date";

export type WorkloadRow = { personName: string; count: number };
export type UnackedRow = {
  eventTitle: string;
  eventDate: string;
  personName: string;
  roleName: string;
  // "declined" = pressed ไม่สะดวก. The reason is deliberately not carried
  // into reports or exports: it can be personal (illness, family).
  status: "pending" | "declined";
};

export type ReportData = {
  from: string;
  to: string;
  totalEvents: number;
  publishedEvents: number;
  pendingAcks: number;
  changedOrCanceled: number;
  changedEvents: number;
  canceledEvents: number;
  todayEvents: number;
  topWorkloadPerson: string;
  workload: WorkloadRow[];
  unacked: UnackedRow[];
  smartSummary: string;
  events: PrEvent[];
};

export async function getReportData(filters: {
  from: string;
  to: string;
  departmentId?: string;
}): Promise<ReportData> {
  const events = await getScheduleEvents({
    from: filters.from,
    to: filters.to,
    departmentId: filters.departmentId,
  });

  const today = todayInBangkok();
  const publishedEvents = events.filter((e) => e.status === "published").length;
  const canceledEvents = events.filter((e) => e.status === "canceled").length;
  const changedEvents = events.filter((e) => e.hasChanges).length;
  const changedOrCanceled = events.filter(
    (e) => e.hasChanges || e.status === "canceled",
  ).length;
  const todayEvents = events.filter((e) => e.eventDate === today).length;

  let pendingAcks = 0;
  const workloadMap = new Map<string, number>();
  const unacked: UnackedRow[] = [];

  for (const event of events) {
    for (const assignment of event.assignments) {
      workloadMap.set(
        assignment.person.displayName,
        (workloadMap.get(assignment.person.displayName) ?? 0) + 1,
      );
      if (assignment.ackStatus === "pending" || assignment.ackStatus === "declined") {
        pendingAcks += 1;
        if (event.status === "published") {
          unacked.push({
            eventTitle: event.title,
            eventDate: event.eventDate,
            personName: assignment.person.displayName,
            roleName: assignment.role.name,
            status: assignment.ackStatus,
          });
        }
      }
    }
  }

  const workload = [...workloadMap.entries()]
    .map(([personName, count]) => ({ personName, count }))
    .sort((a, b) => b.count - a.count);
  const topWorkloadPerson = workload[0]?.personName ?? "—";

  const smartSummary = buildSmartSummary({
    totalEvents: events.length,
    publishedEvents,
    pendingAcks,
    changedEvents,
    canceledEvents,
    todayEvents,
    topWorkloadPerson,
  });

  return {
    from: filters.from,
    to: filters.to,
    totalEvents: events.length,
    publishedEvents,
    pendingAcks,
    changedOrCanceled,
    changedEvents,
    canceledEvents,
    todayEvents,
    topWorkloadPerson,
    workload,
    unacked,
    smartSummary,
    events,
  };
}
