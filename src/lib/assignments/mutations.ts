"use server";

import { blockWritesInDemoMode } from "@/lib/demo-guard";
import { kickNotifications } from "@/lib/notifications/kick";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { recordUnavailable } from "@/lib/line/data";
import { alertAdminsUnavailable } from "@/lib/line/alerts";
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
  kickNotifications();

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

  await noticeRemoved(eventId, assignmentId);

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

/**
 * Owner, 22 Oct 2026: someone taken off a job that still goes ahead must hear
 * it, or they turn up anyway. Their pending reminder is dropped and a "ถอนชื่อ
 * ออกจากงาน" card is queued (queue type cancellation; the sender words it by
 * the assignment being removed while the job is still published). Only for a
 * published job — a draft never reached the person. Notifications have no
 * client write policy, hence the service-role client after the role check.
 */
async function noticeRemoved(eventId: string, assignmentId: string) {
  if (!isSupabaseConfigured()) return;
  const admin = createAdminClient();
  const { data: asg } = await admin
    .from("assignments")
    .select("id, person_id, event:events!inner(status, deleted_at)")
    .eq("id", assignmentId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ev = Array.isArray((asg as any)?.event) ? (asg as any).event[0] : (asg as any)?.event;
  if (!asg || !ev || ev.status !== "published" || ev.deleted_at) return;

  await admin
    .from("notifications")
    .update({ status: "skipped", sent_at: new Date().toISOString(), error_message: "นำชื่อออกจากงานแล้ว" })
    .eq("assignment_id", assignmentId)
    .eq("status", "queued");
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
  await admin.from("notifications").insert({
    event_id: eventId,
    assignment_id: assignmentId,
    person_id: asg.person_id,
    channel: "line",
    notification_type: "cancellation",
    scheduled_for: new Date().toISOString(),
    status: "queued",
    quota_month: month,
  });
  kickNotifications();
}

/**
 * "ไม่สะดวก" from the web (the LINE button does the same through the
 * webhook). The person stays on the job with a red flag; admins are told on
 * LINE and pick a replacement themselves (owner decision 19 Oct 2026).
 */
export async function markUnavailable(formData: FormData) {
  await blockWritesInDemoMode();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!user.personId) {
    redirect(`/mobile/my-tasks?error=${encodeURIComponent("บัญชีนี้ยังไม่ได้ผูกกับรายชื่อบุคลากร")}`);
  }
  if (!reason) {
    redirect(`/mobile/my-tasks?error=${encodeURIComponent("กรุณาใส่เหตุผลสั้น ๆ ว่าทำไมไม่สะดวก")}`);
  }

  const admin = createAdminClient();
  const { outcome, task } = await recordUnavailable(admin, {
    assignmentId,
    personId: user.personId,
    reason,
    changedBy: user.id,
  });
  if (outcome !== "ok" || !task) {
    const msg =
      outcome === "not_yours"
        ? "งานนี้ไม่ได้มอบหมายให้คุณ"
        : outcome === "closed"
          ? "งานนี้ถูกยกเลิกหรือปิดไปแล้ว"
          : "ไม่พบงานนี้แล้ว";
    redirect(`/mobile/my-tasks?error=${encodeURIComponent(msg)}`);
  }

  await alertAdminsUnavailable(admin, task);
  revalidatePath("/mobile/my-tasks");
  redirect("/mobile/my-tasks?unavailable=1");
}
