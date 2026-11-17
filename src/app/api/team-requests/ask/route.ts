// The bot asks the person what look they want (owner, 17 Nov 2026: "บอทควรต้องถาม
// คนที่สนทนาด้วย"). For a vague request already on the board: admin web session only,
// one question in the person's own voice setting, and their next text (within 8 h)
// becomes the detailed request.

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured, isTelegramConfigured } from "@/lib/env";
import { getPeopleByIds, setPendingAction } from "@/lib/line/data";
import { sendTelegram } from "@/lib/telegram/api";
import { KEYBOARD } from "@/lib/telegram/messages";
import { lookAskMore, momAddr, momOn, titleFor } from "@/lib/telegram/chat";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isTelegramConfigured()) return NextResponse.json({ error: "ระบบยังไม่พร้อม" }, { status: 503 });
  const user = await getSessionUser(await createClient());
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can.manageSettings(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { requestId?: string };
  if (!UUID.test(body.requestId ?? "")) return NextResponse.json({ error: "ไม่มีคำขอ" }, { status: 400 });

  const admin = createAdminClient();
  const { data: req } = await admin.from("audit_logs").select("entity_id, action").eq("id", body.requestId!).maybeSingle();
  if (!req || req.action !== "look_request") return NextResponse.json({ error: "ไม่ใช่คำขอลุค" }, { status: 400 });
  const [p] = await getPeopleByIds(admin, [String(req.entity_id)]);
  if (!p?.telegramChatId) return NextResponse.json({ error: "น้องยังไม่ผูก Telegram" }, { status: 400 });
  const { data: row } = await admin.from("people").select("metadata").eq("id", p.id).maybeSingle();
  const mom = momOn(p.id, (row?.metadata as Record<string, unknown> | null) ?? null);
  await setPendingAction(admin, `tg:${p.telegramChatId}`, "look_request", 8 * 60);
  const r = await sendTelegram(p.telegramChatId, { text: lookAskMore(mom ? momAddr(p.id, p.displayName) : titleFor(p.id, p.displayName), mom, "ภายในวันนี้"), keyboard: KEYBOARD });
  return NextResponse.json({ ok: r.ok, name: p.displayName, error: r.error });
}
