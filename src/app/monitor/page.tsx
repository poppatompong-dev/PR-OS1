import { ClassicMonitor } from "./ClassicMonitor";
import { TableMonitor } from "./TableMonitor";
import { HeroMonitor } from "./HeroMonitor";
import { RowsMonitor, type RowsTheme } from "./RowsMonitor";
import { BoardMonitor } from "./BoardMonitor";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

// Default since 29 Oct 2026: ผังคุณกุ๊ก (BoardMonitor), ?theme=a|b|c.
// The 28 Oct "แบบ A · งานถัดไปเด่น" stays at /monitor?v=hero.
// The previous full table stays at /monitor?v=table; the retro view at ?classic=1.
// /monitor?v=3d = แบบ B (same table + the 3D mascot column), opt-in until the
// team has seen it run on the office TV; add &static=1 to keep it still.
// /monitor?v=rows&theme=a|b|c = แบบแถว (Kook's layout, 29 Oct 2026), on trial
// with three colour themes until the team picks one.
export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string; v?: string; static?: string; theme?: string }>;
}) {
  const { classic, v, static: still, theme } = await searchParams;
  if (classic === "1") {
    return <ClassicMonitor />;
  }
  // The TV opens this page without signing in; a signed-in phone/PC may tap a job to open it.
  const user = isSupabaseConfigured() ? await getSessionUser(await createClient()).catch(() => null) : null;
  const linkable = Boolean(user && user.role !== "display");
  if (v === "3d") {
    return <TableMonitor variant="3d" staticMode={still === "1"} linkable={linkable} />;
  }
  if (v === "table") return <TableMonitor linkable={linkable} />;
  if (v === "rows") {
    const t: RowsTheme = theme === "b" || theme === "c" ? theme : "a";
    return <RowsMonitor linkable={linkable} staticMode={still === "1"} theme={t} />;
  }
  if (v === "hero") return <HeroMonitor linkable={linkable} staticMode={still === "1"} />;
  const boardTheme = theme === "b" || theme === "c" ? theme : "a";
  return <BoardMonitor linkable={linkable} staticMode={still === "1"} theme={boardTheme} />;
}
