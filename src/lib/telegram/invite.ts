// LINE → Telegram bridge (owner, 29 Oct 2026: "LINE ให้น้อย พาไป Telegram ให้หมด
// แล้วค่อยสอนใน Telegram"). Once the admin confirms who a LINE account is, the
// bot pushes that person their own Telegram link: tap, Start, done. One push per
// person; the how-to lives in the Telegram tour, not in LINE.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isLineMessagingConfigured, isTelegramConfigured } from "@/lib/env";
import { pushMessages } from "@/lib/line/api";
import { claimRun } from "@/lib/line/data";
import { callName } from "@/lib/names";
import { getBotUsername } from "@/lib/telegram/api";
import { INVITE_TOKEN_MINUTES, createLinkToken } from "@/lib/telegram/link";

export function inviteText(displayName: string, link: string): string {
  return [
    `✅ แอดมินยืนยันชื่อ${callName(displayName)}แล้ว`,
    "✈️ ขั้นสุดท้าย: ย้ายไป Telegram",
    "",
    "1️⃣ ลงแอป Telegram (ถ้ายังไม่มี)",
    `2️⃣ กดลิงก์ 👉 ${link}`,
    '3️⃣ กด "Start" (เริ่ม)',
    "",
    "📲 วิธีใช้งานทั้งหมดสอนใน Telegram",
    "🔒 ลิงก์ของคุณคนเดียว · ใช้ได้ 7 วัน",
  ].join("\n");
}

export type InviteResult = "sent" | "skipped" | "failed";

/** Push one person their Telegram link on LINE. Once a day at most (a double click sends one). */
export async function sendTelegramInvite(
  admin: SupabaseClient,
  person: { id: string; displayName: string; lineUserId: string | null; telegramChatId?: number | string | null },
  now = new Date(),
): Promise<InviteResult> {
  if (!person.lineUserId || person.telegramChatId) return "skipped";
  if (!isTelegramConfigured() || !isLineMessagingConfigured()) return "skipped";
  const day = now.toISOString().slice(0, 10);
  if (!(await claimRun(admin, `tginv:${person.id}:${day}`))) return "skipped";
  const username = await getBotUsername();
  if (!username) return "failed";
  const token = await createLinkToken(admin, person.id, now, INVITE_TOKEN_MINUTES);
  const res = await pushMessages(person.lineUserId, [{ type: "text", text: inviteText(person.displayName, `https://t.me/${username}?start=${token}`) }]);
  return res.ok ? "sent" : "failed";
}
