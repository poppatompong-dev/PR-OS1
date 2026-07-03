import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { EventTable } from "@/components/EventTable";
import { getReportData } from "@/lib/reports/queries";
import { formatThaiDate } from "@/lib/format";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = todayInBangkok();
  const from = sp.from || today;
  const to = sp.to || addDays(today, 30);

  const report = await getReportData({ from, to });

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">รายงานผู้บริหาร</h1>
          <p className="page-subtitle">Smart Summary จากข้อมูลจริง (กฎคำนวณ ไม่พึ่ง AI ใน MVP)</p>
        </div>
      </header>

      <form className="toolbar" method="get" aria-label="Report range">
        <label className="form-field">
          ตั้งแต่
          <input className="input" type="date" name="from" defaultValue={from} />
        </label>
        <label className="form-field">
          ถึง
          <input className="input" type="date" name="to" defaultValue={to} />
        </label>
        <button className="button" type="submit">
          <Sparkles size={18} aria-hidden="true" />
          สร้างรายงาน
        </button>
      </form>

      <section className="metric-grid">
        <MetricCard label="งานทั้งหมด" value={report.totalEvents} hint="ตามช่วงเวลาที่เลือก" tone="blue" />
        <MetricCard label="เผยแพร่แล้ว" value={report.publishedEvents} hint="แสดงบนจอมอนิเตอร์" tone="green" />
        <MetricCard label="รอรับทราบ" value={report.pendingAcks} hint="ควรติดตามก่อนวันงาน" tone="amber" />
        <MetricCard label="เปลี่ยน/ยกเลิก" value={report.changedOrCanceled} hint="มีผลต่อการแจ้งเตือน" tone="red" />
        <MetricCard label="งานวันนี้" value={report.todayEvents} hint="ตามเวลาประเทศไทย" tone="teal" />
        <MetricCard label="ภาระงานสูงสุด" value={report.topWorkloadPerson} hint="ตามจำนวน assignment" tone="teal" />
      </section>

      <section className="panel">
        <h2>สรุปอัจฉริยะ</h2>
        <p>{report.smartSummary}</p>
      </section>

      <section className="report-cols">
        <div className="panel">
          <h2>ภาระงานตามบุคคล</h2>
          {report.workload.length > 0 ? (
            <ul className="audit-list">
              {report.workload.map((row) => (
                <li key={row.personName}>
                  <span className="audit-time">{row.count} งาน</span>
                  <span>{row.personName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>ไม่มีข้อมูล</p>
          )}
        </div>

        <div className="panel">
          <h2>การรับทราบที่ค้างอยู่</h2>
          {report.unacked.length > 0 ? (
            <ul className="audit-list">
              {report.unacked.map((row, i) => (
                <li key={`${row.eventTitle}-${row.personName}-${i}`}>
                  <span className="audit-time">{formatThaiDate(row.eventDate)}</span>
                  <span>
                    {row.eventTitle} — {row.personName} ({row.roleName})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>รับทราบครบแล้ว 🎉</p>
          )}
        </div>
      </section>

      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <EventTable events={report.events} />
      </section>
    </AppShell>
  );
}
