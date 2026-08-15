import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    return NextResponse.json({
      status: "healthy",
      mode: "live",
      timestamp,
      database: "connected",
      settingsCount: count ?? 0,
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
