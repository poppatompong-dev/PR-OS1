// Create a job from the LINE form (LIFF). Same rows the web form writes:
// event, assignments, audit entry, and, when published, the assignment
// notice plus the 1.5-hour reminder. Runs with the service-role client because
// a LINE-only team member has no web session; the caller was already checked
// in authenticateLiff().
//
// Quota: the form itself costs nothing. Publishing costs one push per
// assignee (the job card), exactly like publishing on the web. The 1.5-hour
// reminder goes out only to whoever has not acknowledged by then. Saving a
// draft sends nothing.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiffCaller } from "@/lib/liff/auth";

export type LiffEventInput = {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  locationId: string | null;
  shortNote: string | null;
  assignees: Array<{ personId: string; roleId: string }>;
  publish: boolean;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const optional = (v: unknown, max: number) => text(v, max) || null;

/** Checks and normalises the JSON body. Returns an error message for the form, or the input. */
export function parseLiffEventInput(body: unknown): { ok: true; input: LiffEventInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = text(b.title, 200);
  const eventDate = text(b.eventDate, 10);
  const startTime = text(b.startTime, 5);
  const endTime = optional(b.endTime, 5);
  if (!title) return { ok: false, error: "กรุณากรอกชื่องาน" };
  if (!DATE.test(eventDate) || Number.isNaN(Date.parse(`${eventDate}T00:00:00Z`))) return { ok: false, error: "วันที่ไม่ถูกต้อง" };
  if (!TIME.test(startTime)) return { ok: false, error: "เวลาเริ่มไม่ถูกต้อง" };
  if (endTime && (!TIME.test(endTime) || endTime <= startTime)) return { ok: false, error: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม" };

  const locationId = optional(b.locationId, 36);
  if (locationId && !UUID.test(locationId)) return { ok: false, error: "สถานที่ไม่ถูกต้อง" };

  const raw = Array.isArray(b.assignees) ? b.assignees.slice(0, 20) : [];
  const seen = new Set<string>();
  const assignees: LiffEventInput["assignees"] = [];
  for (const a of raw as Array<Record<string, unknown>>) {
    const personId = text(a?.personId, 36);
    const roleId = text(a?.roleId, 36);
    if (!personId && !roleId) continue;
    if (!UUID.test(personId)) return { ok: false, error: "เลือกผู้ปฏิบัติงานให้ครบ" };
    if (!UUID.test(roleId)) return { ok: false, error: "เลือกบทบาทของผู้ปฏิบัติงานให้ครบ" };
    const key = `${personId}:${roleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assignees.push({ personId, roleId });
  }

  return {
    ok: true,
    input: {
      title,
      eventDate,
      startTime,
      endTime,
      locationId,
      shortNote: optional(b.shortNote, 500),
      assignees,
      publish: b.publish === true,
    },
  };
}

/** When the 1.5-hour reminder is due, or null when that moment has passed. */
export function sameDayReminderAt(eventDate: string, startTime: string, now = new Date()): Date | null {
  const start = new Date(`${eventDate}T${startTime}:00+07:00`);
  const due = new Date(start.getTime() - 90 * 60 * 1000);
  return due.getTime() > now.getTime() ? due : null;
}

function bangkokMonth(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

export async function createEventFromLiff(
  admin: SupabaseClient,
  caller: LiffCaller,
  input: LiffEventInput,
): Promise<{ ok: true; eventId: string; notified: number } | { ok: false; error: string }> {
  // Only active people and roles from the lists the form showed.
  if (input.assignees.length > 0) {
    const personIds = [...new Set(input.assignees.map((a) => a.personId))];
    const roleIds = [...new Set(input.assignees.map((a) => a.roleId))];
    const [{ data: people }, { data: roles }] = await Promise.all([
      admin.from("people").select("id").in("id", personIds).eq("is_active", true),
      admin.from("roles").select("id").in("id", roleIds).eq("is_active", true),
    ]);
    if ((people ?? []).length !== personIds.length) return { ok: false, error: "มีผู้ปฏิบัติงานที่ไม่อยู่ในทีมแล้ว ลองเปิดฟอร์มใหม่" };
    if ((roles ?? []).length !== roleIds.length) return { ok: false, error: "มีบทบาทที่ถูกปิดไปแล้ว ลองเปิดฟอร์มใหม่" };
  }

  const nowIso = new Date().toISOString();
  const { data: created, error } = await admin
    .from("events")
    .insert({
      title: input.title,
      event_date: input.eventDate,
      start_time: input.startTime,
      end_time: input.endTime,
      location_id: input.locationId,
      intake_channel: "อื่นๆ", // the edit page offers only its fixed list; "via LINE" is in metadata
      urgency: "normal",
      short_note: input.shortNote,
      status: input.publish ? "published" : "draft",
      published_at: input.publish ? nowIso : null,
      created_by: caller.userId,
      updated_by: caller.userId,
      metadata: { created_via: "line", created_by_person_id: caller.personId },
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: `บันทึกงานไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}` };

  let assignmentIds: Array<{ id: string; person_id: string }> = [];
  if (input.assignees.length > 0) {
    const { data: rows, error: asgError } = await admin
      .from("assignments")
      .insert(
        input.assignees.map((a) => ({
          event_id: created.id,
          person_id: a.personId,
          role_id: a.roleId,
          assignment_status: "assigned",
          assignment_version: 1,
          created_by: caller.userId,
        })),
      )
      .select("id, person_id");
    if (asgError) return { ok: false, error: `บันทึกงานแล้ว แต่บันทึกผู้ปฏิบัติงานไม่สำเร็จ: ${asgError.message}` };
    assignmentIds = rows ?? [];
  }

  await admin.from("audit_logs").insert({
    entity_type: "event",
    entity_id: created.id,
    action: input.publish ? "publish" : "create",
    changed_by: caller.userId,
    summary: `${input.publish ? "สร้างและเผยแพร่งาน" : "สร้างร่างงาน"} ผ่าน LINE โดย ${caller.displayName}: ${input.title}`,
    new_values: {
      title: input.title,
      event_date: input.eventDate,
      start_time: input.startTime,
      status: input.publish ? "published" : "draft",
      assignees: input.assignees.length,
      via: "line",
    },
  });

  if (!input.publish || assignmentIds.length === 0) return { ok: true, eventId: created.id, notified: 0 };

  // Same rows enqueue_event_notifications / enqueue_event_reminders would add
  // (those RPCs need a web session's role, which a LINE caller does not have).
  const month = bangkokMonth();
  const rows: Array<Record<string, unknown>> = assignmentIds.map((a) => ({
    event_id: created.id,
    assignment_id: a.id,
    person_id: a.person_id,
    channel: "line",
    notification_type: "assignment",
    scheduled_for: nowIso,
    status: "queued",
    quota_month: month,
  }));

  const { data: setting } = await admin.from("settings").select("value").eq("key", "same_day_reminder_enabled").maybeSingle();
  const sameDayOn = setting?.value === undefined || setting?.value === null ? true : String(setting.value) === "true";
  const due = sameDayOn ? sameDayReminderAt(input.eventDate, input.startTime) : null;
  if (due) {
    for (const a of assignmentIds) {
      rows.push({
        event_id: created.id,
        assignment_id: a.id,
        person_id: a.person_id,
        channel: "line",
        notification_type: "reminder",
        scheduled_for: due.toISOString(),
        status: "queued",
        quota_month: month,
      });
    }
  }
  const { error: qError } = await admin.from("notifications").insert(rows);
  if (qError) return { ok: false, error: `บันทึกงานแล้ว แต่ตั้งคิวแจ้งเตือนไม่สำเร็จ: ${qError.message}` };

  return { ok: true, eventId: created.id, notified: assignmentIds.length };
}
