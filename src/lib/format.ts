import type { AckStatus, EventStatus, Urgency } from "@/types/domain";

/**
 * Every formatter here pins timeZone to Asia/Bangkok on purpose. Without it
 * Intl falls back to the *runtime's* zone, which is UTC on Vercel — and
 * midnight Bangkok is 17:00 the previous day in UTC, so every date in the
 * app rendered one day early in production.
 */
export function formatThaiDate(isoDate: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00+07:00`));
}

/** A timestamp (ISO with zone) as Thai date + time in Bangkok, e.g. "20 ต.ค. 69 13:05". */
export function formatThaiDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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

export function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function urgencyLabel(urgency: Urgency) {
  return {
    normal: "ปกติ",
    important: "สำคัญ",
    urgent: "ด่วน",
  }[urgency];
}
