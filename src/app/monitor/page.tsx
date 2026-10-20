import { ClassicMonitor } from "./ClassicMonitor";
import { TableMonitor } from "./TableMonitor";

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
  if (v === "3d") {
    return <TableMonitor variant="3d" staticMode={still === "1"} />;
  }
  return <TableMonitor />;
}
