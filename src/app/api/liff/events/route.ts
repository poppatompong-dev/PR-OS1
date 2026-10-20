// Create a job from the LINE "add job" form. Auth: the caller's LINE ID token.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { authenticateLiff } from "@/lib/liff/auth";
import { createEventFromLiff, parseLiffEventInput } from "@/lib/liff/create-event";
import { kickNotifications } from "@/lib/notifications/kick";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_WRITE_MESSAGE } from "@/lib/demo-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: DEMO_WRITE_MESSAGE }, { status: 503 });
  const admin = createAdminClient();
  const auth = await authenticateLiff(request, admin);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = parseLiffEventInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await createEventFromLiff(admin, auth.caller, parsed.input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  if (result.notified > 0) kickNotifications();
  revalidatePath("/schedule");
  revalidatePath("/monitor");
  return NextResponse.json({ ok: true, eventId: result.eventId, notified: result.notified, published: parsed.input.publish });
}
