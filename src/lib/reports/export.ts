// Report export shaping: turns ReportData into workbook sheets.
//
// Content rule (docs/08): an export mirrors what the report screen shows for a
// supervisor/admin. Internal notes and attachment contents are deliberately
// left out so a forwarded file cannot leak them; short notes (already visible
// on the monitor) are safe to include.

import { buildXlsx, type SheetData } from "@/lib/export/xlsx";
import type { ReportData } from "@/lib/reports/queries";
import { ackStatusLabel, eventStatusLabel, urgencyLabel } from "@/lib/format";

export function buildReportSheets(report: ReportData): SheetData[] {
  const summary: SheetData = {
    name: "สรุป",
    rows: [
      ["รายงานผู้บริหาร PR-OS"],
      ["ช่วงวันที่", `${report.from} ถึง ${report.to}`],
      [],
      ["ตัวชี้วัด", "ค่า"],
      ["งานทั้งหมด", report.totalEvents],
      ["เผยแพร่แล้ว", report.publishedEvents],
      ["รอรับทราบ", report.pendingAcks],
      ["เปลี่ยน/ยกเลิก", report.changedOrCanceled],
      ["งานที่มีการเปลี่ยนแปลง", report.changedEvents],
      ["งานที่ยกเลิก", report.canceledEvents],
      ["งานวันนี้", report.todayEvents],
      ["ภาระงานสูงสุด", report.topWorkloadPerson],
      [],
      ["สรุปอัจฉริยะ", report.smartSummary],
    ],
  };

  const events: SheetData = {
    name: "รายการงาน",
    rows: [
      [
        "วันที่",
        "เวลาเริ่ม",
        "เวลาสิ้นสุด",
        "งาน/กิจกรรม",
        "สถานที่",
        "หน่วยงานเจ้าของเรื่อง",
        "ประเภทงาน",
        "สถานะ",
        "ความสำคัญ",
        "มีการเปลี่ยนแปลง",
        "ผู้รับผิดชอบ",
        "รับทราบแล้ว/ทั้งหมด",
        "หมายเหตุ",
      ],
      ...report.events.map((event) => {
        const acked = event.assignments.filter(
          (a) => a.ackStatus === "acknowledged",
        ).length;
        return [
          event.eventDate,
          event.startTime,
          event.endTime ?? "",
          event.title,
          event.location.name,
          event.ownerDepartment.name,
          event.eventType,
          eventStatusLabel(event.status),
          urgencyLabel(event.urgency),
          event.hasChanges ? "ใช่" : "",
          event.assignments
            .map((a) => `${a.person.displayName} (${a.role.name})`)
            .join(", "),
          `${acked}/${event.assignments.length}`,
          event.shortNote ?? "",
        ];
      }),
    ],
  };

  const workload: SheetData = {
    name: "ภาระงานตามบุคคล",
    rows: [
      ["ผู้รับผิดชอบ", "จำนวนงาน"],
      ...report.workload.map((row) => [row.personName, row.count]),
    ],
  };

  const unacked: SheetData = {
    name: "ค้างรับทราบ",
    rows: [
      ["วันที่", "งาน/กิจกรรม", "ผู้รับผิดชอบ", "บทบาท", "สถานะ"],
      ...report.unacked.map((row) => [
        row.eventDate,
        row.eventTitle,
        row.personName,
        row.roleName,
        ackStatusLabel("pending"),
      ]),
    ],
  };

  return [summary, events, workload, unacked];
}

export function buildReportXlsx(report: ReportData): Buffer {
  return buildXlsx(buildReportSheets(report));
}

export function reportFileName(report: ReportData, extension: string): string {
  return `pr-os-report-${report.from}_${report.to}.${extension}`;
}
