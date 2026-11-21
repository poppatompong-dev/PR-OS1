// Pages that change a job (new / edit) send everyone but the job editor back (20 Nov 2026).
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { NOT_EDITOR_MSG, canEditJobs } from "@/lib/auth/job-editor";

export async function requireEditorPage(back: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const user = await getSessionUser(await createClient());
  if (!user) redirect("/login");
  if (!(await canEditJobs(createAdminClient(), user.personId))) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(NOT_EDITOR_MSG)}`);
}
