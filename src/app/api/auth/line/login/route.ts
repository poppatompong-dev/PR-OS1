import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env, isLineLoginConfigured } from "@/lib/env";
import { buildLineLoginUrl } from "@/lib/notifications/line-login";
import { safeNextPath } from "@/lib/auth/next-path";

// "เข้าสู่ระบบด้วย LINE" on /login. Works only for someone who has already
// linked their LINE account from "งานของฉัน" — the callback refuses anyone
// else, so this cannot create accounts or reach anyone else's.
export async function GET(request: NextRequest) {
  if (!isLineLoginConfigured()) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("ระบบยังไม่ได้ตั้งค่า LINE Login")}`, env.appBaseUrl),
    );
  }
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/line/callback", env.appBaseUrl).toString();
  const response = NextResponse.redirect(buildLineLoginUrl(state, redirectUri));
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set("line_oauth_state", state, cookie);
  response.cookies.set("line_oauth_mode", "login", cookie);
  response.cookies.set("line_oauth_next", next, cookie);
  return response;
}
