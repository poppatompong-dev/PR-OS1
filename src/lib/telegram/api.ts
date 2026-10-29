// Telegram Bot API — the few calls PR-OS needs. Server-only: the bot token
// comes from env and never reaches a browser or a log line.
//
// Cost model: Telegram bots are free; no monthly quota. Limits are about speed
// (about 30 messages a second overall), far above a 10-person team.

import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { SendResult } from "@/lib/line/api";

export type TgButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

/** One message: Telegram HTML text plus optional inline buttons (rows of buttons). */
export type TgMessage = {
  text: string;
  buttons?: TgButton[][];
  /** The command buttons under the typing box (like LINE's rich menu). Ignored when `buttons` is set. */
  keyboard?: string[][];
  photo?: string;
};

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;
}

/** Never let the token leak into an error message we store or show. */
function scrub(text: string): string {
  return env.telegramBotToken ? text.split(env.telegramBotToken).join("***") : text;
}

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: T; error?: string; status?: number }> {
  try {
    const res = await fetch(apiUrl(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!res.ok || !json.ok) {
      return { ok: false, status: res.status, error: scrub(`Telegram ${res.status}: ${json.description ?? "error"}`).slice(0, 300) };
    }
    return { ok: true, result: json.result };
  } catch (err) {
    return { ok: false, error: scrub(err instanceof Error ? err.message : "Telegram request error") };
  }
}

function markup(m: TgMessage) {
  if (m.buttons && m.buttons.length) return { reply_markup: { inline_keyboard: m.buttons } };
  if (m.keyboard && m.keyboard.length) {
    return { reply_markup: { keyboard: m.keyboard.map((r) => r.map((text) => ({ text }))), resize_keyboard: true, is_persistent: true } };
  }
  return {};
}

/** Free. Telegram allows 4096 characters of text (1024 for a photo caption). */
export async function sendTelegram(chatId: number | string, m: TgMessage): Promise<SendResult> {
  const res = m.photo
    ? await call<{ message_id: number }>("sendPhoto", { chat_id: chatId, photo: m.photo, caption: m.text.slice(0, 1024), parse_mode: "HTML", ...markup(m) })
    : await call<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text: m.text.slice(0, 4096),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...markup(m),
      });
  return res.ok ? { ok: true, providerMessageId: res.result ? `tg:${res.result.message_id}` : undefined } : { ok: false, error: res.error, status: res.status };
}

/** Replace a card the bot sent earlier (Telegram can edit; LINE cannot). */
export async function editTelegram(chatId: number | string, messageId: number, m: TgMessage): Promise<SendResult> {
  const res = await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: m.text.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(m.buttons && m.buttons.length ? { reply_markup: { inline_keyboard: m.buttons } } : { reply_markup: { inline_keyboard: [] } }),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error, status: res.status };
}

/** The small toast after a button tap; must be answered or the button spins. */
export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text: text.slice(0, 190) } : {}) });
}

let cachedUsername: string | null = null;
/** The bot's @username, for t.me links. Read once per server instance. */
export async function getBotUsername(): Promise<string | null> {
  if (cachedUsername) return cachedUsername;
  const res = await call<{ username?: string }>("getMe", {});
  cachedUsername = res.ok ? (res.result?.username ?? null) : null;
  return cachedUsername;
}

/**
 * The secret Telegram sends back in every webhook call
 * (X-Telegram-Bot-Api-Secret-Token). Derived from the bot token so there is
 * only one variable to set, and it changes whenever the token is revoked.
 */
export function webhookSecret(): string {
  return createHash("sha256").update(`pr-os-telegram:${env.telegramBotToken}`).digest("hex").slice(0, 48);
}

export function isValidWebhookSecret(header: string | null): boolean {
  if (!env.telegramBotToken || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(webhookSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setWebhook(url: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  return { ok: res.ok, error: res.error };
}

/** The button left of the typing box: opens the add-job form. */
export async function setMenuButton(text: string, url: string): Promise<void> {
  await call("setChatMenuButton", { menu_button: { type: "web_app", text, web_app: { url } } });
}

export async function setCommands(commands: Array<{ command: string; description: string }>): Promise<void> {
  await call("setMyCommands", { commands });
}

export async function setProfileTexts(description: string, shortDescription: string): Promise<{ ok: boolean; error?: string }> {
  const d = await call("setMyDescription", { description: description.slice(0, 512) });
  const sd = await call("setMyShortDescription", { short_description: shortDescription.slice(0, 120) });
  return { ok: d.ok && sd.ok, error: d.error ?? sd.error };
}

/** Bot API 9.4+: the bot sets its own picture (a new upload each time, so run only on purpose). */
export async function setProfilePhoto(jpeg: ArrayBuffer): Promise<{ ok: boolean; error?: string }> {
  try {
    const form = new FormData();
    form.set("photo", JSON.stringify({ type: "static", photo: "attach://pic" }));
    form.set("pic", new Blob([jpeg], { type: "image/jpeg" }), "bot.jpg");
    const res = await fetch(apiUrl("setMyProfilePhoto"), { method: "POST", body: form, cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return json.ok ? { ok: true } : { ok: false, error: scrub(`Telegram ${res.status}: ${json.description ?? "error"}`).slice(0, 300) };
  } catch (err) {
    return { ok: false, error: scrub(err instanceof Error ? err.message : "Telegram request error") };
  }
}

/** Text that goes inside Telegram HTML. */
export function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A photo someone sent the bot: the largest size Telegram kept. Null if it cannot be fetched. */
export async function downloadTelegramFile(fileId: string, maxBytes = 10 * 1024 * 1024): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const meta = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  const filePath = meta.ok ? meta.result?.file_path : undefined;
  if (!filePath || (meta.result?.file_size ?? 0) > maxBytes) return null;
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${filePath}`, { cache: "no-store" });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > maxBytes) return null;
    const contentType = filePath.endsWith(".png") ? "image/png" : filePath.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return { bytes, contentType };
  } catch {
    return null;
  }
}
