// Who is calling a /api/liff/* route. The LIFF page sends the LINE ID token it
// got from liff.getIDToken(); LINE verifies it for us, and the token's subject
// is the same LINE user id the bot stores in people.line_user_id (both
// channels sit under one provider). No web login and no password: being a
// linked, active team member is what lets you add work from LINE.

import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function authenticateLiff(request: Request, admin: SupabaseClient): Promise<LiffAuthResult> {
  const header = request.headers.get("authorization") ?? "";
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
