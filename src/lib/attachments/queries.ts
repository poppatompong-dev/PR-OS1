// Read-side access for private event attachments.
// RLS (migration 0010) decides who sees what: backend roles see every event's
// files, an assignee only sees files on events assigned to them, and anon sees
// nothing. Callers therefore never need their own permission check to LIST.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { EventAttachment } from "@/types/domain";

export const ATTACHMENT_BUCKET = "event-attachments";

/** Signed download links are short-lived on purpose (shared links expire). */
export const SIGNED_URL_TTL_SECONDS = 60;

export async function getEventAttachments(
  eventId: string,
): Promise<EventAttachment[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("event_attachments")
    .select("id, event_id, file_name, mime_type, size_bytes, created_at")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    fileName: row.file_name,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    createdAt: row.created_at,
  }));
}

export type SignedAttachment = { url: string; fileName: string };

/**
 * Create a short-lived signed URL for one attachment.
 * Returns null when the row is missing OR when RLS hides it from this session —
 * the caller cannot tell the two apart, which is the intended behavior.
 */
export async function getAttachmentSignedUrl(
  attachmentId: string,
): Promise<SignedAttachment | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("event_attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return null;

  const { data: signed, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: row.file_name,
    });
  if (error || !signed?.signedUrl) return null;

  return { url: signed.signedUrl, fileName: row.file_name };
}
