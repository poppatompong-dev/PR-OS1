// Push "แจ้งไม่สะดวก" to the admins. Shared by the LINE webhook, the Telegram
// webhook and the web "ไม่สะดวก" button so every path alerts the same people
// the same way. Admins who linked Telegram get it there (free); the others by
// LINE, within the monthly quota.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isLineMessagingConfigured, isTelegramConfigured } from "@/lib/env";
import { getQuotaStatus, pushMessages } from "@/lib/line/api";
import { getAdminRecipientIds, getPeopleByIds, logPush, type TaskItem } from "@/lib/line/data";
import { unavailableAlertMessage } from "@/lib/line/messages";
import { sendTelegram } from "@/lib/telegram/api";
import { tgUnavailableAlert } from "@/lib/telegram/messages";

export function currentQuotaMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(now);
}

export async function alertAdminsUnavailable(admin: SupabaseClient, task: TaskItem): Promise<number> {
  const tgOn = isTelegramConfigured();
  const lineOn = isLineMessagingConfigured();
  if (!tgOn && !lineOn) return 0;
  const admins = await getPeopleByIds(admin, await getAdminRecipientIds(admin));
  let remaining: number | null = null; // LINE quota, read only if someone needs LINE
  let sent = 0;
  for (const a of admins) {
    const viaTelegram = tgOn && a.telegramChatId;
    if (!viaTelegram) {
      if (!lineOn || !a.lineUserId) continue;
      if (remaining === null) {
        const quota = await getQuotaStatus();
        remaining = quota && quota.limit !== null ? quota.limit - quota.used : Number.POSITIVE_INFINITY;
      }
      if (remaining <= 0) continue;
      remaining -= 1;
    }
    const res = viaTelegram
      ? await sendTelegram(a.telegramChatId!, tgUnavailableAlert(task))
      : await pushMessages(a.lineUserId!, [unavailableAlertMessage(task)]);
    if (res.ok) sent += 1;
    await logPush(admin, {
      channel: viaTelegram ? "telegram" : "line",
      personId: a.id,
      type: "unavailable",
      eventId: task.event.id,
      assignmentId: task.assignmentId,
      ok: res.ok,
      providerMessageId: res.providerMessageId,
      error: res.error,
      quotaMonth: currentQuotaMonth(),
    });
  }
  return sent;
}

/** FYI notes for admins (e.g. "a photo came in for a redraw"): Telegram only, so they never cost LINE quota. */
export async function tellAdminsByTelegram(admin: SupabaseClient, text: string): Promise<number> {
  if (!isTelegramConfigured()) return 0;
  const admins = await getPeopleByIds(admin, await getAdminRecipientIds(admin));
  let sent = 0;
  for (const a of admins) {
    if (!a.telegramChatId) continue;
    const res = await sendTelegram(a.telegramChatId, { text });
    if (res.ok) sent += 1;
  }
  return sent;
}
