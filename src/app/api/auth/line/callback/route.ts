import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { env, isLineLoginConfigured } from "@/lib/env";
import { exchangeLineLoginCode } from "@/lib/notifications/line-login";
import { safeNextPath } from "@/lib/auth/next-path";

function redirectTo(path: string) {
  const response = NextResponse.redirect(new URL(path, env.appBaseUrl));
  for (const name of ["line_oauth_state", "line_oauth_mode", "line_oauth_next"]) response.cookies.delete(name);
  return response;
}

const linkError = (message: string) => redirectTo(`/mobile/my-tasks?error=${encodeURIComponent(message)}`);
const loginError = (message: string) => redirectTo(`/login?error=${encodeURIComponent(message)}`);

export async function GET(request: NextRequest) {
  const mode = request.cookies.get("line_oauth_mode")?.value === "login" ? "login" : "link";
  const fail = mode === "login" ? loginError : linkError;

  if (!isLineLoginConfigured()) return fail("ระบบยังไม่ได้ตั้งค่า LINE Login");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("line_oauth_state")?.value;
  if (request.nextUrl.searchParams.get("error")) return fail("ยกเลิกการเชื่อมต่อ LINE แล้ว");
  if (!code || !state || !savedState || state !== savedState) {
    return fail("ลิงก์เชื่อมต่อ LINE ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่");
  }

  let lineUserId: string;
  try {
    const redirectUri = new URL("/api/auth/line/callback", env.appBaseUrl).toString();
    lineUserId = (await exchangeLineLoginCode(code, redirectUri)).lineUserId;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่");
  }

  const admin = createAdminClient();
  const supabase = await createClient();

  if (mode === "login") {
    // Sign in as the person this LINE account was linked to — and nobody else.
    const { data: person } = await admin
      .from("people")
      .select("id, is_active")
      .eq("line_user_id", lineUserId)
      .maybeSingle();
    if (!person || person.is_active === false) {
      return loginError(
        "LINE นี้ยังไม่ได้ผูกกับบัญชี PR-OS — เข้าด้วยชื่อผู้ใช้ก่อน แล้วกด “เชื่อมต่อ LINE” ในหน้างานของฉัน",
      );
    }
    const { data: profile } = await admin.from("profiles").select("id").eq("person_id", person.id).maybeSingle();
    if (!profile) return loginError("ยังไม่มีบัญชีผู้ใช้ของบุคลากรคนนี้ ให้ผู้ดูแลระบบสร้างบัญชีก่อน");

    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (!email) return loginError("บัญชีนี้ไม่มีอีเมลในระบบ จึงเข้าด้วย LINE ไม่ได้");

    // A one-time sign-in link, redeemed right here on the server; nothing is e-mailed.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) return loginError("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่");
    const { error: otpErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (otpErr) return loginError("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่");

    await admin.from("audit_logs").insert({
      entity_type: "person",
      entity_id: person.id,
      action: "line_login",
      changed_by: profile.id,
      summary: "เข้าสู่ระบบด้วย LINE",
    });

    return redirectTo(safeNextPath(request.cookies.get("line_oauth_next")?.value));
  }

  // mode === "link": attach this LINE account to the signed-in person.
  const user = await getSessionUser(supabase);
  if (!user || !user.personId) return linkError("กรุณาเข้าสู่ระบบก่อนเชื่อมต่อ LINE");

  // people.line_user_id is admin-only under RLS (0002 people_admin_write);
  // self-linking is a system-side write on the user's own person_id.
  const { error } = await admin.from("people").update({ line_user_id: lineUserId }).eq("id", user.personId);
  if (error) {
    if (error.code === "23505") return linkError("LINE นี้ผูกกับบุคลากรคนอื่นอยู่แล้ว ให้ผู้ดูแลระบบตรวจสอบ");
    return linkError(error.message);
  }

  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: user.personId,
    action: "line_link",
    changed_by: user.id,
    summary: "ผูกบัญชี LINE สำหรับรับแจ้งเตือน",
  });

  return redirectTo("/mobile/my-tasks?line=linked");
}
