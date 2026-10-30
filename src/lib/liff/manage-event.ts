// Manage jobs from the phone (owner, 30 Oct 2026: "ต้อง crud รายการงานได้ เห็นชัด
// ใช้ง่าย" — พี่เอิร์ธ gives out work from his phone and could not change a job
// after sending it). The same Mini App / LIFF that adds a job now lists the
// jobs, edits one, publishes a draft, puts a job on hold, cancels it, or
// deletes a draft — inside Telegram or LINE, no web login.
//
// Same effects as the web (src/lib/events/mutations.ts + assignments/mutations.ts):
// a changed date / time / place / title resets acknowledgement and sends the
// orange change card; a person added gets the job card; a person taken off
// gets "ถอนชื่อ"; a cancelled job tells everyone. Runs with the service-role
// client because a phone caller has no web session — the caller was checked
// in authenticateLiff() and here in canManage().

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiffCaller } from "@/lib/liff/auth";
import type { LiffEventInput } from "@/lib/liff/create-event";
import { sameDayReminderAt } from "@/lib/liff/create-event";
import { normalizeRoleIds, roleColumns, sameRoles } from "@/lib/assignments/roles";
import { resolveLocationId } from "@/lib/locations/resolve";
import { attachStaged, countEventAttachments } from "@/lib/attachments/staging";
import { createAnnouncement } from "@/lib/announcements";
import { jobIcon } from "@/lib/events/job-icon";

type Admin = SupabaseClient;
export type ManageRole = "admin" | "supervisor" | "staff" | "assignee" | "display" | null;

/** Web roles that edit any job (same as can.editPublished). Others: only jobs they created. */
const TEAM_ROLES = new Set(["admin", "supervisor", "staff"]);

export function canManage(role: ManageRole, caller: { personId: string; userId: string | null }, ev: { created_by: string | null; metadata: unknown }): boolean {
  if (role && TEAM_ROLES.has(role)) return true;
  const meta = (ev.metadata ?? {}) as { created_by_person_id?: unknown };
  if (meta.created_by_person_id && meta.created_by_person_id === caller.personId) return true;
  return Boolean(caller.userId && ev.created_by === caller.userId);
}

export async function callerRole(admin: Admin, caller: LiffCaller): Promise<ManageRole> {
  if (!caller.userId) return null;
  const { data } = await admin.from("profiles").select("role").eq("id", caller.userId).maybeSingle();
  return (data?.role as ManageRole) ?? null;
}

const hhmm = (v: string | null | undefined) => (v ? String(v).slice(0, 5) : "");

function bangkokToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function bangkokMonth(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

// --- pure: what changed --------------------------------------------------

export type AssigneeRow = { personId: string; roleIds: string[] };
export type CurrentAssignment = { id: string; personId: string; roleIds: string[] };

/** Who is added, who is taken off, whose duties changed. Pure; tests/liff-manage.unit.test.ts. */
export function planAssignees<C extends CurrentAssignment>(current: C[], next: AssigneeRow[]) {
  const nextBy = new Map(next.map((r) => [r.personId, normalizeRoleIds(r.roleIds)]));
  const curBy = new Map(current.map((c) => [c.personId, c]));
  const added = next.filter((r) => !curBy.has(r.personId));
  const removed = current.filter((c) => !nextBy.has(c.personId));
  const changed = current
    .filter((c) => nextBy.has(c.personId) && !sameRoles(normalizeRoleIds(c.roleIds), nextBy.get(c.personId)!))
    .map((c) => ({ ...c, newRoleIds: nextBy.get(c.personId)! }));
  return { added, removed, changed };
}

/** The fields whose change resets acknowledgement (web: editEvent "significant"). */
export function significantFields(
  before: { title: string | null; event_date: string; start_time: string | null; end_time: string | null; location_id: string | null },
  after: { title: string; eventDate: string; startTime: string; endTime: string | null; locationId: string | null },
): string[] {
  const out: string[] = [];
  if ((before.title ?? "") !== after.title) out.push("ชื่องาน");
  if (before.event_date !== after.eventDate) out.push("วันที่");
  if (hhmm(before.start_time) !== hhmm(after.startTime)) out.push("เวลาเริ่ม");
  if (hhmm(before.end_time) !== hhmm(after.endTime)) out.push("เวลาสิ้นสุด");
  if ((before.location_id ?? null) !== (after.locationId ?? null)) out.push("สถานที่");
  return out;
}

// --- queue helpers (service-role twins of the SQL functions in 0014) -------

async function queue(admin: Admin, eventId: string, type: "assignment" | "change" | "cancellation", only?: string[]) {
  let q = admin.from("assignments").select("id, person_id").eq("event_id", eventId).eq("assignment_status", "assigned");
  if (only) {
    if (only.length === 0) return 0;
    q = q.in("id", only);
  }
  const { data: asgs } = await q;
  const list = asgs ?? [];
  if (list.length === 0) return 0;
  // Like enqueue_event_notifications: no second queued row of the same kind,
  // and a person never gets the "new job" card twice.
  const { data: existing } = await admin
    .from("notifications")
    .select("assignment_id, status")
    .eq("event_id", eventId)
    .eq("notification_type", type)
    .in("status", type === "assignment" ? ["queued", "sent"] : ["queued"]);
  const skip = new Set((existing ?? []).map((n) => n.assignment_id as string));
  const now = new Date().toISOString();
  const rows = list
    .filter((a) => !skip.has(a.id))
    .map((a) => ({
      event_id: eventId,
      assignment_id: a.id,
      person_id: a.person_id,
      channel: "line", // the sender picks Telegram when the person linked it
      notification_type: type,
      scheduled_for: now,
      status: "queued",
      quota_month: bangkokMonth(),
    }));
  if (rows.length) await admin.from("notifications").insert(rows);
  return rows.length;
}

async function cancelReminders(admin: Admin, eventId: string) {
  await admin
    .from("notifications")
    .update({ status: "skipped", error_message: "งานถูกยกเลิกหรือเปลี่ยนเวลา: ยกเลิกการเตือนรอบเดิม" })
    .eq("event_id", eventId)
    .eq("status", "queued")
    .eq("notification_type", "reminder");
}

async function queueReminders(admin: Admin, eventId: string) {
  const { data: ev } = await admin.from("events").select("event_date, start_time, status, deleted_at").eq("id", eventId).maybeSingle();
  if (!ev || ev.status !== "published" || ev.deleted_at) return;
  const { data: setting } = await admin.from("settings").select("value").eq("key", "same_day_reminder_enabled").maybeSingle();
  const on = setting?.value === undefined || setting?.value === null ? true : String(setting.value) === "true";
  const due = on ? sameDayReminderAt(ev.event_date, hhmm(ev.start_time) || "09:00") : null;
  if (!due) return;
  const { data: asgs } = await admin.from("assignments").select("id, person_id").eq("event_id", eventId).eq("assignment_status", "assigned");
  const { data: existing } = await admin
    .from("notifications")
    .select("assignment_id")
    .eq("event_id", eventId)
    .eq("notification_type", "reminder")
    .eq("scheduled_for", due.toISOString())
    .in("status", ["queued", "sent"]);
  const skip = new Set((existing ?? []).map((n) => n.assignment_id as string));
  const rows = (asgs ?? [])
    .filter((a) => !skip.has(a.id))
    .map((a) => ({
      event_id: eventId,
      assignment_id: a.id,
      person_id: a.person_id,
      channel: "line",
      notification_type: "reminder",
      scheduled_for: due.toISOString(),
      status: "queued",
      quota_month: bangkokMonth(),
    }));
  if (rows.length) await admin.from("notifications").insert(rows);
}

async function bumpVersions(admin: Admin, eventId: string, only?: string[]) {
  let q = admin.from("assignments").select("id, assignment_version").eq("event_id", eventId).eq("assignment_status", "assigned");
  if (only) q = q.in("id", only);
  const { data } = await q;
  for (const a of data ?? []) {
    await admin.from("assignments").update({ assignment_version: (a.assignment_version ?? 1) + 1 }).eq("id", a.id);
  }
}

async function audit(
  admin: Admin,
  caller: LiffCaller,
  eventId: string,
  action: string,
  summary: string,
  newValues: Record<string, unknown> = {},
  oldValues: Record<string, unknown> = {},
) {
  await admin.from("audit_logs").insert({
    entity_type: "event",
    entity_id: eventId,
    action,
    changed_by: caller.userId,
    summary: `${summary} · ทางมือถือ โดย ${caller.displayName}`,
    new_values: { ...newValues, via: "app" },
    old_values: oldValues,
  });
}

// --- read ----------------------------------------------------------------

export type JobListItem = {
  id: string;
  title: string;
  icon: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  place: string | null;
  status: "draft" | "published" | "canceled" | "completed";
  onHold: boolean;
  hasChanges: boolean;
  people: Array<{ name: string; ack: boolean; unavailable: boolean }>;
  mine: boolean;
  canManage: boolean;
};

/** Jobs from yesterday to 60 days ahead (drafts included), newest work first. */
export async function listJobs(admin: Admin, caller: LiffCaller): Promise<JobListItem[]> {
  const role = await callerRole(admin, caller);
  const today = bangkokToday();
  const { data: events } = await admin
    .from("events")
    .select("id, title, icon, event_date, start_time, end_time, status, has_changes, created_by, metadata, location:locations(name)")
    .is("deleted_at", null)
    .in("status", ["draft", "published", "canceled"])
    .gte("event_date", addDays(today, -1))
    .lte("event_date", addDays(today, 60))
    .order("event_date")
    .order("start_time")
    .limit(150);
  const ids = (events ?? []).map((e) => e.id);
  const [{ data: asgs }, { data: holds }] = await Promise.all([
    ids.length
      ? admin
          .from("assignments")
          .select("id, event_id, assignment_version, unavailable_at, person:people(display_name)")
          .in("event_id", ids)
          .eq("assignment_status", "assigned")
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? admin.from("audit_logs").select("entity_id, action, changed_at").eq("entity_type", "event").in("entity_id", ids).in("action", ["postpone", "publish"]).order("changed_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const asgIds = (asgs ?? []).map((a) => a.id);
  const { data: acks } = asgIds.length
    ? await admin.from("v_assignment_ack_status").select("assignment_id, ack_status").in("assignment_id", asgIds)
    : { data: [] as Array<{ assignment_id: string; ack_status: string }> };
  const acked = new Set((acks ?? []).filter((a) => a.ack_status === "acknowledged").map((a) => a.assignment_id));
  const lastHold = new Map<string, string>();
  for (const h of holds ?? []) if (!lastHold.has(h.entity_id)) lastHold.set(h.entity_id, h.action);

  return (events ?? []).map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loc = Array.isArray((e as any).location) ? (e as any).location[0] : (e as any).location;
    const meta = (e.metadata ?? {}) as { created_by_person_id?: string };
    const people = (asgs ?? [])
      .filter((a) => a.event_id === e.id)
      .map((a) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = Array.isArray((a as any).person) ? (a as any).person[0] : (a as any).person;
        return { name: String(p?.display_name ?? "—"), ack: acked.has(a.id), unavailable: Boolean(a.unavailable_at) };
      });
    return {
      id: e.id,
      title: e.title,
      icon: jobIcon(e.title, e.icon).emoji,
      eventDate: e.event_date,
      startTime: hhmm(e.start_time),
      endTime: e.end_time ? hhmm(e.end_time) : null,
      place: loc?.name ?? null,
      status: e.status,
      onHold: e.status === "draft" && lastHold.get(e.id) === "postpone",
      hasChanges: Boolean(e.has_changes),
      people,
      mine: meta.created_by_person_id === caller.personId || Boolean(caller.userId && e.created_by === caller.userId),
      canManage: canManage(role, caller, e),
    } as JobListItem;
  });
}

export type JobDetail = {
  id: string;
  status: string;
  onHold: boolean;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  place: string;
  shortNote: string;
  screenTitle: string;
  icon: string;
  assignees: AssigneeRow[];
  attachmentCount: number;
};

async function loadManageable(admin: Admin, caller: LiffCaller, eventId: string) {
  const { data: ev } = await admin
    .from("events")
    .select("id, title, event_date, start_time, end_time, location_id, status, short_note, screen_title, icon, created_by, metadata, deleted_at, location:locations(name)")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.deleted_at) return { ok: false as const, status: 404, error: "ไม่พบงานนี้ (อาจถูกลบไปแล้ว)" };
  const role = await callerRole(admin, caller);
  if (!canManage(role, caller, ev)) return { ok: false as const, status: 403, error: "แก้ได้เฉพาะงานที่คุณสั่งเอง · งานอื่นแจ้งแอดมิน" };
  return { ok: true as const, ev };
}

