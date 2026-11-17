// ตัวอย่างสรุปหัวหน้าฝ่ายส่งเข้า Telegram ของแอดมินที่กดเท่านั้น (owner, 17 Nov 2026:
// "ส่งตัวอย่างให้ป๊อปปี้ดูก่อน"). Real data, the reader's own chat, nobody else.
// Body: { what?: "brief" | "intro" | "nobody" } — default all three.

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured, isTelegramConfigured } from "@/lib/env";
import { getPeopleByIds } from "@/lib/line/data";
import { sendTelegram } from "@/lib/telegram/api";
import { HEAD_IDS, buildHeadIntro, buildNobodyAlert, composeBrief, hoursLeft, nobodyYet } from "@/lib/notifications/head-brief";
import { titleFor } from "@/lib/telegram/chat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isTelegramConfigured()) return NextResponse.json({ error: "ระบบยังไม่พร้อม" }, { status: 503 });
  const user = await getSessionUser(await createClient());
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can.manageSettings(user.role) || !user.personId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const [me] = await getPeopleByIds(admin, [user.personId]);
  if (!me?.telegramChatId) return NextResponse.json({ error: "บัญชีนี้ยังไม่ผูก Telegram" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { what?: string };
  const want = (k: string) => !body.what || body.what === k;
  const [head] = await getPeopleByIds(admin, HEAD_IDS);
  const tag = "🧪 <i>ตัวอย่าง · ส่งถึงคุณคนเดียว</i>\n\n";
  const sent: string[] = [];

  // Written as the head will see it (her greeting), so the owner reviews the real thing.
  const reader = head ?? me;
  const { msg, jobs } = await composeBrief(admin, { id: reader.id, displayName: reader.displayName });
  if (want("brief") && (await sendTelegram(me.telegramChatId, { ...msg, text: tag + msg.text })).ok) sent.push("brief");
  if (want("intro")) {
    const intro = buildHeadIntro(titleFor(reader.id, reader.displayName));
    if ((await sendTelegram(me.telegramChatId, { ...intro, text: tag + intro.text })).ok) sent.push("intro");
  }
  if (want("nobody")) {
    const now = new Date();
    const j = jobs.find((x) => hoursLeft(x, now) > 0 && nobodyYet(x)) ?? jobs.find((x) => hoursLeft(x, now) > 0) ?? jobs[0];
    if (j) {
      const a = buildNobodyAlert(j, now);
      if ((await sendTelegram(me.telegramChatId, { ...a, text: tag + a.text })).ok) sent.push("nobody");
    }
  }
  return NextResponse.json({ ok: true, sent, jobs: jobs.length });
}
