// Deterministic, rules-based management summary in Thai (no LLM in MVP).

export type SmartSummaryInput = {
  totalEvents: number;
  publishedEvents: number;
  pendingAcks: number;
  changedEvents: number;
  canceledEvents: number;
  todayEvents: number;
  topWorkloadPerson: string;
};

export function buildSmartSummary(d: SmartSummaryInput): string {
  if (d.totalEvents === 0) {
    return "ยังไม่มีงานประชาสัมพันธ์ในช่วงเวลาที่เลือก";
  }

  const parts: string[] = [];
  parts.push(
    `ในช่วงที่เลือกมีงานประชาสัมพันธ์ทั้งหมด ${d.totalEvents} รายการ (เผยแพร่แล้ว ${d.publishedEvents} รายการ)`,
  );
  if (d.todayEvents > 0) {
    parts.push(`วันนี้มีงาน ${d.todayEvents} รายการ`);
  }
  if (d.pendingAcks > 0) {
    parts.push(`มีการรับทราบค้างอยู่ ${d.pendingAcks} รายการ ควรติดตามก่อนถึงวันงาน`);
  } else {
    parts.push("ผู้รับมอบหมายรับทราบครบแล้ว");
  }
  if (d.changedEvents > 0 || d.canceledEvents > 0) {
    parts.push(`มีงานที่เปลี่ยนแปลง ${d.changedEvents} รายการ และยกเลิก ${d.canceledEvents} รายการ`);
  }
  if (d.topWorkloadPerson !== "—") {
    parts.push(`ผู้มีภาระงานสูงสุดคือ ${d.topWorkloadPerson}`);
  }

  return `${parts.join(" · ")}.`;
}