async function onHold(admin: Admin, eventId: string): Promise<{ oldValues: Record<string, unknown> } | null> {
  const { data } = await admin
    .from("audit_logs")
    .select("action, old_values")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .in("action", ["postpone", "publish"])
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.action === "postpone" ? { oldValues: (data.old_values as Record<string, unknown>) ?? {} } : null;
}

export async function getJob(admin: Admin, caller: LiffCaller, eventId: string): Promise<{ ok: true; job: JobDetail } | { ok: false; status: number; error: string }> {
  const r = await loadManageable(admin, caller, eventId);
  if (!r.ok) return r;
  const ev = r.ev;
  const { data: asgs } = await admin
    .from("assignments")
    .select("person_id, role_id, extra_role_ids")
    .eq("event_id", eventId)
    .eq("assignment_status", "assigned")
    .order("created_at");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loc = Array.isArray((ev as any).location) ? (ev as any).location[0] : (ev as any).location;
  return {
    ok: true,
    job: {
      id: ev.id,
      status: ev.status,
      onHold: ev.status === "draft" && Boolean(await onHold(admin, eventId)),
      title: ev.title ?? "",
      eventDate: ev.event_date,
      startTime: hhmm(ev.start_time),
      endTime: ev.end_time ? hhmm(ev.end_time) : null,
      place: loc?.name ?? "",
      shortNote: ev.short_note ?? "",
      screenTitle: ev.screen_title ?? "",
      icon: ev.icon ?? "",
      assignees: (asgs ?? []).map((a) => ({ personId: a.person_id, roleIds: normalizeRoleIds([a.role_id, ...(a.extra_role_ids ?? [])]) })),
      attachmentCount: await countEventAttachments(admin, eventId),
    },
  };
}

