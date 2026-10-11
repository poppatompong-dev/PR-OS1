import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";

export const DEMO_WRITE_MESSAGE =
  "โหมดตัวอย่าง: ยังไม่ได้เชื่อมฐานข้อมูล จึงยังบันทึกการเปลี่ยนแปลงไม่ได้";

/**
 * First line of every server action that writes.
 *
 * In demo mode there is no database, so creating a Supabase client throws and
 * the visitor gets Next's bare "Application error" page — which is exactly
 * what happens when the system is shown to someone. Send them back to the
 * page they were on with a plain explanation instead. Live, this is a no-op.
 *
 * Only the referring path is reused, never the full URL, so the redirect
 * cannot be pointed anywhere off-site.
 */
export async function blockWritesInDemoMode(): Promise<void> {
  if (isSupabaseConfigured()) return;
  let back = "/";
  const referer = (await headers()).get("referer");
  if (referer) {
    try {
      back = new URL(referer).pathname || "/";
    } catch {
      back = "/";
    }
  }
  redirect(`${back}?error=${encodeURIComponent(DEMO_WRITE_MESSAGE)}`);
}
