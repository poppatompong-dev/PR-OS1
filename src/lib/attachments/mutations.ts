"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { ATTACHMENT_BUCKET } from "@/lib/attachments/queries";

// Keep in sync with the bucket definition in
// supabase/migrations/0010_event_attachments.sql — the DB is the hard limit,
// this list only gives the user a readable error before the upload starts.
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function backToEvent(eventId: string, message: string): never {
  redirect(`/events/${eventId}?error=${encodeURIComponent(message)}`);
}

function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export async function uploadAttachment(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const file = formData.get("file");

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  // Uploading is a backend-role action; assignees may only read.
  if (!can.editPublished(user.role)) {
    backToEvent(eventId, "บัญชีของคุณไม่มีสิทธิ์แนบไฟล์");
  }

  if (!(file instanceof File) || file.size === 0) {
    backToEvent(eventId, "กรุณาเลือกไฟล์ก่อนกดแนบ");
  }
  if (file.size > MAX_BYTES) {
    backToEvent(
      eventId,
      `ไฟล์ใหญ่เกินไป (${formatMb(file.size)} MB) จำกัดไม่เกิน ${formatMb(MAX_BYTES)} MB`,
    );
  }

  const extension = ALLOWED_MIME[file.type];
  if (!extension) {
    backToEvent(eventId, "รองรับเฉพาะไฟล์ PDF, Word, Excel และรูปภาพ (JPG/PNG/WebP)");
  }

  // Storage path drives the RLS check: '<event_id>/<uuid>.<ext>'.
  // The user-supplied name is kept in the metadata row only, never in the path.
  const storagePath = `${eventId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    backToEvent(eventId, `อัปโหลดไฟล์ไม่สำเร็จ: ${uploadError.message}`);
  }

  const { error: rowError } = await supabase.from("event_attachments").insert({
    event_id: eventId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: user.id,
  });
  if (rowError) {
    // Roll back the object so the bucket does not collect orphans.
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
    backToEvent(eventId, `บันทึกข้อมูลไฟล์แนบไม่สำเร็จ: ${rowError.message}`);
  }

  await supabase.from("audit_logs").insert({
    entity_type: "event",
    entity_id: eventId,
    action: "attachment_upload",
    changed_by: user.id,
    summary: `แนบไฟล์: ${file.name}`,
    new_values: { file_name: file.name, size_bytes: file.size, mime_type: file.type },
  });

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function deleteAttachment(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const attachmentId = String(formData.get("attachmentId") ?? "");

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  if (!can.editPublished(user.role)) {
    backToEvent(eventId, "บัญชีของคุณไม่มีสิทธิ์ลบไฟล์แนบ");
  }

  const { data: row } = await supabase
    .from("event_attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) backToEvent(eventId, "ไม่พบไฟล์แนบนี้");

  const { error: removeError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .remove([row.storage_path]);
  if (removeError) {
    backToEvent(eventId, `ลบไฟล์ไม่สำเร็จ: ${removeError.message}`);
  }

  // Metadata row is soft-deleted so the audit trail still resolves the name.
  const { error: markError } = await supabase
    .from("event_attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", attachmentId);
  if (markError) {
    backToEvent(eventId, `ลบข้อมูลไฟล์แนบไม่สำเร็จ: ${markError.message}`);
  }

  await supabase.from("audit_logs").insert({
    entity_type: "event",
    entity_id: eventId,
    action: "attachment_delete",
    changed_by: user.id,
    summary: `ลบไฟล์แนบ: ${row.file_name}`,
    old_values: { file_name: row.file_name },
  });

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}
