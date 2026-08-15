import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EventTable } from "@/components/EventTable";
import { MetricCard } from "@/components/MetricCard";
import { getReportData } from "@/lib/reports/queries";
import { ArrowRight, BellRing, CalendarClock, FileText, PlusCircle, RadioTower, ShieldCheck, Tv } from "lucide-react";

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

export default async function HomePage() {
  const today = todayInBangkok();
  const report = await getReportData({ from: today, to: addDays(today, 30) });

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ภาพรวมระบบ PR-OS</h1>
          <p className="page-subtitle">สรุปงานและสถานะการรับทราบจากข้อมูลจริง (วันนี้ถึง 30 วันข้างหน้า)</p>
        </div>
        <Link className="button" href="/events/new">
          <PlusCircle size={18} aria-hidden="true" />
          เพิ่มงานใหม่
        </Link>
      </header>

      <section className="visual-stage" aria-label="PR-OS command center">
        <div className="stage-rail" aria-hidden="true">
          <span>วันนี้</span>
          <i />
          <span>มอบหมาย</span>
          <i />
          <span>รับทราบ</span>
          <i />
          <span>รายงาน</span>
        </div>
        <div className="stage-dots" aria-hidden="true" />
        <div className="fluid-blob blob-one" aria-hidden="true" />
        <div className="fluid-blob blob-two" aria-hidden="true" />
        <div className="stage-content">
          <span className="stage-kicker">
            <RadioTower size={18} aria-hidden="true" />
            ศูนย์บริหารงานประชาสัมพันธ์แบบเรียลไทม์
          </span>
          <h2>
            PR-OS
            <span>เทศบาลนครนครสวรรค์</span>
          </h2>
          <p>จอมอนิเตอร์ ตารางงาน การรับทราบงาน และรายงานผู้บริหาร รวมศูนย์อยู่ในระบบเดียว</p>
          <div className="stage-actions">
            <Link className="button coral" href="/monitor">
              เปิดจอมอนิเตอร์
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="button glass" href="/schedule">
              ดูตารางงานและปฏิทิน
            </Link>
          </div>
        </div>
        <aside className="stage-preview" aria-label="Operational status preview">
          <div className="preview-number">02</div>
          <div className="preview-screen">
            <span className="loader-ring" />
            <strong>สถานะติดตามงาน</strong>
            <small>{report.pendingAcks} รายการรอรับทราบ</small>
          </div>
          <div className="preview-caption">
            <strong>ระบบแจ้งเตือนการมอบหมายงาน</strong>
            <p>แจ้งเตือนเฉพาะผู้เกี่ยวข้อง พร้อมบันทึกประวัติ</p>
          </div>
        </aside>
      </section>

      <section className="command-strip">
        <section className="panel">
          <h2>ความพร้อมการดำเนินงาน</h2>
          <div className="ops-list">
            <div className="ops-item">
              <CalendarClock size={18} aria-hidden="true" />
              งานวันนี้พร้อมตรวจสอบและขึ้นจอมอนิเตอร์
            </div>
            <div className="ops-item">
              <BellRing size={18} aria-hidden="true" />
              ระบบแจ้งเตือนล่วงหน้าเฉพาะผู้รับผิดชอบ
            </div>
          </div>
        </section>
        <section className="panel">
          <h2>การควบคุมความปลอดภัย</h2>
          <div className="ops-list">
            <div className="ops-item">
              <Tv size={18} aria-hidden="true" />
              จอมอนิเตอร์ปลอดภัยจากข้อมูลส่วนตัว
            </div>
            <div className="ops-item">
              <ShieldCheck size={18} aria-hidden="true" />
              ไฟล์แนบเอกสารส่วนตัวเฉพาะผู้มีสิทธิ์
            </div>
            <div className="ops-item">
              <FileText size={18} aria-hidden="true" />
              บันทึกประวัติการแก้ไขและส่งออกรายงาน
            </div>
          </div>
        </section>
      </section>

      <section className="metric-grid" aria-label="KPI overview">
        <MetricCard label="งานทั้งหมด" value={report.totalEvents} hint="วันนี้ถึง 30 วันข้างหน้า" tone="blue" />
        <MetricCard label="เผยแพร่แล้ว" value={report.publishedEvents} hint="พร้อมขึ้นจอมอนิเตอร์" tone="green" />
        <MetricCard label="รอรับทราบ" value={report.pendingAcks} hint="ต้องติดตามก่อนถึงวันงาน" tone="amber" />
        <MetricCard label="เปลี่ยน/ยกเลิก" value={report.changedOrCanceled} hint="ต้องตรวจสอบการแจ้งเตือน" tone="red" />
      </section>

      <section className="panel">
        <h2>สรุปภาพรวมสำหรับผู้บริหาร (Smart Summary)</h2>
        <p>{report.smartSummary}</p>
      </section>

      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <EventTable events={report.events.slice(0, 8)} />
      </section>
    </AppShell>
  );
}
