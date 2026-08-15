// Private attachment download.
//
// The signed Storage URL is created per request from the caller's own session,
// so Storage RLS (migration 0010) is the gate: a user who may not read the row
// gets 404, never a usable link. Nothing here is cacheable and the redirect
// target expires in SIGNED_URL_TTL_SECONDS.

import { NextResponse } from "next/server";
import { getAttachmentSignedUrl } from "@/lib/attachments/queries";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const signed = await getAttachmentSignedUrl(id);
  if (!signed) {
    // Missing row and "hidden by RLS" are intentionally indistinguishable.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.redirect(signed.url, {
    headers: { "Cache-Control": "no-store" },
  });
}
