import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { loadApprovedJokes } from "@/lib/tv-jokes";
import { CONTEST, contestState } from "@/lib/monitor/contest";

// Public (the TV has no account): approved jokes + the sender's nickname only.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const [jokes, sent] = await Promise.all([
      loadApprovedJokes(admin),
      // ประกวดมุก: how many came in during the window (a count only, no names)
      admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "tv_joke").gte("changed_at", CONTEST.start).lte("changed_at", CONTEST.end),
    ]);
    const contest = contestState(now, sent.count ?? 0);
    return NextResponse.json({ jokes, contest }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ jokes: [] }, { status: 503 });
  }
}
