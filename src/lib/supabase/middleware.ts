// Session refresh + route protection for the Next.js middleware.
// Keeps the auth cookie fresh and redirects unauthenticated users to /login.

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

// Routes reachable without a logged-in user.
// /monitor uses a display token, not a user account (see docs/08).
// /api/notifications/process is called by an external cron (no session
// cookie at all); it protects itself with a shared secret header instead.
const PUBLIC_PREFIXES = ["/login", "/monitor", "/api/monitor", "/api/notifications/process"];

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
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
