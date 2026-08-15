// Print-optimized report view. Opened in a new tab from /reports; the user
// prints it or saves it as PDF from the browser dialog.
// No AppShell here on purpose: navigation chrome must not reach the paper.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { getReportData } from "@/lib/reports/queries";
import { eventStatusLabel, formatThaiDate } from "@/lib/format";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowInBangkok(): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
}

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; departmentId?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!can.viewReports(user.role)) {
    redirect("/?error=" + encodeURIComponent("บัญชีของคุณไม่มีสิทธิ์ดูรายงาน"));
  }

  const from = sp.from || todayInBangkok();
  const to = sp.to || from;
  const report = await getReportData({ from, to, departmentId: sp.departmentId });

  // Same audit trail as the Excel export (docs/08: exports are logged).
  await supabase.from("audit_logs").insert({
    entity_type: "report",
    entity_id: NIL_UUID,
    action: "export",
    changed_by: user.id,
    summary: `เปิดรายงานสำหรับพิมพ์/PDF ช่วง ${from} ถึง ${to} (${report.totalEvents} งาน)`,
    new_values: {
      format: "pdf",
      from,
      to,
      department_id: sp.departmentId ?? null,
      total_events: report.totalEvents,
    },
  });

  const kpis: { label: string; value: string | number }[] = [
    { label: "งานทั้งหมด", value: report.totalEvents },
    { label: "เผยแพร่แล้ว", value: report.publishedEvents },
    { label: "รอรับทราบ", value: report.pendingAcks },
    { label: "เปลี่ยน/ยกเลิก", value: report.changedOrCanceled },
    { label: "งานวันนี้", value: report.todayEvents },
    { label: "ภาระงานสูงสุด", value: report.topWorkloadPerson },
  ];

  return (
    <main className="print-report">
      <div className="print-toolbar">
        <Link className="button secondary" href={`/reports?from=${from}&to=${to}`}>
          กลับหน้ารายงาน
        </Link>
        <PrintButton />
      </div>

      <header className="print-header">
        <h1>รายงานผู้บริหาร — งานประชาสัมพันธ์</h1>
        <p>
          ช่วงวันที่ {formatThaiDate(from)} ถึง {formatThaiDate(to)}
        </p>
        <p className="print-meta">
          พิมพ์เมื่อ {nowInBangkok()} · ผู้ออกรายงาน: {user.displayName ?? user.email ?? "—"}
        </p>
      </header>

      <section>
        <h2>ตัวชี้วัดหลัก</h2>
        <table className="print-table">
          <tbody>
            {kpis.map((kpi) => (
              <tr key={kpi.label}>
                <th scope="row">{kpi.label}</th>
                <td className="print-num">{kpi.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>สรุปอัจฉริยะ</h2>
        <p>{report.smartSummary}</p>
      </section>

      <section>
        <h2>รายการงาน ({report.events.length})</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>เวลา</th>
              <th>งาน/กิจกรรม</th>
              <th>สถานที่</th>
              <th>ผู้รับผิดชอบ</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {report.events.map((event) => (
              <tr key={event.id}>
                <td>{formatThaiDate(event.eventDate)}</td>
                <td className="print-num">
                  {event.startTime}
                  {event.endTime ? `-${event.endTime}` : ""}
                </td>
                <td>{event.title}</td>
                <td>{event.location.name}</td>
                <td>
                  {event.assignments
                    .map((a) => `${a.person.displayName} (${a.role.name})`)
                    .join(", ") || "—"}
                </td>
                <td>
                  {eventStatusLabel(event.status)}
                  {event.hasChanges ? " · เปลี่ยนแปลง" : ""}
                </td>
              </tr>
            ))}
            {report.events.length === 0 ? (
              <tr>
                <td colSpan={6}>ไม่มีงานในช่วงนี้</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="print-break">
        <h2>ภาระงานตามบุคคล</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>ผู้รับผิดชอบ</th>
              <th>จำนวนงาน</th>
            </tr>
          </thead>
          <tbody>
            {report.workload.map((row) => (
              <tr key={row.personName}>
                <td>{row.personName}</td>
                <td className="print-num">{row.count}</td>
              </tr>
            ))}
            {report.workload.length === 0 ? (
              <tr>
                <td colSpan={2}>ไม่มีข้อมูล</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section>
        <h2>การรับทราบที่ค้างอยู่ ({report.unacked.length})</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>งาน/กิจกรรม</th>
              <th>ผู้รับผิดชอบ</th>
              <th>บทบาท</th>
            </tr>
          </thead>
          <tbody>
            {report.unacked.map((row, i) => (
              <tr key={`${row.eventTitle}-${row.personName}-${i}`}>
                <td>{formatThaiDate(row.eventDate)}</td>
                <td>{row.eventTitle}</td>
                <td>{row.personName}</td>
                <td>{row.roleName}</td>
              </tr>
            ))}
            {report.unacked.length === 0 ? (
              <tr>
                <td colSpan={4}>รับทราบครบแล้ว</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <footer className="print-footer">
        PR-OS · ระบบบริหารงานประชาสัมพันธ์ — รายงานนี้ไม่รวมหมายเหตุภายในและไฟล์แนบ
      </footer>
    </main>
  );
}
