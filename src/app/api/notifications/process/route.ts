// Endpoint for an external scheduler (pg_cron + pg_net, or any cron caller)
// to trigger notification delivery. Not session-gated — see
// src/lib/supabase/middleware.ts PUBLIC_PREFIXES — protected instead by a
// shared secret header so only the configured caller can invoke it.

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { processDueNotifications } from "@/lib/notifications/queue";

// One run can push the 07:00 summaries one by one; give it room (Vercel Hobby allows up to 60 s).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const provided = request.headers.get("x-notifications-secret");
  if (!env.notificationsCronSecret || provided !== env.notificationsCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await processDueNotifications();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
