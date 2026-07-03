// LINE Messaging API push sender. Server-only: uses the long-lived channel
// access token from env, never exposed to the client.

import { env } from "@/lib/env";

const PUSH_URL = "https://api.line.me/v2/bot/message/push";

export type SendResult = { ok: boolean; providerMessageId?: string; error?: string };

export async function pushLineMessage(lineUserId: string, text: string): Promise<SendResult> {
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.lineMessagingChannelAccessToken}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return { ok: false, error: `LINE push failed (${res.status}): ${errorBody.slice(0, 300)}` };
    }

    return { ok: true, providerMessageId: res.headers.get("x-line-request-id") ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "LINE push error ไม่ทราบสาเหตุ" };
  }
}
