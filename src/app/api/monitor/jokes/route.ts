import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { loadApprovedJokes } from "@/lib/tv-jokes";

// Public (the TV has no account): approved jokes + the sender's nickname only.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jokes = await loadApprovedJokes(createAdminClient());
    return NextResponse.json({ jokes }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ jokes: [] }, { status: 503 });
  }
}
