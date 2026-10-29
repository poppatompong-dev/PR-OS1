// Linking a Telegram chat to a person (owner, 29 Oct 2026): the person types
// "ผูก Telegram" in their LINE chat with the bot, gets a one-time t.me link,
// taps Start, done. No admin step: the LINE account already proves who they are.

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const LINK_TOKEN_MINUTES = 30;
/** Links the bot pushes on its own (after the admin confirms a name) wait longer for the tap. */
export const INVITE_TOKEN_MINUTES = 7 * 24 * 60;

/** Telegram /start payloads allow A–Z a–z 0–9 _ - up to 64 characters. */
export function newLinkToken(): string {
  return randomBytes(18).toString("base64url");
}

export function isWellFormedToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(t);
}

export async function createLinkToken(admin: SupabaseClient, personId: string, now = new Date(), minutes = LINK_TOKEN_MINUTES): Promise<string> {
  const token = newLinkToken();
  const { error } = await admin.from("telegram_link_tokens").insert({
    token,
    person_id: personId,
    expires_at: new Date(now.getTime() + minutes * 60 * 1000).toISOString(),
  });
  if (error) throw new Error(`createLinkToken: ${error.message}`);
  return token;
}

export type LinkOutcome =
  | { ok: true; personId: string; displayName: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "inactive" | "taken" };

/** Use a token once: the chat becomes this person's notification channel. */
export async function consumeLinkToken(admin: SupabaseClient, token: string, chatId: number, now = new Date()): Promise<LinkOutcome> {
  if (!isWellFormedToken(token)) return { ok: false, reason: "invalid" };
  const { data: row } = await admin
    .from("telegram_link_tokens")
    .select("token, person_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return { ok: false, reason: "invalid" };
  if (row.used_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < now.getTime()) return { ok: false, reason: "expired" };

  const { data: person } = await admin.from("people").select("id, display_name, is_active").eq("id", row.person_id).maybeSingle();
  if (!person || person.is_active === false) return { ok: false, reason: "inactive" };

  // Conditional: two taps on the same link, only one wins.
  const { data: claimed } = await admin
    .from("telegram_link_tokens")
    .update({ used_at: now.toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .select("token");
  if (!claimed || claimed.length === 0) return { ok: false, reason: "used" };

  // This chat may have belonged to someone else before (a shared phone): move it.
  await admin.from("people").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId).neq("id", person.id);
  const { error } = await admin.from("people").update({ telegram_chat_id: chatId }).eq("id", person.id);
  if (error) return { ok: false, reason: "taken" };

  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: person.id,
    action: "telegram_link",
    changed_by: null,
    summary: "ผูก Telegram (ผ่านลิงก์จาก LINE)",
  });
  return { ok: true, personId: person.id, displayName: person.display_name };
}

export async function unlinkTelegram(admin: SupabaseClient, chatId: number): Promise<string | null> {
  const { data } = await admin.from("people").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId).select("id, display_name");
  const p = data?.[0];
  if (!p) return null;
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: p.id,
    action: "telegram_unlink",
    changed_by: null,
    summary: "เลิกใช้ Telegram (พิมพ์ /stop) กลับไปรับแจ้งทาง LINE",
  });
  return p.display_name;
}
