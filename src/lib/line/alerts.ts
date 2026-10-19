// Push "แจ้งไม่สะดวก" to the admins. Shared by the LINE webhook and the web
// "ไม่สะดวก" button so both paths alert the same people the same way.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isLineMessagingConfigured } from "@/lib/env";
import { getQuotaStatus, pushMessages } from "@/lib/line/api";
import { getAdminRecipientIds, getPeopleByIds, logPush, type TaskItem } from "@/lib/line/data";
import { unavailableAlertMessage } from "@/lib/line/messages";

export function currentQuotaMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(now);
}

export async function alertAdminsUnavailable(admin: SupabaseClient, task: TaskItem): Promise<number> {
  if (!isLineMessagingConfigured()) return 0;
  const admins = await getPeopleByIds(admin, await getAdminRecipientIds(admin));
  // Respect the quota like the scheduled sender does; LINE's own count decides.
  const quota = await getQuotaStatus();
  let remaining = quota && quota.limit !== null ? quota.limit - quota.used : Number.POSITIVE_INFINITY;
  let sent = 0;
  for (const a of admins) {
    if (!a.lineUserId || remaining <= 0) continue;
    remaining -= 1;
    const res = await pushMessages(a.lineUserId, [unavailableAlertMessage(task)]);
    if (res.ok) sent += 1;
    await logPush(admin, {
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
