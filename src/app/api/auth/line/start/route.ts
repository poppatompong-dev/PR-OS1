import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { env, isLineLoginConfigured } from "@/lib/env";
import { buildLineLoginUrl } from "@/lib/notifications/line-login";

function redirectWithError(message: string) {
  return NextResponse.redirect(
    new URL(`/mobile/my-tasks?error=${encodeURIComponent(message)}`, env.appBaseUrl),
  );
}

// Starts the LINE Login flow so the logged-in assignee can link their own
// LINE account. Requires a session (middleware already gates this route),
// and requires the session's profile to already be linked to a people row.
export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.redirect(new URL("/login", env.appBaseUrl));
  if (!user.personId) {
    return redirectWithError("บัญชีนี้ยังไม่ผูกกับรายชื่อบุคลากร ให้ผู้ดูแลระบบผูกในหน้าตั้งค่าก่อน");
  }
  if (!isLineLoginConfigured()) {
    return redirectWithError("ระบบยังไม่ได้ตั้งค่า LINE Login");
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/line/callback", env.appBaseUrl).toString();
  const response = NextResponse.redirect(buildLineLoginUrl(state, redirectUri));
  response.cookies.set("line_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
