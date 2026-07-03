"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";

export async function acknowledgeAssignment(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const version = Number(formData.get("assignmentVersion") ?? "0");

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!user.personId) {
    redirect(
      `/mobile/my-tasks?error=${encodeURIComponent("บัญชีนี้ยังไม่ได้ผูกกับรายชื่อบุคลากร")}`,
    );
  }

  const { error } = await supabase.from("acknowledgements").insert({
    assignment_id: assignmentId,
    assignment_version: version,
    acknowledged_by: user.personId,
    acknowledgement_channel: "mobile_web",
  });

  // 23505 = unique violation: already acknowledged this version. Treat as success.
  if (error && error.code !== "23505") {
    redirect(`/mobile/my-tasks?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/mobile/my-tasks");
  redirect("/mobile/my-tasks");
}

export async function addAssignment(formData: FormData) {
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

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function removeAssignment(formData: FormData) {
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
