// Files that go with the order itself. The browser uploads straight to
// Storage through a one-time signed URL (Vercel caps a request body at
// ~4.5 MB, a phone photo is often bigger), into staging/<uuid>.<ext>. When
// the job is saved, attachStaged() moves each file under <event_id>/ — the
// path the Storage RLS of migration 0010 checks — and writes its row.
// Service-role client: a LINE-only team member has no web session.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENT_BUCKET } from "@/lib/attachments/queries";
import {
  ATTACHMENT_MIME,
  MAX_ATTACHMENTS_PER_EVENT,
  checkAttachmentMeta,
  thumbPathFor,
  type StagedAttachment,
} from "@/lib/attachments/rules";

export async function createStagedUpload(
  admin: SupabaseClient,
  meta: { fileName: string; mimeType: string; sizeBytes: number },
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const problem = checkAttachmentMeta(meta);
  if (problem) return { ok: false, error: problem };
  const path = `staging/${randomUUID()}.${ATTACHMENT_MIME[meta.mimeType]}`;
  const { data, error } = await admin.storage.from(ATTACHMENT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: `เตรียมอัปโหลดไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}` };
  return { ok: true, path, token: data.token };
}

export async function countEventAttachments(admin: SupabaseClient, eventId: string): Promise<number> {
  const { count } = await admin
    .from("event_attachments")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("deleted_at", null);
  return count ?? 0;
}

/** Move staged files onto a job. Never throws: a file that fails is reported, the job stays saved. */
export async function attachStaged(
  admin: SupabaseClient,
  eventId: string,
  staged: StagedAttachment[],
  uploadedBy: string | null,
): Promise<{ attached: number; failed: string[] }> {
  if (staged.length === 0) return { attached: 0, failed: [] };
  const room = Math.max(0, MAX_ATTACHMENTS_PER_EVENT - (await countEventAttachments(admin, eventId)));
  const failed: string[] = staged.slice(room).map((s) => s.fileName);
  let attached = 0;
  for (const s of staged.slice(0, room)) {
    const finalPath = `${eventId}/${randomUUID()}.${ATTACHMENT_MIME[s.mimeType]}`;
    const { error: moveError } = await admin.storage.from(ATTACHMENT_BUCKET).move(s.path, finalPath);
    if (moveError) {
      failed.push(s.fileName);
      continue;
    }
    const { error: rowError } = await admin.from("event_attachments").insert({
      event_id: eventId,
      storage_path: finalPath,
      file_name: s.fileName,
      mime_type: s.mimeType,
      size_bytes: s.sizeBytes,
      uploaded_by: uploadedBy,
    });
    if (rowError) {
      await admin.storage.from(ATTACHMENT_BUCKET).remove([finalPath]);
      failed.push(s.fileName);
      continue;
    }
    // The photo's small preview goes next to it; a failed move only means no thumbnail.
    if (s.thumbPath) await admin.storage.from(ATTACHMENT_BUCKET).move(s.thumbPath, thumbPathFor(finalPath));
    attached += 1;
  }
  if (attached > 0) {
    await admin.from("audit_logs").insert({
      entity_type: "event",
      entity_id: eventId,
      action: "attachment_upload",
      changed_by: uploadedBy,
      summary: `แนบไฟล์ตอนสั่งงาน ${attached} ไฟล์`,
      new_values: { files: staged.slice(0, room).map((s) => s.fileName), via: "order" },
    });
  }
  return { attached, failed };
}
