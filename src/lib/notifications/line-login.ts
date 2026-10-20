// LINE Login OAuth: lets a staff member self-link their own LINE account so
// real push notifications (see line.ts) have a line_user_id to send to.
// This is a separate LINE channel from the Messaging API channel used to
// actually push messages.

import { env } from "@/lib/env";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const PROFILE_URL = "https://api.line.me/v2/profile";

export function buildLineLoginUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.lineLoginChannelId,
    redirect_uri: redirectUri,
    state,
    scope: "profile openid",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type LineProfile = { lineUserId: string; displayName: string };

export async function exchangeLineLoginCode(
  code: string,
  redirectUri: string,
): Promise<LineProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.lineLoginChannelId,
      client_secret: env.lineLoginChannelSecret,
    }),
  });
  if (!tokenRes.ok) {
    // LINE answers {"error": "...", "error_description": "..."}; the code tells
    // a wrong channel secret (invalid_client) from a stale or reused code (invalid_grant).
    const detail = await tokenRes
      .json()
      .then((j: { error?: string; error_description?: string }) => [j.error, j.error_description].filter(Boolean).join(": "))
      .catch(() => "");
    console.error("LINE Login token exchange failed", tokenRes.status, detail);
    const hint = detail.startsWith("invalid_client") ? " — ตรวจ LINE_LOGIN_CHANNEL_SECRET ว่าเป็นของช่อง LINE Login" : "";
    throw new Error(`แลก LINE token ไม่สำเร็จ (${tokenRes.status}${detail ? ` ${detail}` : ""})${hint}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`อ่านโปรไฟล์ LINE ไม่สำเร็จ (${profileRes.status})`);
  }
  const profileJson = (await profileRes.json()) as { userId: string; displayName: string };

  return { lineUserId: profileJson.userId, displayName: profileJson.displayName };
}
