// Can the system reach this person at all? (owner, 4 Nov 2026: พี่เอิร์ธ assigned
// พี่ไป๋ three times and she never got a card — the form now says so up front.)
// Mirrors the skip rule in queue.ts: Telegram chat, else a LINE id with LINE set up.
import { isLineMessagingConfigured, isTelegramConfigured } from "@/lib/env";

export const UNREACHABLE_NOTE = "ยังไม่ผูก Telegram/LINE — ไม่ได้รับแจ้ง ต้องบอกเอง";

export function isReachable(p: { telegram_chat_id?: unknown; line_user_id?: unknown } | null | undefined): boolean {
  if (!p) return false;
  const tg = p.telegram_chat_id;
  if (isTelegramConfigured() && tg !== null && tg !== undefined && tg !== "" && Number.isFinite(Number(tg))) return true;
  return Boolean(p.line_user_id) && isLineMessagingConfigured();
}
