// What changed on a job, as "old → new" per field, for the LINE change card
// (owner-approved design, 21 Oct 2026: "ใบนี้แทนใบก่อนหน้า", old value struck
// through, new value in bold). Old values come from the audit row that the
// web edit writes (events/mutations.ts → old_values); new values are the job
// as it is now, so a field changed twice still shows the latest value.

import { formatThaiDate } from "@/lib/format";
import type { TaskItem } from "@/lib/line/data";

export type ChangeField = "title" | "date" | "start" | "end" | "location";

export type FieldChange = { field: ChangeField; label: string; from: string; to: string };

/** old_values as stored by editEvent. location_name is filled in by the caller. */
export type OldEventValues = {
  title?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location_id?: string | null;
  location_name?: string | null;
};

const hhmm = (v: string | null | undefined) => (v ? String(v).slice(0, 5) : "");

export function diffEvent(old: OldEventValues | null | undefined, t: TaskItem): FieldChange[] {
  if (!old) return [];
  const out: FieldChange[] = [];
  const norm = (v: string) => (v === "—" ? "" : v.trim());
  const add = (field: ChangeField, label: string, rawFrom: string, rawTo: string) => {
    const from = norm(rawFrom);
    const to = norm(rawTo);
    if (from !== to) out.push({ field, label, from: from || "ไม่ระบุ", to: to || "ไม่ระบุ" });
  };
  if (old.title !== undefined) add("title", "ชื่องาน", old.title ?? "", t.event.title);
  if (old.event_date) add("date", "วันที่", formatThaiDate(old.event_date), formatThaiDate(t.event.eventDate));
  if (old.start_time !== undefined) add("start", "เวลาเริ่ม", hhmm(old.start_time), hhmm(t.event.startTime));
  if (old.end_time !== undefined) add("end", "เวลาสิ้นสุด", hhmm(old.end_time), hhmm(t.event.endTime));
  if (old.location_name !== undefined) add("location", "สถานที่", old.location_name ?? "", t.event.locationName);
  return out;
}

/** The acknowledge button says what is being acknowledged (≤ 20 characters). */
export function ackLabelFor(changes: FieldChange[]): string {
  const f = new Set(changes.map((c) => c.field));
  if (f.size === 0) return "รับทราบงานที่แก้";
  if (f.has("date")) return "รับทราบวันใหม่";
  if (f.has("start") || f.has("end")) return f.has("location") ? "รับทราบงานที่แก้" : "รับทราบเวลาใหม่";
  if (f.has("location")) return "รับทราบสถานที่ใหม่";
  return "รับทราบงานที่แก้";
}
