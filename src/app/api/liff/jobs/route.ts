// The job list in the phone app (Telegram Mini App / LINE LIFF). Auth as /api/liff/*.

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_WRITE_MESSAGE } from "@/lib/demo-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { authenticateLiff } from "@/lib/liff/auth";
import { listJobs } from "@/lib/liff/manage-event";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: DEMO_WRITE_MESSAGE }, { status: 503 });
  const admin = createAdminClient();
  const auth = await authenticateLiff(request, admin);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ jobs: await listJobs(admin, auth.caller) });
}