// --- update --------------------------------------------------------------

export type EditResult = { ok: true; notified: number; published: boolean; changed: string[] } | { ok: false; status: number; error: string };

/** Save the form over an existing job. `input.publish` on a draft publishes it. */
export async function editJob(admin: Admin, caller: LiffCaller, eventId: string, input: LiffEventInput, reason: string): Promise<EditResult> {
  const r = await loadManageable(admin, caller, eventId);
  if (!r.ok) return r;
  const ev = r.ev;
  if (ev.status !== "draft" && ev.status !== "published") return { ok: false, status: 409, error: "งานนี้ยกเลิก/ปิดไปแล้ว แก้ไม่ได้" };

  if (input.assignees.length > 0) {
    const personIds = [...new Set(input.assignees.map((a) => a.personId))];
    const roleIds = [...new Set(input.assignees.flatMap((a) => a.roleIds))];
    const [{ data: people }, { data: roles }] = await Promise.all([
      admin.from("people").select("id").in("id", personIds).eq("is_active", true),
      admin.from("roles").select("id").in("id", roleIds).eq("is_active", true),
    ]);
    if ((people ?? []).length !== personIds.length) return { ok: false, status: 400, error: "มีผู้ปฏิบัติงานที่ไม่อยู่ในทีมแล้ว ลองเปิดฟอร์มใหม่" };
    if ((roles ?? []).length !== roleIds.length) return { ok: false, status: 400, error: "มีบทบาทที่ถูกปิดไปแล้ว ลองเปิดฟอร์มใหม่" };
  }

  let locationId: string | null;
  try {
    locationId = await resolveLocationId(admin, { locationText: input.locationText, locationId: input.locationId, currentId: ev.location_id ?? null });
  } catch (e) {
    return { ok: false, status: 400, error: e instanceof Error ? e.message : "บันทึกสถานที่ไม่สำเร็จ" };
  }

  const wasPublished = ev.status === "published";
  const changed = significantFields(ev, { ...input, locationId });
  const significant = wasPublished && changed.length > 0;
  const oldValues = {
    title: ev.title,
    event_date: ev.event_date,
    start_time: hhmm(ev.start_time),
    end_time: hhmm(ev.end_time),
    location_id: ev.location_id,
  };

  const publishNow = !wasPublished && input.publish;
  const hold = publishNow ? await onHold(admin, eventId) : null;
  const nowIso = new Date().toISOString();
  const { error: upErr } = await admin
    .from("events")
    .update({
      title: input.title,
      event_date: input.eventDate,
      start_time: input.startTime,
      end_time: input.endTime,
      location_id: locationId,
      short_note: input.shortNote,
      screen_title: input.screenTitle,
      icon: input.icon,
      updated_by: caller.userId,
      ...(significant ? { has_changes: true } : {}),
      ...(publishNow ? { status: "published", published_at: nowIso } : {}),
    })
    .eq("id", eventId);
  if (upErr) return { ok: false, status: 500, error: `บันทึกไม่สำเร็จ: ${upErr.message}` };

  // People: added / taken off / duties changed.
  const { data: cur } = await admin
    .from("assignments")
    .select("id, person_id, role_id, extra_role_ids, role_names")
    .eq("event_id", eventId)
    .eq("assignment_status", "assigned");
  const current = (cur ?? []).map((a) => ({ id: a.id, personId: a.person_id, roleIds: normalizeRoleIds([a.role_id, ...(a.extra_role_ids ?? [])]), roleNames: a.role_names as string | null }));
  const plan = planAssignees(current, input.assignees);

  let addedIds: string[] = [];
  if (plan.added.length) {
    const { data: rows, error } = await admin
      .from("assignments")
      .insert(
        plan.added.map((a) => ({
          event_id: eventId,
          person_id: a.personId,
          ...roleColumns(a.roleIds),
          assignment_status: "assigned",
          assignment_version: 1,
          created_by: caller.userId,
        })),
      )
      .select("id");
    if (error) return { ok: false, status: 500, error: `บันทึกงานแล้ว แต่เพิ่มผู้ปฏิบัติงานไม่สำเร็จ: ${error.message}` };
    addedIds = (rows ?? []).map((x) => x.id);
    await audit(admin, caller, eventId, "assign", `เพิ่มผู้รับผิดชอบ ${plan.added.length} คน`, { person_ids: plan.added.map((a) => a.personId) });
  }
  for (const c of plan.removed) {
    await admin.from("assignments").update({ assignment_status: "removed", removed_at: nowIso }).eq("id", c.id);
    await admin
      .from("notifications")
      .update({ status: "skipped", sent_at: nowIso, error_message: "นำชื่อออกจากงานแล้ว" })
      .eq("assignment_id", c.id)
      .eq("status", "queued");
    await audit(admin, caller, eventId, "unassign", "นำผู้รับผิดชอบออก", { assignment_id: c.id });
  }
  const roleChangedIds: string[] = [];
  for (const c of plan.changed) {
    const { data: upd } = await admin.from("assignments").update(roleColumns(c.newRoleIds)).eq("id", c.id).select("role_names").single();
    roleChangedIds.push(c.id);
    // Before the job-change row, so a job edit in the same save is what the card shows.
    await audit(
      admin,
      caller,
      eventId,
      "roles_change",
      `เปลี่ยนหน้าที่: ${c.roleNames ?? "—"} → ${upd?.role_names ?? "—"}`,
      { assignment_id: c.id, role_ids: c.newRoleIds, role_names: upd?.role_names ?? null },
      { role_ids: c.roleIds, role_names: c.roleNames },
    );
  }

  if (input.attachments.length) await attachStaged(admin, eventId, input.attachments, caller.userId);
  if (input.announce) {
    await createAnnouncement(admin, { text: input.announce, personId: caller.personId, authorName: caller.displayName, source: "event_form", eventId });
  }

  let notified = 0;
  if (wasPublished) {
    for (const c of plan.removed) {
      await admin.from("notifications").insert({
        event_id: eventId,
        assignment_id: c.id,
        person_id: c.personId,
        channel: "line",
        notification_type: "cancellation", // worded "ถอนชื่อออกจากงาน" by the sender
        scheduled_for: nowIso,
        status: "queued",
        quota_month: bangkokMonth(),
      });
      notified += 1;
    }
    if (significant) {
      await bumpVersions(admin, eventId, current.filter((c) => !plan.removed.some((x) => x.id === c.id)).map((c) => c.id));
      await audit(
        admin,
        caller,
        eventId,
        "significant_change",
        `แก้ไขงาน (เปลี่ยน: ${changed.join(", ")}) — รีเซ็ตการรับทราบ${reason ? ` · เหตุผล: ${reason}` : ""}`,
        { title: input.title, event_date: input.eventDate, start_time: input.startTime, changed, ...(reason ? { reason } : {}) },
        oldValues,
      );
      notified += await queue(admin, eventId, "change", current.filter((c) => !plan.removed.some((x) => x.id === c.id)).map((c) => c.id));
      await cancelReminders(admin, eventId);
    } else {
      if (roleChangedIds.length) {
        await bumpVersions(admin, eventId, roleChangedIds);
        notified += await queue(admin, eventId, "change", roleChangedIds);
      }
      await audit(admin, caller, eventId, "edit", changed.length ? `แก้ไขงาน: ${changed.join(", ")}` : "แก้ไขรายละเอียดงาน", { ...(reason ? { reason } : {}) });
    }
    if (addedIds.length) notified += await queue(admin, eventId, "assignment", addedIds);
    await queueReminders(admin, eventId);
  } else {
    await audit(admin, caller, eventId, "edit", changed.length ? `แก้ไขร่าง: ${changed.join(", ")}` : "แก้ไขร่างงาน", { ...(reason ? { reason } : {}) });
    if (publishNow) {
      if (hold) {
        // Back from "เลื่อนออกไปก่อน": the team had the job → orange change card.
        await audit(
          admin,
          caller,
          eventId,
          "significant_change",
          `นัดวันใหม่หลังเลื่อน — รีเซ็ตการรับทราบ${reason ? ` · เหตุผล: ${reason}` : ""}`,
          { title: input.title, event_date: input.eventDate, start_time: input.startTime, reason: reason || "นัดวันใหม่หลังเลื่อน", resumed: true },
          hold.oldValues,
        );
        await bumpVersions(admin, eventId);
        await audit(admin, caller, eventId, "publish", "เผยแพร่งานอีกครั้ง (หลังเลื่อน)", { status: "published", resumed: true });
        notified += await queue(admin, eventId, "change");
        // Someone added while on hold never had the job: new-job card.
        if (addedIds.length) notified += await queue(admin, eventId, "assignment", addedIds);
      } else {
        await audit(admin, caller, eventId, "publish", "เผยแพร่งาน", { status: "published" });
        notified += await queue(admin, eventId, "assignment");
      }
      await cancelReminders(admin, eventId);
      await queueReminders(admin, eventId);
    }
  }
  return { ok: true, notified, published: wasPublished || publishNow, changed };
}

