// Email fallback sender via Resend. Server-only: API key from env, never
// exposed to the client.

import { env } from "@/lib/env";

const RESEND_URL = "https://api.resend.com/emails";

export type SendResult = { ok: boolean; providerMessageId?: string; error?: string };

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.resendApiKey}`,
      },
      body: JSON.stringify({ from: env.resendFromEmail, to: [to], subject, text }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return { ok: false, error: `Resend send failed (${res.status}): ${errorBody.slice(0, 300)}` };
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, providerMessageId: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send error ไม่ทราบสาเหตุ" };
  }
}
