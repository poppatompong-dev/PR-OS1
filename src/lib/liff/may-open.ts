// Who may open a job's files or its map from a card (owner, 26 Oct 2026): the
// people on the job, the admins, and whoever gets the admin notices.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiffCaller } from "@/lib/liff/auth";
import { getAdminRecipientIds } from "@/lib/line/data";

export async function mayOpenJob(admin: SupabaseClient, eventId: string, caller: LiffCaller): Promise<boolean> {
  const { data: asg } = await admin
    .from("assignments")
    .select("id")
    .eq("event_id", eventId)
    .eq("person_id", caller.personId)
    .eq("assignment_status", "assigned")
    .limit(1);
  if ((asg ?? []).length > 0) return true;
  if ((await getAdminRecipientIds(admin)).includes(caller.personId)) return true;
  if (!caller.userId) return false;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", caller.userId).maybeSingle();
  return profile?.role === "admin";
}
