"use server";

import { blockWritesInDemoMode } from "@/lib/demo-guard";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function fail(message: string): never {
  redirect(`/events/new?error=${encodeURIComponent(message)}`);
}

/**
 * เลขที่หนังสือ + ลิงก์ e-Office. Only http(s) links are accepted, so a
 * pasted `javascript:` URL can never become a clickable link on the event
 * page (the database enforces the same rule — migration 0014).
 */
function readSource(
  formData: FormData,
): { ok: true; source_reference: string | null; source_url: string | null } | { ok: false; error: string } {
  const reference = emptyToNull(formData.get("sourceReference"));
  const url = emptyToNull(formData.get("sourceUrl"));
  if (reference && reference.length > 200) {
    return { ok: false, error: "เลขที่หนังสือยาวเกิน 200 ตัวอักษร" };
  }
  if (url) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:") || url.length > 500) {
      return { ok: false, error: "ลิงก์ e-Office ต้องขึ้นต้นด้วย https:// หรือ http://" };
    }
  }
  return { ok: true, source_reference: reference, source_url: url };
}

export async function createEvent(formData: FormData) {
  await blockWritesInDemoMode();
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!can.createDraft(user.role)) fail("บัญชีของคุณไม่มีสิทธิ์สร้างงาน");

  const intent = String(formData.get("intent") ?? "draft");
  const publish = intent === "publish";
  if (publish && !can.publishEvent(user.role)) {
    fail("บัญชีของคุณไม่มีสิทธิ์เผยแพร่งาน (ทำได้เฉพาะหัวหน้างาน/ผู้ดูแล)");
  }

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  if (!title || !eventDate || !startTime) {
    fail("กรุณากรอกชื่องาน วันที่ และเวลาเริ่ม");
  }

  const personId = emptyToNull(formData.get("personId"));
  const roleId = emptyToNull(formData.get("roleId"));
  const source = readSource(formData);
  if (!source.ok) fail(source.error);

  const { data: created, error } = await supabase
    .from("events")
    .insert({
      title,
      event_date: eventDate,
      start_time: startTime,
      end_time: emptyToNull(formData.get("endTime")),
      location_id: emptyToNull(formData.get("locationId")),
      owner_department_id: emptyToNull(formData.get("ownerDepartmentId")),
      event_type_id: emptyToNull(formData.get("eventTypeId")),
      intake_channel: emptyToNull(formData.get("intakeChannel")) ?? "อื่นๆ",
      source_reference: source.source_reference,
      source_url: source.source_url,
      urgency: String(formData.get("urgency") ?? "normal"),
      short_note: emptyToNull(formData.get("shortNote")),
      internal_note: emptyToNull(formData.get("internalNote")),
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    fail(error?.message ?? "บันทึกงานไม่สำเร็จ");
  }

  // Optional single assignment (the form currently captures one person + role).
  if (personId && roleId) {
    const { error: asgError } = await supabase.from("assignments").insert({
      event_id: created.id,
      person_id: personId,
      role_id: roleId,
      assignment_status: "assigned",
      assignment_version: 1,
      created_by: user.id,
    });
    if (asgError) fail(`บันทึกผู้รับผิดชอบไม่สำเร็จ: ${asgError.message}`);
  }

  // Audit log — append-only record of the create/publish action.
  await supabase.from("audit_logs").insert({
    entity_type: "event",
    entity_id: created.id,
    action: publish ? "publish" : "create",
    changed_by: user.id,
    summary: `${publish ? "สร้างและเผยแพร่งาน" : "สร้างร่างงาน"}: ${title}`,
    new_values: {
      title,
      event_date: eventDate,
      start_time: startTime,
      status: publish ? "published" : "draft",
    },
  });

  // "บันทึกและเผยแพร่" from the form publishes in one step, so it needs the
  // same queueing as the publish button on the detail page — before this,
  // work published from the form never notified its assignee at all.
  if (publish) await queueOnPublish(supabase, created.id);

  revalidatePath("/schedule");
  redirect("/schedule");
}

/**
 * Notification queueing is best-effort: a failed enqueue must not undo a
 * saved event. It is logged, not swallowed — the reminder function failed
 * on every call from 0012 until 0014 and nobody could tell.
 */
async function queueOnPublish(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
) {
  const assignment = await supabase.rpc("enqueue_event_notifications", {
    p_event_id: eventId,
    p_type: "assignment",
  });
  if (assignment.error) console.error("enqueue_event_notifications", eventId, assignment.error.message);
  await queueReminders(supabase, eventId);
}

async function queueReminders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
) {
  const reminders = await supabase.rpc("enqueue_event_reminders", { p_event_id: eventId });
  if (reminders.error) console.error("enqueue_event_reminders", eventId, reminders.error.message);
}

// --- lifecycle actions (called from the event detail page) -----------------

type Actor = { id: string; role: import("@/lib/auth/roles").AppRole };

async function loadActor() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actor: Actor,
  eventId: string,
  action: string,
  summary: string,
  newValues: Record<string, unknown> = {},
  oldValues: Record<string, unknown> = {},
) {
  await supabase.from("audit_logs").insert({
    entity_type: "event",
    entity_id: eventId,
    action,
    changed_by: actor.id,
    summary,
    new_values: newValues,
    old_values: oldValues,
  });
}

const hhmm = (v: string | null | undefined) => (v ? String(v).slice(0, 5) : null);

