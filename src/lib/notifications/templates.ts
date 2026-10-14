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
  // For notices sent to a supervisor about someone else's assignment.
  eventUrl?: string;
  personName?: string;
  declineReason?: string;
  // escalation: who still has not answered, and who said ไม่สะดวก
  pendingPeople?: string[];
  declinedPeople?: string[];
};

export type NotificationType =
  | "assignment"
  | "reminder"
  | "change"
  | "cancellation"
  | "declined"
  | "escalation";

function eventWhen(ctx: NotificationContext): string {
  return `${formatThaiDate(ctx.eventDate)} เวลา ${ctx.startTime}`;
}

export function buildNotificationText(
  type: NotificationType,
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
        subject: `[เตือนความจำ] งานใกล้ถึง: ${ctx.eventTitle}`,
        body: [
          "⏰ เตือนงานประชาสัมพันธ์ที่กำลังจะมาถึง",
          `งาน: ${ctx.eventTitle}`,
          `วันที่: ${eventWhen(ctx)}`,
          `สถานที่: ${ctx.locationName}`,
          `บทบาท: ${ctx.roleName}`,
          `กรุณาตรวจสอบและรับทราบงาน: ${ctx.ackUrl}`,
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
    case "declined":
      return {
        subject: `แจ้งไม่สะดวก: ${ctx.personName ?? "ผู้รับงาน"} — ${ctx.eventTitle}`,
        body: [
          "ผู้รับงานแจ้งไม่สะดวก — กรุณาจัดคนแทน",
          `งาน: ${ctx.eventTitle}`,
          `วันที่: ${eventWhen(ctx)}`,
          `ผู้รับงาน: ${ctx.personName ?? "—"} (${ctx.roleName})`,
          `เหตุผล: ${ctx.declineReason ?? "ไม่ระบุ"}`,
          `เปลี่ยนผู้รับผิดชอบ: ${ctx.eventUrl ?? ctx.ackUrl}`,
        ].join("\n"),
      };
    case "escalation": {
      const lines = [
        "งานใกล้เริ่มแล้ว แต่ยังมีผู้รับงานที่ไม่ได้ตอบรับ",
        `งาน: ${ctx.eventTitle}`,
        `วันที่: ${eventWhen(ctx)}`,
        `สถานที่: ${ctx.locationName}`,
      ];
      if (ctx.pendingPeople?.length) lines.push(`ยังไม่รับทราบ: ${ctx.pendingPeople.join(", ")}`);
      if (ctx.declinedPeople?.length) lines.push(`แจ้งไม่สะดวก: ${ctx.declinedPeople.join(", ")}`);
      lines.push(`ตรวจสอบ/เปลี่ยนคน: ${ctx.eventUrl ?? ctx.ackUrl}`);
      return {
        subject: `[แจ้งหัวหน้า] ยังมีคนไม่รับทราบ: ${ctx.eventTitle}`,
        body: lines.join("\n"),
      };
    }
  }
}

export type DigestItem = {
  startTime: string; // HH:MM
  title: string;
  locationName: string;
  roleName: string;
  answer: "acknowledged" | "pending" | "declined";
};

/**
 * One message per person per day: tomorrow's work in time order. Sent at
 * 17:00 instead of a 24-hour reminder per job, because the free LINE OA
 * quota in Thailand (300/month) covers about 40 jobs sent job-by-job.
 */
export function buildDigestText(
  date: string,
  items: DigestItem[],
  ackUrl: string,
): { subject: string; body: string } {
  const answer = (a: DigestItem["answer"]) =>
    a === "acknowledged" ? "" : a === "declined" ? " — แจ้งไม่สะดวกแล้ว" : " — ยังไม่รับทราบ";
  const pending = items.filter((i) => i.answer === "pending").length;
  return {
    subject: `งานของคุณพรุ่งนี้ ${formatThaiDate(date)} (${items.length} งาน)`,
    body: [
      `งานของคุณพรุ่งนี้ ${formatThaiDate(date)} — ${items.length} งาน`,
      ...items.map(
        (i) => `• ${i.startTime} ${i.title} @ ${i.locationName} (${i.roleName})${answer(i.answer)}`,
      ),
      pending > 0 ? `กดรับทราบได้ที่: ${ackUrl}` : `ดูรายละเอียด: ${ackUrl}`,
    ].join("\n"),
  };
}
