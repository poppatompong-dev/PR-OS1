// Thai labels for notification rows, shared by /settings and the per-person page.

export const NOTIF_TYPE_TH: Record<string, string> = {
  assignment: "มอบหมาย",
  reminder: "เตือน 1.5 ชม.",
  change: "เปลี่ยนแปลง",
  cancellation: "ยกเลิก",
  daily_summary: "สรุป 07:00",
  admin_report: "รายงาน 17:00",
  unavailable: "แจ้งไม่สะดวก",
  quota_warning: "เตือนโควต้า",
};

export const NOTIF_STATUS_TH: Record<string, string> = {
  queued: "รอส่ง",
  sent: "ส่งแล้ว",
  failed: "ล้มเหลว",
  skipped: "ข้าม",
};
