import { NextResponse } from "next/server";
import { worldFeed } from "@/lib/monitor/world-feed";

// Public (the TV has no account): only public prices and headlines, no team data.
// Each source is cached 30 min inside worldFeed; this answer for 15 min.
export const revalidate = 900;

export async function GET() {
  const items = await worldFeed();
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } });
}
