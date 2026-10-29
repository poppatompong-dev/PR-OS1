// Telegram bot webhook. Public (Telegram calls it), so the secret header that
// setWebhook registered is the only gate (lib/telegram/api.ts webhookSecret).

import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, isTelegramConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { isValidWebhookSecret } from "@/lib/telegram/api";
import { handleTelegramUpdate, type TgUpdate } from "@/lib/telegram/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTelegramConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "telegram not configured" }, { status: 503 });
  }
  if (!isValidWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "bad secret" }, { status: 401 });
  }
  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  try {
    await handleTelegramUpdate({ admin: createAdminClient() }, update);
  } catch (err) {
    console.error("telegram update failed", err instanceof Error ? err.message : err);
  }
  // Always 200: a non-200 makes Telegram resend, and a resent "รับทราบ" is what we avoid.
  return NextResponse.json({ ok: true });
}
