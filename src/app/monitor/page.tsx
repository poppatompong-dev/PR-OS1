import { ClassicMonitor } from "./ClassicMonitor";
import { TableMonitor } from "./TableMonitor";

export const dynamic = "force-dynamic";

// Default: clean, large, readable table (per user feedback).
// Legacy retro-TV view is kept at /monitor?classic=1.
export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string }>;
}) {
  const { classic } = await searchParams;
  if (classic === "1") {
    return <ClassicMonitor />;
  }
  return <TableMonitor />;
}
