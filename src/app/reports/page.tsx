import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { EventTable } from "@/components/EventTable";
import { events, reportSummary } from "@/data/mock-data";
import { Download, FileSpreadsheet, Sparkles } from "lucide-react";

export default function ReportsPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">รายงานผู้บริหาร</h1>
          <p className="page-subtitle">Smart Summary จากข้อมูลจริง ไม่พึ่ง AI หนักใน MVP</p>
        </div>
        <div className="toolbar">
          <button className="button secondary">
            <Download size={18} aria-hidden="true" />
            PDF
          </button>
          <button className="button secondary">
            <FileSpreadsheet size={18} aria-hidden="true" />
            Excel
          </button>
        </div>
      </header>

      <section className="toolbar">
        <input className="input" type="date" defaultValue="2026-07-01" />
        <input className="input" type="date" defaultValue="2026-07-31" />
        <button className="button">
          <Sparkles size={18} aria-hidden="true" />
          สร้างรายงาน
        </button>
      </section>

      <section className="metric-grid">
        <MetricCard label="งานทั้งหมด" value={reportSummary.totalEvents} hint="ตามช่วงเวลาที่เลือก" tone="blue" />
        <MetricCard label="รอรับทราบ" value={reportSummary.pendingAcknowledgements} hint="ควรติดตามก่อนวันงาน" tone="amber" />
        <MetricCard label="เปลี่ยน/ยกเลิก" value={reportSummary.changedOrCanceled} hint="มีผลต่อการแจ้งเตือน" tone="red" />
        <MetricCard label="ภาระงานสูงสุด" value={reportSummary.topWorkloadPerson} hint="ตามจำนวน assignment" tone="teal" />
      </section>

      <section className="panel">
        <h2>สรุปอัจฉริยะ</h2>
        <p>
          เดือนนี้มีงานประชาสัมพันธ์ {reportSummary.totalEvents} รายการ มีงานที่เผยแพร่แล้ว{" "}
          {reportSummary.publishedEvents} รายการ และยังมีการรับทราบค้างอยู่{" "}
          {reportSummary.pendingAcknowledgements} รายการ ควรเน้นติดตามงานที่มีการเปลี่ยนแปลงและงานใกล้ถึงวันจัด
        </p>
      </section>

      <EventTable events={events} />
    </AppShell>
  );
}
