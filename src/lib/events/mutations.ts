"use server";

import { blockWritesInDemoMode } from "@/lib/demo-guard";
import { kickNotifications } from "@/lib/notifications/kick";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { parseStagedFormValues } from "@/lib/attachments/rules";
import { attachStaged } from "@/lib/attachments/staging";
import { normalizeRoleIds, roleColumns } from "@/lib/assignments/roles";
import { resolveLocationId } from "@/lib/locations/resolve";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function fail(message: string): never {
  redirect(`/events/new?error=${encodeURIComponent(message)}`);
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
  // Several duties for the person (0016); an old form still posts one roleId.
  const roleIds = normalizeRoleIds([...formData.getAll("roleIds"), formData.get("roleId")]);
  const hasAssignee = Boolean(personId && roleIds.length > 0);
  if (personId && roleIds.length === 0) fail("เลือกหน้าที่ของผู้ปฏิบัติงานอย่างน้อย 1 อย่าง");

  let locationId: string | null;
  try {
    locationId = await resolveLocationId(createAdminClient(), {
      locationText: formData.get("locationText"),
      locationId: formData.get("locationId"),
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : "บันทึกสถานที่ไม่สำเร็จ");
  }

  const { data: created, error } = await supabase
    .from("events")
    .insert({
      title,
      event_date: eventDate,
      start_time: startTime,
      end_time: emptyToNull(formData.get("endTime")),
      location_id: locationId,
      owner_department_id: emptyToNull(formData.get("ownerDepartmentId")),
      event_type_id: emptyToNull(formData.get("eventTypeId")),
      intake_channel: emptyToNull(formData.get("intakeChannel")) ?? "อื่นๆ",
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
  if (hasAssignee) {
    const { error: asgError } = await supabase.from("assignments").insert({
      event_id: created.id,
      person_id: personId,
      ...roleColumns(roleIds),
      assignment_status: "assigned",
      assignment_version: 1,
      created_by: user.id,
    });
    if (asgError) fail(`บันทึกผู้รับผิดชอบไม่สำเร็จ: ${asgError.message}`);
  }

  // Files picked in the form's last step were uploaded to staging already;
  // put them on the job before the team's card goes out (the card shows them).
  const staged = parseStagedFormValues(formData.getAll("stagedAttachment"));
  if (staged.length > 0) await attachStaged(createAdminClient(), created.id, staged, user.id);

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

  // Created and published in one go from the 4-step form: tell the assignee
  // now, like publishEvent does. (Before 19 Oct 2026 this path sent nothing.)
  if (publish && hasAssignee) {
    await supabase.rpc("enqueue_event_notifications", { p_event_id: created.id, p_type: "assignment" });
    await supabase.rpc("enqueue_event_reminders", { p_event_id: created.id });
    kickNotifications();
  }

  revalidatePath("/schedule");
  redirect("/schedule");
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
  let locationId: string | null = null;
  try {
    const { data: before } = await supabase.from("events").select("location_id").eq("id", eventId).maybeSingle();
    locationId = await resolveLocationId(createAdminClient(), {
      locationText: formData.get("locationText"),
      locationId: formData.get("locationId"),
      currentId: before?.location_id ?? null,
    });
  } catch (e) {
    redirect(`${editPath}?error=${encodeURIComponent(e instanceof Error ? e.message : "บันทึกสถานที่ไม่สำเร็จ")}`);
  }
  // Optional; shown on the team's orange change card (owner, 22 Oct 2026).
  const changeReason = String(formData.get("changeReason") ?? "").trim().slice(0, 200);

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
    await supabase.rpc("enqueue_event_notifications", {
      p_event_id: eventId,
      p_type: "change",
    });
    // The 1.5-hour reminder was timed off the old start: drop it, queue the new one.
    await supabase.rpc("cancel_event_reminders", { p_event_id: eventId });
    await supabase.rpc("enqueue_event_reminders", { p_event_id: eventId });
    kickNotifications();
  }

  await writeAudit(
    supabase,
    user,
    eventId,
    significant ? "significant_change" : "edit",
    significant
      ? `แก้ไขงาน (เปลี่ยน: ${changed.join(", ")}) — รีเซ็ตการรับทราบ${changeReason ? ` · เหตุผล: ${changeReason}` : ""}`
      : changed.length
        ? `แก้ไขงาน: ${changed.join(", ")}`
        : "แก้ไขรายละเอียดงาน",
    { title, event_date: eventDate, start_time: startTime, changed, ...(changeReason ? { reason: changeReason } : {}) },
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

  const hold = await pendingPostponement(supabase, eventId);

  const { error } = await supabase
    .from("events")
    .update({ status: "published", published_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", eventId);
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  if (hold) {
    // Back from "เลื่อนออกไปก่อน": the team already had the job, so they get an
    // orange change card (old date struck through → new date) and must
    // acknowledge again, instead of a second "new job" card.
    const { data: now } = await supabase
      .from("events")
      .select("title, event_date, start_time, end_time, location_id")
      .eq("id", eventId)
      .maybeSingle();
    await writeAudit(
      supabase,
      user,
      eventId,
      "significant_change",
      `นัดวันใหม่หลังเลื่อน — รีเซ็ตการรับทราบ${hold.editReason ? ` · เหตุผล: ${hold.editReason}` : ""}`,
      { title: now?.title, event_date: now?.event_date, start_time: hhmm(now?.start_time), reason: hold.editReason || "นัดวันใหม่หลังเลื่อน", resumed: true },
      hold.oldValues,
    );
    await bumpAssignmentVersions(supabase, eventId);
    await writeAudit(supabase, user, eventId, "publish", "เผยแพร่งานอีกครั้ง (หลังเลื่อน)", { status: "published", resumed: true });
    await supabase.rpc("enqueue_event_notifications", { p_event_id: eventId, p_type: "change" });
    await supabase.rpc("cancel_event_reminders", { p_event_id: eventId });
    await supabase.rpc("enqueue_event_reminders", { p_event_id: eventId });
    kickNotifications();
    revalidatePath("/schedule");
    revalidatePath(`/events/${eventId}`);
    redirect(`/events/${eventId}`);
  }

  await writeAudit(supabase, user, eventId, "publish", "เผยแพร่งาน", { status: "published" });
  // Queue assignment notifications for assignees (best-effort).
  await supabase.rpc("enqueue_event_notifications", {
    p_event_id: eventId,
    p_type: "assignment",
  });
  // Enqueue advance (24h) and same-day (1.5h) reminders.
  await supabase.rpc("enqueue_event_reminders", {
    p_event_id: eventId,
  });
  kickNotifications();
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

/** Every active assignment's version +1: earlier acknowledgements no longer count. */
async function bumpAssignmentVersions(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string) {
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
}

/**
 * The job was put on hold ("เลื่อนออกไปก่อน") and has not been published since:
 * returns what it looked like when it was put on hold.
 */
async function pendingPostponement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<{ oldValues: Record<string, unknown>; editReason: string } | null> {
  const { data } = await supabase
    .from("audit_logs")
    .select("action, old_values, changed_at")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .in("action", ["postpone", "publish"])
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.action !== "postpone") return null;
  // The reason typed when the new date was set (แก้ไข while on hold) goes on the
  // orange card; without one the card says "นัดวันใหม่หลังเลื่อน".
  const { data: edit } = await supabase
    .from("audit_logs")
    .select("new_values")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .eq("action", "edit")
    .gt("changed_at", data.changed_at)
    .order("changed_at", { ascending: false })
    .limit(5);
  const editReason =
    (edit ?? [])
      .map((r) => String((r.new_values as { reason?: unknown } | null)?.reason ?? "").trim())
      .find((r) => r.length > 0) ?? "";
  return { oldValues: (data.old_values as Record<string, unknown>) ?? {}, editReason };
}

/**
 * Owner, 22 Oct 2026: jobs often move with no new date yet. "เลื่อนออกไปก่อน"
 * puts a published job on hold (status draft: off the TV, off LINE lists and
 * reminders), tells every assignee why, and keeps the team on it. Set the new
 * date with แก้ไข, then เผยแพร่ — the team gets an orange change card.
 */
export async function postponeEvent(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const { supabase, user } = await loadActor();
  if (!can.publishEvent(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์เลื่อนงาน")}`);
  }
  if (!reason) redirect(`/events/${eventId}?error=${encodeURIComponent("กรุณาระบุเหตุผลที่เลื่อน")}`);

  const { data: current } = await supabase
    .from("events")
    .select("title, event_date, start_time, end_time, location_id, status")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!current) redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่พบงาน")}`);
  if (current.status !== "published") {
    redirect(`/events/${eventId}?error=${encodeURIComponent("เลื่อนได้เฉพาะงานที่เผยแพร่แล้ว")}`);
  }

  const { error } = await supabase
    .from("events")
    .update({ status: "draft", has_changes: true, updated_by: user.id })
    .eq("id", eventId);
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  await bumpAssignmentVersions(supabase, eventId);
  await writeAudit(
    supabase,
    user,
    eventId,
    "postpone",
    `เลื่อนออกไปก่อน (ยังไม่มีวันใหม่): ${reason}`,
    { status: "draft", reason },
    {
      title: current.title,
      event_date: current.event_date,
      start_time: hhmm(current.start_time),
      end_time: hhmm(current.end_time),
      location_id: current.location_id,
    },
  );
  await supabase.rpc("cancel_event_reminders", { p_event_id: eventId });
  await supabase.rpc("enqueue_event_notifications", { p_event_id: eventId, p_type: "cancellation" });
  kickNotifications();
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
  kickNotifications();
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
