// LINE Messaging API webhook. Public (no Supabase session — LINE calls it),
// so the x-line-signature check is the only gate: without the channel secret
// nobody can make the bot acknowledge work on someone's behalf.

import { NextResponse, type NextRequest } from "next/server";
import { isLineWebhookConfigured, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { verifySignature } from "@/lib/line/api";
import { handleLineEvent, type LineEvent } from "@/lib/line/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isLineWebhookConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "line webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The "Verify" button in LINE Developers sends an empty events array.
  for (const ev of events) {
    try {
      await handleLineEvent({ admin }, ev);
    } catch (err) {
      console.error("line webhook event failed", ev.type, err instanceof Error ? err.message : err);
    }
  }

  // Always 200 once the signature is good: a non-200 makes LINE retry, and a
  // retried "รับทราบ" is exactly what we do not want.
  return NextResponse.json({ ok: true });
}
