// Management report aggregation. Reuses the N+1-free schedule query and
// computes KPIs / workload / unacknowledged in memory (pilot scale: 50-300 events).

import { getScheduleEvents } from "@/lib/events/queries";
import { buildSmartSummary } from "@/lib/reports/smart-summary";
import type { PrEvent } from "@/types/domain";
import { todayInBangkok } from "@/lib/date";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { isTestTitle } from "@/lib/monitor/team-stats";

/** Assignment ids the system tried to card and could not, because the person
 *  has no Telegram/LINE (skipped "ยังไม่ผูก…") and nothing was ever sent.
 *  Server-only; only the yes/no reaches the page. null = unknown. */
async function unreachedAssignments(ids: string[]): Promise<Set<string> | null> {
  if (!isSupabaseConfigured() || !ids.length) return null;
  try {
    const admin = createAdminClient();
    const sent = new Set<string>();
    const unlinked = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await admin
        .from("notifications")
        .select("assignment_id, status, error_message")
        .in("assignment_id", ids.slice(i, i + 200))
        .in("status", ["sent", "skipped"]);
      if (error) return null;
      for (const r of data ?? []) {
        const id = r.assignment_id as string | null;
        if (!id) continue;
        if (r.status === "sent") sent.add(id);
        else if (String(r.error_message ?? "").includes("ยังไม่ผูก")) unlinked.add(id);
      }
    }
    for (const id of sent) unlinked.delete(id);
    return unlinked;
  } catch {
    return null; // unknown → old behaviour
  }
}

export type WorkloadRow = { personName: string; count: number };
export type UnackedRow = {
  eventTitle: string;
  eventDate: string;
  personName: string;
  roleName: string;
  /** true = never got the card (no Telegram/LINE) — tell them in person. */
  notReached?: boolean;
};

export type ReportData = {
  from: string;
  to: string;
  totalEvents: number;
  publishedEvents: number;
  pendingAcks: number;
  /** Assigned people the system could not reach at all (counted apart from pendingAcks). */
  notReached: number;
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
  // Test jobs ("ทดสอบ" in the title) are not work done (owner, 4 Nov 2026).
  const events = (
    await getScheduleEvents({
      from: filters.from,
      to: filters.to,
      departmentId: filters.departmentId,
      limit: 3000,
    })
  )
    .filter((e) => !isTestTitle(e.title))
    // Test people ("[ทดสอบ] …") are not staff either.
    .map((e) => ({ ...e, assignments: e.assignments.filter((a) => !a.person.displayName.startsWith("[ทดสอบ]")) }));
  const unreached = await unreachedAssignments(events.flatMap((e) => e.assignments.map((a) => a.id)));
  if (unreached) for (const e of events) for (const a of e.assignments) a.notified = !unreached.has(a.id);

  const today = todayInBangkok();
  const publishedEvents = events.filter((e) => e.status === "published").length;
  const canceledEvents = events.filter((e) => e.status === "canceled").length;
  const changedEvents = events.filter((e) => e.hasChanges).length;
  const changedOrCanceled = events.filter(
    (e) => e.hasChanges || e.status === "canceled",
  ).length;
  const todayEvents = events.filter((e) => e.eventDate === today).length;

  let pendingAcks = 0;
  let notReached = 0;
  const workloadMap = new Map<string, number>();
  const unacked: UnackedRow[] = [];

  for (const event of events) {
    for (const assignment of event.assignments) {
      workloadMap.set(
        assignment.person.displayName,
        (workloadMap.get(assignment.person.displayName) ?? 0) + 1,
      );
      if (assignment.ackStatus === "pending") {
        const missed = assignment.notified === false;
        if (missed) notReached += 1;
        else pendingAcks += 1;
        if (event.status === "published") {
          unacked.push({
            eventTitle: event.title,
            eventDate: event.eventDate,
            personName: assignment.person.displayName,
            roleName: assignment.role.name,
            notReached: missed || undefined,
          });
        }
      }
    }
  }

  const workload = [...workloadMap.entries()]
    .map(([personName, count]) => ({ personName, count }))
    .sort((a, b) => b.count - a.count);
  // Name + count: a bare name said nothing about how far ahead (owner, 4 Nov 2026).
  const topWorkloadPerson = workload[0] ? `${workload[0].personName} · ${workload[0].count} งาน` : "—";

  const smartSummary = buildSmartSummary({
    totalEvents: events.length,
    publishedEvents,
    pendingAcks,
    notReached,
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
    notReached,
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
