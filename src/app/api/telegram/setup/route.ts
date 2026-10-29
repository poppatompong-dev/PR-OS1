// One-time setup after TELEGRAM_BOT_TOKEN is set in Vercel: an admin opens
// /api/telegram/setup while signed in. Points the bot at our webhook (with the
// derived secret) and registers the command menu. Safe to run again.

import { NextResponse } from "next/server";
import { env, isSupabaseConfigured, isTelegramConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { getBotUsername, setCommands, setWebhook } from "@/lib/telegram/api";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  const user = await getSessionUser(await createClient()).catch(() => null);
  if (!user || !can.manageSettings(user.role)) {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ (เข้าสู่ระบบเว็บก่อน)" }, { status: 403 });
  }
  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN ใน Vercel (ตั้งแล้วต้อง Redeploy)" }, { status: 400 });
  }
  const url = new URL("/api/telegram/webhook", env.appBaseUrl).toString();
  const hook = await setWebhook(url);
  await setCommands([
    { command: "my", description: "งานของฉัน" },
    { command: "today", description: "งานของทีมวันนี้" },
    { command: "help", description: "วิธีใช้" },
    { command: "stop", description: "เลิกรับแจ้งทาง Telegram (กลับไปใช้ LINE)" },
  ]);
  const username = await getBotUsername();
  return NextResponse.json({ ok: hook.ok, webhook: url, bot: username ? `@${username}` : null, error: hook.error ?? null });
}
