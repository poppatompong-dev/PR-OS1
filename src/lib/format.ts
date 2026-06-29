import type { AckStatus, EventStatus, Urgency } from "@/types/domain";

export function formatThaiDate(isoDate: string) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00+07:00`));
}

export function eventStatusLabel(status: EventStatus) {
  return {
    draft: "ร่าง",
    published: "เผยแพร่",
    completed: "เสร็จสิ้น",
    canceled: "ยกเลิก",
  }[status];
}

export function ackStatusLabel(status: AckStatus) {
  return {
    acknowledged: "รับทราบแล้ว",
    pending: "รอรับทราบ",
    not_required: "ยังไม่ต้องรับทราบ",
  }[status];
}

export function urgencyLabel(urgency: Urgency) {
  return {
    normal: "ปกติ",
    important: "สำคัญ",
    urgent: "ด่วน",
  }[urgency];
}
