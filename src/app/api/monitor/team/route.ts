import { NextResponse } from "next/server";
import { todayInBangkok } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBench } from "@/lib/monitor/badges";

// Public (the TV has no account): nicknames, badges and "out today" only.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bench = await loadBench(createAdminClient(), todayInBangkok());
    return NextResponse.json(bench, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
