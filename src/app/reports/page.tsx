import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { EventCardList } from "@/components/EventCardList";
import { EventTable } from "@/components/EventTable";
import { getReportData } from "@/lib/reports/queries";
import { formatThaiDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";
import {
  ActivityReport,
  PeriodReport,
  PersonReport,
} from "@/components/ReportBreakdowns";
import type { Granularity } from "@/lib/reports/breakdowns";
import type { RangePreset } from "@/lib/date";
import { FileSpreadsheet, Printer, Sparkles } from "lucide-react";
import {
  addDays,
  fiscalYearLabel,
  resolveRange,
  todayInBangkok,
} from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    preset?: string;
    tab?: string;
    by?: string;
  }>;
}) {
  const sp = await searchParams;
  const today = todayInBangkok();

  // A named range wins over the raw dates, so the preset buttons stay honest
  // when someone switches tabs: the link carries the preset, not a snapshot.
  const preset = (sp.preset ?? "") as RangePreset | "";
  const presetRange = preset ? resolveRange(preset, today) : null;
  const from = presetRange?.from ?? sp.from ?? today;
  const to = presetRange?.to ?? sp.to ?? addDays(today, 30);

  const tab =
    sp.tab === "person" || sp.tab === "activity" || sp.tab === "period"
      ? sp.tab
      : "overview";
  const granularity: Granularity =
    sp.by === "quarter" || sp.by === "year" ? sp.by : "month";

  const report = await getReportData({ from, to });

  const rangeQuery = preset ? `preset=${preset}` : `from=${from}&to=${to}`;
  const tabUrl = (next: string) =>
    `/reports?${rangeQuery}&tab=${next}${next === "period" ? `&by=${granularity}` : ""}`;
  const presetUrl = (next: RangePreset) =>
    `/reports?preset=${next}&tab=${tab}${tab === "period" ? `&by=${granularity}` : ""}`;
  const granularityUrl = (next: Granularity) =>
    `/reports?${rangeQuery}&tab=period&by=${next}`;

  const PRESETS: { value: RangePreset; label: string }[] = [
    { value: "next-30-days", label: "30 วันข้างหน้า" },
    { value: "this-month", label: "เดือนนี้" },
    { value: "this-quarter", label: "ไตรมาสนี้" },
    { value: "fiscal-year", label: fiscalYearLabel(today) },
    { value: "last-12-months", label: "ย้อนหลัง 12 เดือน" },
  ];

  const TABS: { value: string; label: string }[] = [
    { value: "overview", label: "ภาพรวม" },
    { value: "period", label: "รายเดือน/ไตรมาส/ปี" },
    { value: "person", label: "รายบุคคล" },
    { value: "activity", label: "รายกิจกรรม" },
  ];

  // Export endpoints require can.viewReports; hide the buttons for roles that
  // would only get a 403 back.
  // Demo mode: show the export buttons so they can be demonstrated. With
  // Supabase connected the real role decides, and the endpoint checks again.
  let canExport = !isSupabaseConfigured();
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    canExport = can.viewReports(user?.role ?? "assignee");
  }

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">รายงานผู้บริหาร</h1>
          <p className="page-subtitle">
            สรุปภาพรวมและสถิติงานประชาสัมพันธ์ เทศบาลนครนครสวรรค์
          </p>
        </div>
      </header>

      <nav className="chip-row" aria-label="ช่วงเวลาสำเร็จรูป">
        {PRESETS.map((item) => (
          <Link
            key={item.value}
            href={presetUrl(item.value)}
            className={`chip${preset === item.value ? " is-on" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <form className="toolbar" method="get" aria-label="Report range">
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="by" value={granularity} />
        <label className="form-field">
          ตั้งแต่
          <input
            className="input"
            type="date"
            name="from"
            defaultValue={from}
          />
        </label>
        <label className="form-field">
          ถึง
          <input className="input" type="date" name="to" defaultValue={to} />
        </label>
        <button className="button" type="submit">
          <Sparkles size={18} aria-hidden="true" />
          ประมวลผลรายงาน
        </button>
      </form>

      {/* Exports carry the on-screen range, and each one is audit logged. */}
      {canExport ? (
        <div className="toolbar export-toolbar">
          <a
            className="button secondary"
            href={`/api/reports/export?from=${from}&to=${to}`}
          >
            <FileSpreadsheet size={18} aria-hidden="true" />
            ดาวน์โหลด Excel (.xlsx)
          </a>
          <a
            className="button secondary"
            href={`/reports/print?from=${from}&to=${to}`}
            target="_blank"
            rel="noopener"
          >
            <Printer size={18} aria-hidden="true" />
            พิมพ์ / บันทึก PDF
          </a>
        </div>
      ) : null}

      <nav className="tab-row" aria-label="ชนิดรายงาน">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={tabUrl(item.value)}
            className={`tab${tab === item.value ? " is-on" : ""}`}
            aria-current={tab === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="metric-grid">
        <MetricCard
          label="งานทั้งหมด"
          value={report.totalEvents}
          hint="ตามช่วงเวลาที่เลือก"
          tone="blue"
        />
        <MetricCard
          label="เผยแพร่แล้ว"
          value={report.publishedEvents}
          hint="แสดงบนจอมอนิเตอร์"
          tone="green"
        />
        <MetricCard
          label="รอรับทราบ"
          value={report.pendingAcks}
          hint="ควรติดตามก่อนวันงาน"
          tone="amber"
        />
        <MetricCard
          label="เปลี่ยน/ยกเลิก"
          value={report.changedOrCanceled}
          hint="มีผลต่อการแจ้งเตือน"
          tone="red"
        />
        <MetricCard
          label="งานวันนี้"
          value={report.todayEvents}
          hint="ตามเวลาประเทศไทย"
          tone="teal"
        />
        <MetricCard
          label="ภาระงานสูงสุด"
          value={report.topWorkloadPerson}
          hint="ตามจำนวนงานที่ได้รับมอบหมาย"
          tone="teal"
        />
      </section>

      {tab === "overview" ? (
        <>
          <section className="panel">
            <h2>สรุปภาพรวมสำหรับผู้บริหาร (Executive Summary)</h2>
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
                      <span className="audit-time">
                        {formatThaiDate(row.eventDate)}
                      </span>
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

          <section
            className="panel only-wide"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <EventTable events={report.events} />
          </section>

          <section className="only-narrow">
            <div className="panel-head">
              <h2>งานในช่วงที่เลือก</h2>
              <span className="panel-count">{report.events.length}</span>
            </div>
            <EventCardList
              events={report.events}
              groupByDate
              today={today}
              emptyText="ไม่มีงานในช่วงเวลานี้"
            />
          </section>
        </>
      ) : null}

      {tab === "period" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>สรุปตามช่วงเวลา</h2>
            <div
              className="view-switch"
              role="group"
              aria-label="ความละเอียดของช่วงเวลา"
            >
              {(
                [
                  { value: "month", label: "รายเดือน" },
                  { value: "quarter", label: "รายไตรมาส" },
                  { value: "year", label: "รายปี" },
                ] as { value: Granularity; label: string }[]
              ).map((item) => (
                <Link
                  key={item.value}
                  href={granularityUrl(item.value)}
                  className={`button ${granularity === item.value ? "coral" : "secondary"}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <PeriodReport events={report.events} granularity={granularity} />
        </section>
      ) : null}

      {tab === "person" ? (
        <section className="panel">
          <h2>รายงานการปฏิบัติงานรายบุคคล</h2>
          <PersonReport events={report.events} />
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="panel">
          <h2>รายงานตามประเภทงาน / โครงการ</h2>
          <ActivityReport events={report.events} />
        </section>
      ) : null}
    </AppShell>
  );
}
