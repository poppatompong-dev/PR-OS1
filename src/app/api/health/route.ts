import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { LAST_RUN_KEY, schedulerHealth, type LastRun } from "@/lib/notifications/health";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      status: "ok",
      mode: "mock",
      timestamp,
      message: "PR-OS is running in mock prototype mode.",
    });
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("settings")
      .select("key", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          mode: "live",
          timestamp,
          database: "error",
          error: error.message,
        },
        { status: 500 },
      );
    }

    // Scheduler heartbeat (no secrets: just when the queue was last processed).
    let scheduler = schedulerHealth(null);
    try {
      const { data: row } = await createAdminClient().from("settings").select("value").eq("key", LAST_RUN_KEY).maybeSingle();
      scheduler = schedulerHealth((row?.value as LastRun | undefined) ?? null);
    } catch {
      // leave as "never"
    }

    return NextResponse.json({
      status: scheduler.state === "stale" ? "degraded" : "healthy",
      mode: "live",
      timestamp,
      database: "connected",
      settingsCount: count ?? 0,
      scheduler: { state: scheduler.state, ageMinutes: scheduler.ageMinutes, lastRunAt: scheduler.lastRunAt },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        mode: "live",
        timestamp,
        error: err instanceof Error ? err.message : "unknown health error",
      },
      { status: 500 },
    );
  }
}
