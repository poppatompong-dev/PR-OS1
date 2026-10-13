import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EventCardList } from "@/components/EventCardList";
import { getReportData } from "@/lib/reports/queries";
import { formatThaiDate } from "@/lib/format";
import { ArrowRight, PlusCircle } from "lucide-react";
import { addDays, todayInBangkok } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = todayInBangkok();
  const report = await getReportData({ from: today, to: addDays(today, 30) });

  const weekEnd = addDays(today, 7);
  const todays = report.events.filter((e) => e.eventDate === today);
  const nextSeven = report.events.filter((e) => e.eventDate > today && e.eventDate <= weekEnd);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">วันนี้</h1>
          <p className="page-subtitle">{formatThaiDate(today)}</p>
        </div>
        <Link className="button" href="/events/new">
          <PlusCircle size={18} aria-hidden="true" />
          เพิ่มงานใหม่
        </Link>
      </header>

      {/* The one question this page answers: what is on today, and who has not
          acknowledged yet. The number that needs action is the largest thing
          on the screen and sits top-left. */}
      <section className="today-lead" aria-label="สถานะที่ต้องลงมือ">
        <article className={`lead-stat${report.pendingAcks > 0 ? " lead-stat-alert" : ""}`}>
          <span className="lead-value">{report.pendingAcks}</span>
          <span className="lead-label">ยังไม่รับทราบ</span>
          <span className="lead-hint">ต้องตามก่อนถึงวันงาน</span>
        </article>
        <div className="lead-side">
          <article className="side-stat">
            <span className="side-value">{todays.length}</span>
            <span className="side-label">งานวันนี้</span>
          </article>
          <article className="side-stat">
            <span className="side-value">{nextSeven.length}</span>
            <span className="side-label">7 วันข้างหน้า</span>
          </article>
          <article className="side-stat">
            <span className="side-value">{report.changedOrCanceled}</span>
            <span className="side-label">เปลี่ยน / ยกเลิก</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>งานวันนี้</h2>
          <Link className="link-more" href="/schedule">
            ดูตารางทั้งหมด
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <EventCardList events={todays} emptyText="วันนี้ไม่มีงานประชาสัมพันธ์" />
      </section>

      {report.unacked.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h2>รอการรับทราบ</h2>
            <span className="panel-count">{report.unacked.length} รายการ</span>
          </div>
          <ul className="unack-list">
            {report.unacked.slice(0, 8).map((row, i) => (
              <li key={`${row.eventTitle}-${row.personName}-${i}`}>
                <span className="unack-person">{row.personName}</span>
                <span className="unack-event">{row.eventTitle}</span>
                <span className="unack-meta">
                  {row.roleName} · {formatThaiDate(row.eventDate)}
                  {row.status === "declined" ? " · แจ้งไม่สะดวก" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>7 วันข้างหน้า</h2>
          <span className="panel-count">{nextSeven.length} รายการ</span>
        </div>
        <EventCardList events={nextSeven.slice(0, 6)} emptyText="ไม่มีงานในเจ็ดวันข้างหน้า" />
      </section>

      <section className="panel panel-quiet">
        <h2>สรุปสำหรับผู้บริหาร</h2>
        <p>{report.smartSummary}</p>
      </section>
    </AppShell>
  );
}
