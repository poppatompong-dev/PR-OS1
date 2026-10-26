import { ClassicMonitor } from "./ClassicMonitor";
import { TableMonitor } from "./TableMonitor";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

// Default: clean, large, readable table (per user feedback).
// Legacy retro-TV view is kept at /monitor?classic=1.
// /monitor?v=3d = แบบ B (same table + the 3D mascot column), opt-in until the
// team has seen it run on the office TV; add &static=1 to keep it still.
export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string; v?: string; static?: string }>;
}) {
  const { classic, v, static: still } = await searchParams;
  if (classic === "1") {
    return <ClassicMonitor />;
  }
  // The TV opens this page without signing in; a signed-in phone/PC may tap a job to open it.
  const user = isSupabaseConfigured() ? await getSessionUser(await createClient()).catch(() => null) : null;
  const linkable = Boolean(user && user.role !== "display");
  if (v === "3d") {
    return <TableMonitor variant="3d" staticMode={still === "1"} linkable={linkable} />;
  }
  return <TableMonitor linkable={linkable} />;
}
