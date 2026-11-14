// Endpoint for an external scheduler (pg_cron + pg_net, or any cron caller)
// to trigger notification delivery. Not session-gated — see
// src/lib/supabase/middleware.ts PUBLIC_PREFIXES — protected instead by a
// shared secret header so only the configured caller can invoke it.

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { processDueNotifications } from "@/lib/notifications/queue";
import { announceBadges } from "@/lib/monitor/badge-awards";
import { createAdminClient } from "@/lib/supabase/server";
import { todayInBangkok } from "@/lib/date";
import { releaseHeldQuestions } from "@/lib/telegram/questions";
import { sendContestReport } from "@/lib/monitor/contest-report";

// One run can push the 07:00 summaries one by one; give it room (Vercel Hobby allows up to 60 s).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const provided = request.headers.get("x-notifications-secret");
  if (!env.notificationsCronSecret || provided !== env.notificationsCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await processDueNotifications();
    // Badge news rides along, once an hour; it never blocks the real notices.
    const badges = await announceBadges(createAdminClient(), todayInBangkok()).catch(() => 0);
    // Held team questions nobody answered in time go on to the admins (12 Nov 2026).
    const released = await releaseHeldQuestions(createAdminClient()).catch(() => 0);
    // ประกวดมุก: once the window closes, the judges get the numbered list (13 Nov 2026).
    const contest = await sendContestReport(createAdminClient()).catch(() => 0);
    return NextResponse.json({ ok: true, ...summary, badges, released, contest });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
