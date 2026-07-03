// Browser-side Supabase client for use inside Client Components.
// Uses the public anon key + RLS; never put privileged logic here.

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
