// One-time upload slot for a file that goes with a new job (web form or the
// LINE form). Auth: a web session that may create jobs, or a LINE ID token
// (Bearer) of a linked team member. The browser then uploads straight to
// Storage with the returned token; the job save moves the file into place.

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { authenticateLiff } from "@/lib/liff/auth";
import { createStagedUpload } from "@/lib/attachments/staging";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_WRITE_MESSAGE } from "@/lib/demo-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: DEMO_WRITE_MESSAGE }, { status: 503 });
  const admin = createAdminClient();

  if ((request.headers.get("authorization") ?? "").startsWith("Bearer ")) {
    const auth = await authenticateLiff(request, admin);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  } else {
    const user = await getSessionUser(await createClient());
    if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    if (!can.createDraft(user.role)) return NextResponse.json({ error: "บัญชีของคุณแนบไฟล์ไม่ได้" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const result = await createStagedUpload(admin, {
    fileName: typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "",
    mimeType: typeof body.mimeType === "string" ? body.mimeType : "",
    sizeBytes: Number(body.sizeBytes),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ path: result.path, token: result.token });
}
