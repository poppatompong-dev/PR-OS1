// ส่งข้อความแนะนำถึงหัวหน้าฝ่าย ครั้งเดียว (owner approved the draft, 17 Nov 2026).
// Admin web session only; the claim "headintro:v1:<id>" keeps it to one send per head.

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured, isTelegramConfigured } from "@/lib/env";
import { claimRun, getPeopleByIds } from "@/lib/line/data";
import { sendTelegram } from "@/lib/telegram/api";
import { titleFor } from "@/lib/telegram/chat";
import { HEAD_IDS, HEAD_LIVE, buildHeadIntro } from "@/lib/notifications/head-brief";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isSupabaseConfigured() || !isTelegramConfigured() || !HEAD_LIVE) return NextResponse.json({ error: "ระบบยังไม่พร้อม" }, { status: 503 });
  const user = await getSessionUser(await createClient());
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can.manageSettings(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const out: Array<{ name: string; ok: boolean; note?: string }> = [];
  for (const h of await getPeopleByIds(admin, HEAD_IDS)) {
    if (!h.telegramChatId) { out.push({ name: h.displayName, ok: false, note: "ยังไม่ผูก Telegram" }); continue; }
    if (!(await claimRun(admin, `headintro:v1:${h.id}`))) { out.push({ name: h.displayName, ok: false, note: "ส่งไปแล้ว" }); continue; }
    const r = await sendTelegram(h.telegramChatId, buildHeadIntro(titleFor(h.id, h.displayName)));
    out.push({ name: h.displayName, ok: r.ok, note: r.error });
  }
  return NextResponse.json({ ok: true, out });
}
