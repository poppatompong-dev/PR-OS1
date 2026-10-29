// Who is calling a /api/liff/* route. The LIFF page sends the LINE ID token it
// got from liff.getIDToken(); LINE verifies it for us, and the token's subject
// is the same LINE user id the bot stores in people.line_user_id (both
// channels sit under one provider). No web login and no password: being a
// linked, active team member is what lets you add work from LINE.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export type LiffCaller = {
  personId: string;
  displayName: string;
  /** auth.users id when this person also has a web account, else null. */
  userId: string | null;
};

export type LiffAuthResult = { ok: true; caller: LiffCaller } | { ok: false; status: number; error: string };

export async function verifyLineIdToken(idToken: string): Promise<string | null> {
  if (!idToken || !env.lineLoginChannelId) return null;
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: env.lineLoginChannelId }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { sub?: string };
  return typeof data.sub === "string" && data.sub.length > 0 ? data.sub : null;
}

/**
 * The same form opened inside Telegram (Mini App, owner 29 Oct 2026) sends
 * "tma <initData>". Telegram signs initData with the bot token; we check the
 * signature and the age, then use the Telegram user id (= the private chat id
 * the person linked). https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData: string, botToken: string, now = Date.now(), maxAgeSec = 24 * 3600): number | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || now / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "null") as { id?: number } | null;
    return typeof user?.id === "number" ? user.id : null;
  } catch {
    return null;
  }
}

async function authenticateTelegram(initData: string, admin: SupabaseClient): Promise<LiffAuthResult> {
  const tgUserId = verifyTelegramInitData(initData, env.telegramBotToken);
  if (!tgUserId) return { ok: false, status: 401, error: "ยืนยันตัวตน Telegram ไม่สำเร็จ ปิดฟอร์มแล้วกดปุ่มเพิ่มงานใหม่" };
  const { data: person } = await admin.from("people").select("id, display_name, is_active").eq("telegram_chat_id", tgUserId).maybeSingle();
  if (!person || person.is_active === false) {
    return { ok: false, status: 403, error: 'Telegram นี้ยังไม่ได้ผูกกับ PR-OS — ในแชท LINE พิมพ์ "ผูก Telegram" ก่อนครับ' };
  }
  const { data: profile } = await admin.from("profiles").select("id, role").eq("person_id", person.id).maybeSingle();
  if (profile?.role === "display") return { ok: false, status: 403, error: "บัญชีจอทีวีเพิ่มงานไม่ได้" };
  return { ok: true, caller: { personId: person.id, displayName: person.display_name, userId: profile?.id ?? null } };
}

export async function authenticateLiff(request: Request, admin: SupabaseClient): Promise<LiffAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("tma ")) return authenticateTelegram(header.slice(4).trim(), admin);
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const lineUserId = await verifyLineIdToken(token);
  if (!lineUserId) return { ok: false, status: 401, error: "เข้าสู่ระบบ LINE ไม่สำเร็จ ลองปิดหน้านี้แล้วกดเมนูใหม่" };

  const { data: person } = await admin
    .from("people")
    .select("id, display_name, is_active")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!person || person.is_active === false) {
    return {
      ok: false,
      status: 403,
      error: "LINE นี้ยังไม่ได้ลงทะเบียนกับทีมงาน กด \"ลงทะเบียนรับแจ้งงาน\" ในกลุ่มไลน์งาน แล้วรอแอดมินยืนยันก่อนครับ",
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("person_id", person.id)
    .maybeSingle();
  // A TV-screen account never adds work, even if someone linked a LINE to it.
  if (profile?.role === "display") return { ok: false, status: 403, error: "บัญชีจอทีวีเพิ่มงานไม่ได้" };

  return { ok: true, caller: { personId: person.id, displayName: person.display_name, userId: profile?.id ?? null } };
}
