import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EventTable } from "@/components/EventTable";
import { MetricCard } from "@/components/MetricCard";
import { events, reportSummary } from "@/data/mock-data";
import { ArrowRight, BellRing, CalendarClock, FileText, PlusCircle, RadioTower, ShieldCheck, Tv } from "lucide-react";

export default function HomePage() {
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">ภาพรวมระบบ PR-OS</h1>
          <p className="page-subtitle">Mock dashboard สำหรับตรวจทิศทางระบบก่อนพัฒนาจริง</p>
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
            LIVE PUBLIC RELATIONS OPS
          </span>
          <h2>
            PR
            <span>OPERATIONS</span>
          </h2>
          <p>จอมอนิเตอร์ ตารางงาน การรับทราบ และรายงานผู้บริหาร อยู่ในภาพเดียวที่ทีมอ่านทันที</p>
          <div className="stage-actions">
            <Link className="button coral" href="/monitor">
              เปิดจอมอนิเตอร์
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="button glass" href="/schedule">
              ดูตารางงาน
            </Link>
          </div>
        </div>
        <aside className="stage-preview" aria-label="Operational status preview">
          <div className="preview-number">02</div>
          <div className="preview-screen">
            <span className="loader-ring" />
            <strong>กำลังติดตาม</strong>
            <small>{reportSummary.pendingAcknowledgements} รายการรอรับทราบ</small>
          </div>
          <div className="preview-caption">
            <strong>Live Assignment Signal</strong>
            <p>แจ้งเตือนเฉพาะผู้เกี่ยวข้อง พร้อม audit trail</p>
          </div>
        </aside>
      </section>

      <section className="command-strip">
        <section className="panel">
          <h2>Operational Readiness</h2>
          <div className="ops-list">
            <div className="ops-item">
              <CalendarClock size={18} aria-hidden="true" />
              งานวันนี้พร้อมตรวจสอบและขึ้นจอมอนิเตอร์
            </div>
            <div className="ops-item">
              <BellRing size={18} aria-hidden="true" />
              แจ้งเตือนเฉพาะผู้ได้รับมอบหมาย
            </div>
          </div>
        </section>
        <section className="panel">
          <h2>Control Layer</h2>
          <div className="ops-list">
            <div className="ops-item">
              <Tv size={18} aria-hidden="true" />
              Monitor-safe view
            </div>
            <div className="ops-item">
              <ShieldCheck size={18} aria-hidden="true" />
              Private attachments
            </div>
            <div className="ops-item">
              <FileText size={18} aria-hidden="true" />
              Audit-ready changes
            </div>
          </div>
        </section>
      </section>

      <section className="metric-grid" aria-label="KPI overview">
        <MetricCard label="งานทั้งหมด" value={reportSummary.totalEvents} hint="ใน mock data ชุดนี้" tone="blue" />
        <MetricCard label="เผยแพร่แล้ว" value={reportSummary.publishedEvents} hint="พร้อมขึ้นจอมอนิเตอร์" tone="green" />
        <MetricCard label="รอรับทราบ" value={reportSummary.pendingAcknowledgements} hint="ต้องติดตามก่อนถึงวันงาน" tone="amber" />
        <MetricCard label="เปลี่ยน/ยกเลิก" value={reportSummary.changedOrCanceled} hint="ต้องตรวจสอบการแจ้งเตือน" tone="red" />
      </section>

      <section className="panel">
        <h2>Smart Summary</h2>
        <p>
          ช่วงนี้มีงานเผยแพร่แล้ว {reportSummary.publishedEvents} งาน และมีรายการรอรับทราบ{" "}
          {reportSummary.pendingAcknowledgements} รายการ โดยผู้มีภาระงานสูงสุดในตัวอย่างคือ{" "}
          {reportSummary.topWorkloadPerson} ควรตรวจงานที่มีการเปลี่ยนแปลงก่อนส่งแจ้งเตือนซ้ำ
        </p>
      </section>

      <EventTable events={events} />
    </AppShell>
  );
}
