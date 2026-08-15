// Excel export for /reports.
//
// The filters come from the report screen's query string, so the file always
// matches what the user is looking at (docs/05: "export respects on-screen
// filters"). Every export is audit logged.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { getReportData } from "@/lib/reports/queries";
import { buildReportXlsx, reportFileName } from "@/lib/reports/export";

export const dynamic = "force-dynamic";

// audit_logs.entity_id is NOT NULL, but an export has no single entity.
// The nil UUID marks "system-wide" rows; entity_type = 'report' identifies them.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can.viewReports(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || todayInBangkok();
  const to = url.searchParams.get("to") || from;
  const departmentId = url.searchParams.get("departmentId") || undefined;

  const report = await getReportData({ from, to, departmentId });
  const workbook = buildReportXlsx(report);

  await supabase.from("audit_logs").insert({
    entity_type: "report",
    entity_id: NIL_UUID,
    action: "export",
    changed_by: user.id,
    summary: `ส่งออกรายงาน Excel ช่วง ${from} ถึง ${to} (${report.totalEvents} งาน)`,
    new_values: {
      format: "xlsx",
      from,
      to,
      department_id: departmentId ?? null,
      total_events: report.totalEvents,
    },
  });

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${reportFileName(report, "xlsx")}"`,
      "Cache-Control": "no-store",
    },
  });
}
