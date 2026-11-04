import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Which build is live (v) + the last "รีเฟรชทีวีตอนนี้" press (k). The TV
// reloads when either changes (owner, 3–4 Nov 2026: the office TV kept the old
// screen until someone turned it off and on).
export const dynamic = "force-dynamic";

export async function GET() {
  let k: string | null = null; // null = could not read (never a reason to reload)
  try {
    const { data } = await createAdminClient().from("settings").select("value").eq("key", "tv_reload_at").maybeSingle();
    k = typeof data?.value === "string" ? data.value : "";
  } catch {
    /* no service key (local) — build check still works */
  }
  return NextResponse.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "", k },
    { headers: { "Cache-Control": "no-store" } },
  );
}
