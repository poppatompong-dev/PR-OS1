import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { loadApprovedJokes } from "@/lib/tv-jokes";
import { CONTEST, contestNumbers, contestState } from "@/lib/monitor/contest";

// Public (the TV has no account): approved jokes + the sender's nickname only.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const [approved, sent] = await Promise.all([
      loadApprovedJokes(admin),
      // ประกวดมุก: what came in during the window (ids + times only, no text or names)
      admin.from("audit_logs").select("id, changed_at").eq("action", "tv_joke").gte("changed_at", CONTEST.start).lte("changed_at", CONTEST.end).limit(1000),
    ]);
    const rows = (sent.data ?? []) as Array<{ id: string; changed_at: string }>;
    const { data: no } = rows.length
      ? await admin.from("audit_logs").select("entity_id").eq("action", "tv_joke_no").in("entity_id", rows.map((r) => r.id))
      : { data: [] };
    const nums = contestNumbers(rows.map((r) => ({ id: r.id, at: r.changed_at })), new Set((no ?? []).map((r: { entity_id: string }) => r.entity_id)));
    // มุกที่ N for the TV ad break and the judging list (owner + พี่เอิร์ธ, 12 Nov 2026)
    const jokes = approved.map((j) => (nums.has(j.id) ? { ...j, no: nums.get(j.id) } : j));
    const contest = contestState(now, rows.length);
    return NextResponse.json({ jokes, contest }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ jokes: [] }, { status: 503 });
  }
}
