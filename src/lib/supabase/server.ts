// Server-side Supabase clients.
// - createClient(): per-request client bound to the user's session cookies (RLS applies).
// - createAdminClient(): service-role client for trusted server jobs only
//   (notification queue, audit writes). Bypasses RLS — never import into a Client Component.

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only.
          // The middleware (updateSession) refreshes the session instead.
        }
      },
    },
  });
}

export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
