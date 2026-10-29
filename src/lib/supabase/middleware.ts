// Session refresh + route protection for the Next.js middleware.
// Keeps the auth cookie fresh and redirects unauthenticated users to /login.

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

// Routes reachable without a logged-in user.
// /monitor uses a display token, not a user account (see docs/08).
// /api/notifications/process is called by an external cron (no session
// cookie at all); it protects itself with a shared secret header instead.
// /api/health is what the keep-alive job and any uptime monitor call. It
// returns only up/down and a row count, and it must reach the database
// without a login or it cannot do its one job: keep the free-tier project
// from being paused for inactivity.
const PUBLIC_PREFIXES = [
  "/login",
  "/monitor",
  // Short TV address; redirects to /monitor.
  "/tv",
  "/api/monitor",
  "/api/notifications/process",
  // LINE "add job" form (LIFF): no web session; the API checks the LINE ID token.
  "/liff",
  "/api/liff",
  // Upload slot for files that go with a new order: the LINE form calls it with
  // a LINE ID token (no web session); the route checks the token or the session.
  "/api/attachments/stage",
  "/api/health",
  // LINE calls the webhook with no session; it checks x-line-signature itself.
  "/api/line/webhook",
  // Telegram calls its webhook with no session; it checks the secret header itself.
  "/api/telegram/webhook",
  // LINE Login: /login (sign in with LINE) and /callback must work before
  // there is a session. /start checks for a session itself.
  "/api/auth/line",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the session so Supabase rotates tokens when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate backend routes behind authentication.
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Come back here after signing in (e.g. a LINE "ดูรายละเอียด" button
    // opened in LINE's own browser, which has no session yet).
    loginUrl.search = "";
    if (request.nextUrl.pathname !== "/") {
      loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
