// Send what was just queued without waiting for the scheduler.
//
// Publishing, changing or cancelling a job queues LINE messages. Until
// 20 Oct 2026 they waited for the GitHub Actions cron, which GitHub ran only
// once in a whole afternoon, so a new job could sit unsent for hours. Now the
// server action asks for one processing run right after the response is sent
// (Next's after()), so the assignee gets the card within seconds. The
// scheduler (Supabase pg_cron, migration 0015) still handles the timed parts:
// the 07:00 summary, the 1.5-hour reminder and the 17:00 admin report.
//
// The processor takes a lock, so this never double-sends with a scheduled run;
// if a run is already busy, the queued rows simply go out on the next one.

import { after } from "next/server";
import { processDueNotifications } from "@/lib/notifications/queue";

export function kickNotifications() {
  after(async () => {
    try {
      await processDueNotifications();
    } catch (err) {
      console.error("kickNotifications:", err instanceof Error ? err.message : err);
    }
  });
}
