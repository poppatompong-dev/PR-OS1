import { NextResponse } from "next/server";
import { showcase } from "@/lib/monitor/showcase";

// Public (the TV has no account): the municipality's own published posts only.
export const revalidate = 900;

export async function GET() {
  const items = await showcase();
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } });
}