export async function editEvent(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const editPath = `/events/${eventId}/edit`;
  const { supabase, user } = await loadActor();
  if (!can.editPublished(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์แก้ไขงาน")}`);
  }

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  if (!title || !eventDate || !startTime) {
    redirect(`${editPath}?error=${encodeURIComponent("กรุณากรอกชื่องาน วันที่ และเวลาเริ่ม")}`);
  }
  const endTime = emptyToNull(formData.get("endTime"));
  const locationId = emptyToNull(formData.get("locationId"));
  const source = readSource(formData);
  if (!source.ok) redirect(`${editPath}?error=${encodeURIComponent(source.error)}`);

  const { data: current, error: loadErr } = await supabase
    .from("events")
    .select("title, event_date, start_time, end_time, location_id, status")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (loadErr || !current) {
    redirect(`${editPath}?error=${encodeURIComponent(loadErr?.message ?? "ไม่พบงาน")}`);
  }

  // Detect significant-field changes (title, date, time, location) per Flow 3.
  const changed: string[] = [];
  if ((current.title ?? "") !== title) changed.push("ชื่องาน");
  if (current.event_date !== eventDate) changed.push("วันที่");
  if (hhmm(current.start_time) !== hhmm(startTime)) changed.push("เวลาเริ่ม");
  if (hhmm(current.end_time) !== hhmm(endTime)) changed.push("เวลาสิ้นสุด");
  if ((current.location_id ?? null) !== (locationId ?? null)) changed.push("สถานที่");

  const significant = current.status === "published" && changed.length > 0;

  const updatePayload: Record<string, unknown> = {
    title,
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    location_id: locationId,
    owner_department_id: emptyToNull(formData.get("ownerDepartmentId")),
    event_type_id: emptyToNull(formData.get("eventTypeId")),
    intake_channel: emptyToNull(formData.get("intakeChannel")) ?? "อื่นๆ",
    source_reference: source.source_reference,
    source_url: source.source_url,
    urgency: String(formData.get("urgency") ?? "normal"),
    short_note: emptyToNull(formData.get("shortNote")),
    internal_note: emptyToNull(formData.get("internalNote")),
    updated_by: user.id,
  };
  if (significant) updatePayload.has_changes = true;

  const { error: upErr } = await supabase.from("events").update(updatePayload).eq("id", eventId);
  if (upErr) redirect(`${editPath}?error=${encodeURIComponent(upErr.message)}`);

  // Significant change on a published event resets acknowledgement: bump each
  // active assignment's version so prior acks no longer match (become pending).
  if (significant) {
    const { data: asgs } = await supabase
      .from("assignments")
      .select("id, assignment_version")
      .eq("event_id", eventId)
      .eq("assignment_status", "assigned");
    for (const a of asgs ?? []) {
      await supabase
        .from("assignments")
        .update({ assignment_version: (a.assignment_version ?? 1) + 1 })
        .eq("id", a.id);
    }
    // Queue change notifications so affected assignees re-acknowledge.
    const change = await supabase.rpc("enqueue_event_notifications", {
      p_event_id: eventId,
      p_type: "change",
    });
    if (change.error) console.error("enqueue_event_notifications", eventId, change.error.message);
    // A new date or time moves the reminders and the supervisor alert with it;
    // the function skips the queued ones that no longer fit (migration 0014).
    await queueReminders(supabase, eventId);
  }

  await writeAudit(
    supabase,
    user,
    eventId,
    significant ? "significant_change" : "edit",
    significant
      ? `แก้ไขงาน (เปลี่ยน: ${changed.join(", ")}) — รีเซ็ตการรับทราบ`
      : changed.length
        ? `แก้ไขงาน: ${changed.join(", ")}`
        : "แก้ไขรายละเอียดงาน",
    { title, event_date: eventDate, start_time: startTime, changed },
    {
      title: current.title,
      event_date: current.event_date,
      start_time: hhmm(current.start_time),
      end_time: hhmm(current.end_time),
      location_id: current.location_id,
    },
  );

  revalidatePath("/schedule");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function publishEvent(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const { supabase, user } = await loadActor();
  if (!can.publishEvent(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์เผยแพร่งาน")}`);
  }

  const { error } = await supabase
    .from("events")
    .update({ status: "published", published_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", eventId);
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  await writeAudit(supabase, user, eventId, "publish", "เผยแพร่งาน", { status: "published" });
  // Assignment notices, the 1.5-hour reminder and the supervisor alert.
  await queueOnPublish(supabase, eventId);
  revalidatePath("/schedule");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function completeEvent(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const { supabase, user } = await loadActor();
  if (!can.publishEvent(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์ปิดงาน")}`);
  }

  const { error } = await supabase
    .from("events")
    .update({ status: "completed", updated_by: user.id })
    .eq("id", eventId);
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  await writeAudit(supabase, user, eventId, "complete", "ปิดงาน (เสร็จสิ้น)", { status: "completed" });
  revalidatePath("/schedule");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function cancelEvent(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const { supabase, user } = await loadActor();
  if (!can.cancelEvent(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์ยกเลิกงาน")}`);
  }
  if (!reason) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("กรุณาระบุเหตุผลการยกเลิก")}`);
  }

  const { error } = await supabase
    .from("events")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      cancellation_reason: reason,
      updated_by: user.id,
    })
    .eq("id", eventId);
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  await writeAudit(supabase, user, eventId, "cancel", `ยกเลิกงาน: ${reason}`, {
    status: "canceled",
    cancellation_reason: reason,
  });
  await supabase.rpc("enqueue_event_notifications", {
    p_event_id: eventId,
    p_type: "cancellation",
  });
  await supabase.rpc("cancel_event_reminders", {
    p_event_id: eventId,
  });
  revalidatePath("/schedule");
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function deleteEvent(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const { supabase, user } = await loadActor();
  // Soft delete is a supervisor/admin action.
  if (!can.cancelEvent(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์ลบงาน")}`);
  }

  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", eventId);
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  await writeAudit(supabase, user, eventId, "delete", "ลบงาน (soft delete)", {});
  revalidatePath("/schedule");
  redirect("/schedule");
}
