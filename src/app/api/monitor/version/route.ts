import { NextResponse } from "next/server";

// Which build is live. The TV compares it with the build it is running and
// reloads itself after a deploy (owner, 3 Nov 2026: the office TV kept the
// old screen until someone turned it off and on).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
