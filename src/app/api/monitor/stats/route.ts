import { NextResponse } from "next/server";
import { todayInBangkok } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/server";
import { loadTeamStats } from "@/lib/monitor/team-stats";

// Public (the TV has no account): team totals only, no names, no job details.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await loadTeamStats(createAdminClient(), todayInBangkok());
    return NextResponse.json(stats, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
