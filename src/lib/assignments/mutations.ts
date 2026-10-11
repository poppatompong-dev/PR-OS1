"use server";

import { blockWritesInDemoMode } from "@/lib/demo-guard";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";

type AckResult = { ok: true } | { ok: false; error: string };

/**
 * The write itself, with no navigation in it. Both entry points below share
 * it: the form posts and redirects, the offline queue replays and reads the
 * result without moving the page the user is looking at.
 */
async function recordAcknowledgement(
  assignmentId: string,
  version: number,
): Promise<AckResult> {
  if (!isSupabaseConfigured()) {
    // Demo mode. Say so rather than bouncing the demo to a login screen,
    // and do not pretend a row was written.
    return { ok: false, error: "โหมดตัวอย่าง: ยังไม่ได้เชื่อมฐานข้อมูล จึงยังบันทึกการรับทราบไม่ได้" };
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { ok: false, error: "unauthenticated" };
  if (!user.personId) {
    return { ok: false, error: "บัญชีนี้ยังไม่ได้ผูกกับรายชื่อบุคลากร" };
  }

  const { error } = await supabase.from("acknowledgements").insert({
    assignment_id: assignmentId,
    assignment_version: version,
    acknowledged_by: user.personId,
    acknowledgement_channel: "mobile_web",
  });

  // 23505 = unique violation: already acknowledged this version. Treat as
  // success — a queued acknowledgement replayed twice must not become an error.
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }

  revalidatePath("/mobile/my-tasks");
  return { ok: true };
}

export async function acknowledgeAssignment(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const version = Number(formData.get("assignmentVersion") ?? "0");

  const result = await recordAcknowledgement(assignmentId, version);
  if (!result.ok) {
    if (result.error === "unauthenticated") redirect("/login");
    redirect(`/mobile/my-tasks?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/mobile/my-tasks");
}

/**
 * Same write, no redirect. Used when the offline queue drains: the user may
 * be anywhere in the app by then, and sending them to /mobile/my-tasks
 * because the signal came back would be its own kind of failure.
 */
export async function acknowledgeAssignmentQuietly(formData: FormData): Promise<AckResult> {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const version = Number(formData.get("assignmentVersion") ?? "0");
  return recordAcknowledgement(assignmentId, version);
}

export async function addAssignment(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!can.manageAssignments(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์จัดการผู้รับผิดชอบ")}`);
  }
  if (!personId || !roleId) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("กรุณาเลือกบุคคลและบทบาท")}`);
  }

  const { error } = await supabase.from("assignments").insert({
    event_id: eventId,
    person_id: personId,
    role_id: roleId,
    assignment_status: "assigned",
    assignment_version: 1,
    created_by: user.id,
  });
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  await supabase.from("audit_logs").insert({
    entity_type: "event",
    entity_id: eventId,
    action: "assign",
    changed_by: user.id,
    summary: "เพิ่มผู้รับผิดชอบ",
    new_values: { person_id: personId, role_id: roleId },
  });

  // Best-effort notification and reminder enqueue
  await supabase.rpc("enqueue_event_notifications", {
    p_event_id: eventId,
    p_type: "assignment",
  });
  await supabase.rpc("enqueue_event_reminders", {
    p_event_id: eventId,
  });

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function removeAssignment(formData: FormData) {
  await blockWritesInDemoMode();
  const eventId = String(formData.get("eventId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!can.manageAssignments(user.role)) {
    redirect(`/events/${eventId}?error=${encodeURIComponent("ไม่มีสิทธิ์จัดการผู้รับผิดชอบ")}`);
  }

  const { error } = await supabase
    .from("assignments")
    .update({ assignment_status: "removed", removed_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) redirect(`/events/${eventId}?error=${encodeURIComponent(error.message)}`);

  await supabase.from("audit_logs").insert({
    entity_type: "event",
    entity_id: eventId,
    action: "unassign",
    changed_by: user.id,
    summary: "นำผู้รับผิดชอบออก",
    new_values: { assignment_id: assignmentId },
  });

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}
