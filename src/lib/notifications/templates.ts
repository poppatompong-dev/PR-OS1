// Thai message templates for notifications, matching docs/09-notification-design.md.
// Used by both LINE (plain text) and Email (subject + plain text body).

import { formatThaiDate } from "@/lib/format";

export type NotificationContext = {
  eventTitle: string;
  eventDate: string; // ISO date
  startTime: string; // HH:MM
  locationName: string;
  roleName: string;
  ackUrl: string;
  changeSummary?: string;
  cancellationReason?: string;
};

function eventWhen(ctx: NotificationContext): string {
  return `${formatThaiDate(ctx.eventDate)} เวลา ${ctx.startTime}`;
}

export function buildNotificationText(
  type: "assignment" | "reminder" | "change" | "cancellation",
  ctx: NotificationContext,
): { subject: string; body: string } {
  switch (type) {
    case "assignment":
      return {
        subject: `แจ้งมอบหมายงาน: ${ctx.eventTitle}`,
        body: [
          "แจ้งมอบหมายงานประชาสัมพันธ์",
          `งาน: ${ctx.eventTitle}`,
          `วันที่: ${eventWhen(ctx)}`,
          `สถานที่: ${ctx.locationName}`,
          `บทบาท: ${ctx.roleName}`,
          `กรุณากดรับทราบ: ${ctx.ackUrl}`,
        ].join("\n"),
      };
    case "reminder":
      return {
        subject: `เตือนงานใกล้ถึง: ${ctx.eventTitle}`,
        body: [
          "เตือนงานประชาสัมพันธ์ที่ใกล้ถึง",
          `งาน: ${ctx.eventTitle}`,
          `วันที่: ${eventWhen(ctx)}`,
          `สถานที่: ${ctx.locationName}`,
          `บทบาท: ${ctx.roleName}`,
        ].join("\n"),
      };
    case "change":
      return {
        subject: `มีการเปลี่ยนแปลงงาน: ${ctx.eventTitle}`,
        body: [
          "มีการเปลี่ยนแปลงงานประชาสัมพันธ์",
          `งาน: ${ctx.eventTitle}`,
          `เปลี่ยนแปลง: ${ctx.changeSummary ?? "รายละเอียดงานมีการแก้ไข"}`,
          `กรุณาตรวจสอบและรับทราบใหม่: ${ctx.ackUrl}`,
        ].join("\n"),
      };
    case "cancellation":
      return {
        subject: `ยกเลิกงาน: ${ctx.eventTitle}`,
        body: [
          "ยกเลิกงานประชาสัมพันธ์",
          `งาน: ${ctx.eventTitle}`,
          `วันที่เดิม: ${eventWhen(ctx)}`,
          `เหตุผล: ${ctx.cancellationReason ?? "ไม่ระบุ"}`,
        ].join("\n"),
      };
  }
}
