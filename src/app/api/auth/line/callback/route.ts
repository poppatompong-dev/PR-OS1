import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { env, isLineLoginConfigured } from "@/lib/env";
import { exchangeLineLoginCode } from "@/lib/notifications/line-login";

function redirectWithError(message: string) {
  return NextResponse.redirect(
    new URL(`/mobile/my-tasks?error=${encodeURIComponent(message)}`, env.appBaseUrl),
  );
}

export async function GET(request: NextRequest) {
  if (!isLineLoginConfigured()) {
    return redirectWithError("ระบบยังไม่ได้ตั้งค่า LINE Login");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("line_oauth_state")?.value;
  if (!code || !state || !savedState || state !== savedState) {
    return redirectWithError("ลิงก์เชื่อมต่อ LINE ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user || !user.personId) {
    return redirectWithError("กรุณาเข้าสู่ระบบก่อนเชื่อมต่อ LINE");
  }

  try {
    const redirectUri = new URL("/api/auth/line/callback", env.appBaseUrl).toString();
    const profile = await exchangeLineLoginCode(code, redirectUri);

    // people.line_user_id can only be written by admin under RLS (see
    // migration 0002 people_admin_write); self-linking is a system-side
    // write done here on the authenticated user's own person_id.
    const admin = createAdminClient();
    const { error } = await admin
      .from("people")
      .update({ line_user_id: profile.lineUserId })
      .eq("id", user.personId);
    if (error) throw new Error(error.message);

    await admin.from("audit_logs").insert({
      entity_type: "person",
      entity_id: user.personId,
      action: "line_link",
      changed_by: user.id,
      summary: "ผูกบัญชี LINE สำหรับรับแจ้งเตือน",
    });

    const response = NextResponse.redirect(
      new URL("/mobile/my-tasks?line=linked", env.appBaseUrl),
    );
    response.cookies.delete("line_oauth_state");
    return response;
  } catch (err) {
    return redirectWithError(
      err instanceof Error ? err.message : "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่",
    );
  }
}
