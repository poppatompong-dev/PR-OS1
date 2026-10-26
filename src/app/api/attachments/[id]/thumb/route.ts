// Thumbnail for a photo attachment (owner, 26 Oct 2026). Same gate as the
// download route: the caller's own session and Storage RLS. Serves the small
// preview made at upload (<uuid>.thumb.jpg); a photo uploaded before previews
// existed falls back to the picture itself. Not for PDF/Word/Excel (the page
// shows an icon for those).

import { NextResponse } from "next/server";
import { ATTACHMENT_BUCKET } from "@/lib/attachments/queries";
import { isImageMime, thumbPathFor } from "@/lib/attachments/rules";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

const THUMB_TTL_SECONDS = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: row } = await supabase
    .from("event_attachments")
    .select("storage_path, mime_type")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row || !isImageMime(row.mime_type)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const bucket = supabase.storage.from(ATTACHMENT_BUCKET);
  const thumb = await bucket.createSignedUrl(thumbPathFor(row.storage_path), THUMB_TTL_SECONDS);
  const signed = thumb.data?.signedUrl ? thumb : await bucket.createSignedUrl(row.storage_path, THUMB_TTL_SECONDS);
  if (!signed.data?.signedUrl) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(signed.data.signedUrl, { headers: { "Cache-Control": "private, max-age=240" } });
}
