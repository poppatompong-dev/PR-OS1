import { type NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Until real Supabase keys are set, run the mock app with no auth layer.
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on app routes; skip static assets, image files, and the PWA's own
    // files. The manifest, service worker and offline page must load without
    // a session: browsers fetch the manifest with no cookies at all, and a
    // service worker script that answers with a redirect to /login is refused
    // outright — which silently disabled offline mode and "Add to Home
    // Screen" for everyone, and the wall screen (never logged in) entirely.
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
