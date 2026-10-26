// The LINE quota bar (owner, 26 Oct 2026): home page and /settings, admins only.
// What counts: every push the bot sends, one per person who receives it.
// Replies to a tap or a typed command are free and never show up here.
// Pure function, covered by tests/quota-view.unit.test.ts.

import type { Priority } from "@/lib/notifications/budget";

export type QuotaSegment = { key: Priority | "other"; label: string; count: number };

export type QuotaView = {
  monthLabel: string;
  used: number;
  /** null = no cap (paid plan). */
  limit: number | null;
  remaining: number | null;
  /** 0–100, capped. */
  percent: number;
  /** Projected use by month end at this month's pace. */
  forecast: number;
  tone: "ok" | "warn" | "danger";
  segments: QuotaSegment[];
  /** "line" = LINE's own counter, "system" = our count when LINE could not be read. */
  source: "line" | "system";
};

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function quotaView(input: {
  /** Bangkok date, YYYY-MM-DD. */
  date: string;
  /** Our own count of sent pushes this month, by priority. */
  sent: Record<Priority, number>;
  /** Limit from /settings. */
  settingsLimit: number;
  /** LINE's own numbers, when the API answered. */
  line: { limit: number | null; used: number } | null;
}): QuotaView {
  const [y, m, d] = input.date.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const ours = input.sent.critical + input.sent.reminder + input.sent.low;
  const used = input.line ? Math.max(input.line.used, 0) : ours;
  const limit = input.line ? input.line.limit : input.settingsLimit;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const forecast = Math.round((used / Math.max(1, d)) * daysInMonth);

  let tone: QuotaView["tone"] = "ok";
  if (limit !== null) {
    if (used >= limit * 0.9 || forecast > limit) tone = "danger";
    else if (used >= limit * 0.7 || forecast > limit * 0.85) tone = "warn";
  }

  const segments: QuotaSegment[] = [
    { key: "critical", label: "การ์ดงาน", count: input.sent.critical },
    { key: "reminder", label: "เตือนก่อนงาน", count: input.sent.reminder },
    { key: "low", label: "สรุปเช้า/รายงานเย็น", count: input.sent.low },
  ];
  // Pushes LINE counted that PR-OS did not send (e.g. a broadcast from LINE OA Manager).
  if (used > ours) segments.push({ key: "other", label: "ส่งจาก LINE OA Manager", count: used - ours });

  return {
    monthLabel: `${TH_MONTHS[m - 1]} ${y + 543}`,
    used,
    limit,
    remaining,
    percent,
    forecast,
    tone,
    segments,
    source: input.line ? "line" : "system",
  };
}