// --- one-tap actions -----------------------------------------------------

export type JobAction = "publish" | "postpone" | "cancel" | "delete";

export async function jobAction(
  admin: Admin,
  caller: LiffCaller,
  eventId: string,
  action: JobAction,
  reasonRaw: string,
): Promise<{ ok: true; notified: number; message: string } | { ok: false; status: number; error: string }> {
  const r = await loadManageable(admin, caller, eventId);
  if (!r.ok) return r;
  const ev = r.ev;
  const reason = reasonRaw.trim().slice(0, 200);
  const nowIso = new Date().toISOString();

  if (action === "publish") {
    if (ev.status !== "draft") return { ok: false, status: 409, error: "เผยแพร่ได้เฉพาะงานร่าง" };
    const hold = await onHold(admin, eventId);
    await admin.from("events").update({ status: "published", published_at: nowIso, updated_by: caller.userId }).eq("id", eventId);
    let notified: number;
    if (hold) {
      await audit(admin, caller, eventId, "significant_change", "นัดวันใหม่หลังเลื่อน — รีเซ็ตการรับทราบ", { reason: "นัดวันใหม่หลังเลื่อน", resumed: true }, hold.oldValues);
      await bumpVersions(admin, eventId);
      await audit(admin, caller, eventId, "publish", "เผยแพร่งานอีกครั้ง (หลังเลื่อน)", { status: "published", resumed: true });
      notified = await queue(admin, eventId, "change");
    } else {
      await audit(admin, caller, eventId, "publish", "เผยแพร่งาน", { status: "published" });
      notified = await queue(admin, eventId, "assignment");
    }
    await queueReminders(admin, eventId);
    return { ok: true, notified, message: notified ? `เผยแพร่แล้ว · แจ้ง ${notified} คน` : "เผยแพร่แล้ว" };
  }

  if (action === "postpone") {
    if (ev.status !== "published") return { ok: false, status: 409, error: "เลื่อนได้เฉพาะงานที่เผยแพร่แล้ว" };
    if (!reason) return { ok: false, status: 400, error: "กรุณาระบุเหตุผลที่เลื่อน" };
    await admin.from("events").update({ status: "draft", has_changes: true, updated_by: caller.userId }).eq("id", eventId);
    await bumpVersions(admin, eventId);
    await audit(
      admin,
      caller,
      eventId,
      "postpone",
      `เลื่อนออกไปก่อน (ยังไม่มีวันใหม่): ${reason}`,
      { status: "draft", reason },
      { title: ev.title, event_date: ev.event_date, start_time: hhmm(ev.start_time), end_time: hhmm(ev.end_time), location_id: ev.location_id },
    );
    await cancelReminders(admin, eventId);
    const notified = await queue(admin, eventId, "cancellation");
    return { ok: true, notified, message: `เลื่อนออกไปก่อนแล้ว · แจ้ง ${notified} คน` };
  }

  if (action === "cancel") {
    if (ev.status !== "published" && ev.status !== "draft") return { ok: false, status: 409, error: "งานนี้ยกเลิก/ปิดไปแล้ว" };
    if (!reason) return { ok: false, status: 400, error: "กรุณาระบุเหตุผลการยกเลิก" };
    const reachedTeam = ev.status === "published" || Boolean(await onHold(admin, eventId));
    await admin.from("events").update({ status: "canceled", canceled_at: nowIso, cancellation_reason: reason, updated_by: caller.userId }).eq("id", eventId);
    await audit(admin, caller, eventId, "cancel", `ยกเลิกงาน: ${reason}`, { status: "canceled", cancellation_reason: reason });
    await cancelReminders(admin, eventId);
    const notified = reachedTeam ? await queue(admin, eventId, "cancellation") : 0;
    return { ok: true, notified, message: notified ? `ยกเลิกแล้ว · แจ้ง ${notified} คน` : "ยกเลิกแล้ว" };
  }

  // delete: drafts that never reached the team. A published job is cancelled instead, so nobody turns up.
  if (ev.status !== "draft" || (await onHold(admin, eventId))) {
    return { ok: false, status: 409, error: "ลบได้เฉพาะงานร่าง · งานที่แจ้งทีมแล้วให้กด ยกเลิกงาน" };
  }
  await admin.from("events").update({ deleted_at: nowIso, updated_by: caller.userId }).eq("id", eventId);
  await admin.from("notifications").update({ status: "skipped", error_message: "ลบงานแล้ว" }).eq("event_id", eventId).eq("status", "queued");
  await audit(admin, caller, eventId, "delete", "ลบงานร่าง", {});
  return { ok: true, notified: 0, message: "ลบร่างแล้ว" };
}
