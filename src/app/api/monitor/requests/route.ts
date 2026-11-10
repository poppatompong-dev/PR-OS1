import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { boardRequests, loadTeamRequests } from "@/lib/team-requests";

// Public (the TV has no account): คำขอจากทีม board — nickname, topic, status and a picture only.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = boardRequests(await loadTeamRequests(createAdminClient())).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      topic: r.topic,
      status: r.status,
      image: r.image,
      avatar: r.avatar,
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({ items: [] }, { status: 503 });
  }
}
