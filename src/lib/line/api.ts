// LINE Messaging API — the few calls PR-OS needs. Server-only: every call uses
// the long-lived channel access token from env, which must never reach a
// browser.
//
// Cost model (Thailand free plan, owner decision 19 Oct 2026):
//   push  — counts against the 300/month quota, once per recipient
//   reply — free; used for everything the bot says in answer to a user

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";

// Minimal message shapes. Flex contents are plain JSON built in messages.ts.
export type LineMessage =
  | { type: "text"; text: string; quickReply?: QuickReply }
  | { type: "flex"; altText: string; contents: Record<string, unknown>; quickReply?: QuickReply };

export type QuickReply = { items: Array<{ type: "action"; action: LineAction }> };

export type LineAction =
  | { type: "postback"; label: string; data: string; displayText?: string }
  | { type: "message"; label: string; text: string }
  | { type: "uri"; label: string; uri: string };

export type SendResult = { ok: boolean; providerMessageId?: string; error?: string; status?: number };

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.lineMessagingChannelAccessToken}`,
  };
}

async function post(url: string, body: unknown): Promise<SendResult> {
  try {
    const res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: `LINE ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, providerMessageId: res.headers.get("x-line-request-id") ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "LINE request error" };
  }
}

/** Counts against the monthly quota. Max 5 messages per call. */
export function pushMessages(to: string, messages: LineMessage[]): Promise<SendResult> {
  return post(`${API}/message/push`, { to, messages: messages.slice(0, 5) });
}

/** Free. The reply token is single-use and expires about a minute after the event. */
export function replyMessages(replyToken: string, messages: LineMessage[]): Promise<SendResult> {
  return post(`${API}/message/reply`, { replyToken, messages: messages.slice(0, 5) });
}

/**
 * LINE's own count for this month, which is the one that actually stops
 * delivery. Our notifications table is a fallback when this call fails.
 */
export async function getQuotaStatus(): Promise<{ limit: number | null; used: number } | null> {
  try {
    const [q, c] = await Promise.all([
      fetch(`${API}/message/quota`, { headers: authHeaders() }),
      fetch(`${API}/message/quota/consumption`, { headers: authHeaders() }),
    ]);
    if (!q.ok || !c.ok) return null;
    const quota = (await q.json()) as { type: "none" | "limited"; value?: number };
    const used = (await c.json()) as { totalUsage: number };
    return { limit: quota.type === "limited" ? (quota.value ?? null) : null, used: used.totalUsage };
  } catch {
    return null;
  }
}

/**
 * x-line-signature is base64(HMAC-SHA256(channelSecret, rawBody)). It must be
 * checked against the raw bytes, before JSON parsing.
 */
export function verifySignature(rawBody: string, signature: string | null, secret = env.lineMessagingChannelSecret): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---- Rich menu (set up once from /settings) --------------------------------

export async function createRichMenu(menu: Record<string, unknown>): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${API}/richmenu`, { method: "POST", headers: authHeaders(), body: JSON.stringify(menu) });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `สร้างเมนูไม่สำเร็จ (${res.status}): ${text.slice(0, 200)}` };
    return { ok: true, id: (JSON.parse(text) as { richMenuId: string }).richMenuId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "สร้างเมนูไม่สำเร็จ" };
  }
}

export async function uploadRichMenuImage(richMenuId: string, png: ArrayBuffer): Promise<SendResult> {
  try {
    const res = await fetch(`${DATA_API}/richmenu/${richMenuId}/content`, {
      method: "POST",
      headers: { "Content-Type": "image/png", Authorization: `Bearer ${env.lineMessagingChannelAccessToken}` },
      body: png,
    });
    if (!res.ok) return { ok: false, error: `อัปโหลดรูปเมนูไม่สำเร็จ (${res.status}): ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "อัปโหลดรูปเมนูไม่สำเร็จ" };
  }
}

export async function setDefaultRichMenu(richMenuId: string): Promise<SendResult> {
  return post(`${API}/user/all/richmenu/${richMenuId}`, {});
}

export async function listRichMenuIds(): Promise<string[]> {
  try {
    const res = await fetch(`${API}/richmenu/list`, { headers: authHeaders() });
    if (!res.ok) return [];
    const json = (await res.json()) as { richmenus: Array<{ richMenuId: string }> };
    return json.richmenus.map((m) => m.richMenuId);
  } catch {
    return [];
  }
}

export async function deleteRichMenu(richMenuId: string): Promise<void> {
  try {
    await fetch(`${API}/richmenu/${richMenuId}`, { method: "DELETE", headers: authHeaders() });
  } catch {
    // best effort: an old menu left behind is harmless
  }
}

// ---- Profiles (registration from the team group) ---------------------------

export type LineProfile = { displayName: string; pictureUrl: string | null };

/**
 * Display name and picture of someone in a group or room the bot is in. Works
 * whether or not that person has added the bot as a friend.
 */
export async function getGroupMemberProfile(
  source: { groupId?: string; roomId?: string },
  userId: string,
): Promise<LineProfile | null> {
  const path = source.groupId
    ? `group/${encodeURIComponent(source.groupId)}/member/${encodeURIComponent(userId)}`
    : source.roomId
      ? `room/${encodeURIComponent(source.roomId)}/member/${encodeURIComponent(userId)}`
      : null;
  if (!path) return null;
  try {
    const res = await fetch(`${API}/${path}`, { headers: authHeaders() });
    if (!res.ok) return null;
    const json = (await res.json()) as { displayName?: string; pictureUrl?: string };
    return { displayName: json.displayName ?? "", pictureUrl: json.pictureUrl ?? null };
  } catch {
    return null;
  }
}

export type FriendStatus = "friend" | "not_friend" | "unknown";

/**
 * Has this person added the bot as a friend? LINE answers the profile call
 * only for friends (404 otherwise), and only friends can get push messages.
 */
export async function getFriendStatus(userId: string): Promise<FriendStatus> {
  try {
    const res = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, { headers: authHeaders() });
    if (res.ok) return "friend";
    if (res.status === 404) return "not_friend";
    return "unknown";
  } catch {
    return "unknown";
  }
}

let cachedBasicId: string | null | undefined;

/** The bot's LINE ID such as "@749bsqwt" (env first, then /v2/bot/info once). */
export async function getBotBasicId(): Promise<string | null> {
  if (env.lineBotBasicId) return env.lineBotBasicId.startsWith("@") ? env.lineBotBasicId : `@${env.lineBotBasicId}`;
  if (cachedBasicId !== undefined) return cachedBasicId;
  try {
    const res = await fetch(`${API}/info`, { headers: authHeaders() });
    if (!res.ok) return null; // not cached: try again on the next event
    const json = (await res.json()) as { basicId?: string };
    cachedBasicId = json.basicId ? (json.basicId.startsWith("@") ? json.basicId : `@${json.basicId}`) : null;
    return cachedBasicId;
  } catch {
    return null;
  }
}

/** Opens the bot's "add friend" screen in LINE. */
export function addFriendUrl(basicId: string): string {
  return `https://line.me/R/ti/p/${encodeURIComponent(basicId.startsWith("@") ? basicId : `@${basicId}`)}`;
}
