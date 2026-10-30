// One-time setup after TELEGRAM_BOT_TOKEN is set in Vercel: an admin opens
// /api/telegram/setup while signed in. Points the bot at our webhook (with the
// derived secret), registers the command menu and the profile texts. Safe to run again.
// ?photo=a|b|c also uploads that profile picture (each run adds one, so only on purpose).

import { NextResponse } from "next/server";
import { env, isSupabaseConfigured, isTelegramConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { getBotUsername, setCommands, setMenuButton, setProfilePhoto, setProfileTexts, setWebhook } from "@/lib/telegram/api";
import { BOT_COMMANDS, BOT_DESCRIPTION, BOT_PHOTOS, BOT_SHORT_DESCRIPTION, type BotPhoto } from "@/lib/telegram/profile";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
  await setCommands(BOT_COMMANDS);
  const profile = await setProfileTexts(BOT_DESCRIPTION, BOT_SHORT_DESCRIPTION);
  const pick = new URL(req.url).searchParams.get("photo") as BotPhoto | null;
  let photo: { ok: boolean; error?: string } | null = null;
  if (pick && pick in BOT_PHOTOS) {
    const file = await fetch(new URL(BOT_PHOTOS[pick], env.appBaseUrl), { cache: "no-store" }).catch(() => null);
    photo = file?.ok ? await setProfilePhoto(await file.arrayBuffer()) : { ok: false, error: "อ่านไฟล์รูปไม่ได้" };
  }
  // "งาน" opens รายการงาน (add / edit / cancel there) — owner, 30 Oct 2026.
  await setMenuButton("งาน", new URL("/liff/add-event/jobs?tg=1", env.appBaseUrl).toString());
  const username = await getBotUsername();
  return NextResponse.json({
    ok: hook.ok,
    webhook: url,
    bot: username ? `@${username}` : null,
    profile: profile.ok ? "ok" : profile.error,
    photo: photo ? (photo.ok ? `ok (${pick})` : photo.error) : "ไม่เปลี่ยน (ใส่ ?photo=a|b|c)",
    error: hook.error ?? null,
  });
}
