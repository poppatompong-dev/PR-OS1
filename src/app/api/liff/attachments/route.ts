// Files of one job, for the "ดูไฟล์แนบ" button on a LINE card (LIFF page
// /liff/add-event/files). Auth: LINE ID token. Owner, 26 Oct 2026: only the
// people on the job and the admins (admin accounts + "รับแจ้งเตือนฝั่งแอดมิน")
// may open them. Download links are signed for 60 seconds.
//   GET  ?e=<event id>      → { title, eventDate, files: [...] }
//   POST { id }             → { url }

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { authenticateLiff, type LiffCaller } from "@/lib/liff/auth";
import { getAdminRecipientIds } from "@/lib/line/data";
import { ATTACHMENT_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/attachments/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { isImageMime, thumbPathFor } from "@/lib/attachments/rules";

const THUMB_TTL_SECONDS = 300;

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = "ไฟล์ของงานนี้เปิดได้เฉพาะคนที่ได้รับมอบหมาย และหัวหน้า/แอดมินครับ";

async function mayOpen(admin: SupabaseClient, eventId: string, caller: LiffCaller): Promise<boolean> {
  const { data: asg } = await admin
    .from("assignments")
    .select("id")
    .eq("event_id", eventId)
    .eq("person_id", caller.personId)
    .eq("assignment_status", "assigned")
    .limit(1);
  if ((asg ?? []).length > 0) return true;
  if ((await getAdminRecipientIds(admin)).includes(caller.personId)) return true;
  if (!caller.userId) return false;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", caller.userId).maybeSingle();
  return profile?.role === "admin";
}

async function guard(request: Request) {
  if (!isSupabaseConfigured()) return { error: NextResponse.json({ error: "ระบบยังไม่พร้อม" }, { status: 503 }) } as const;
  const admin = createAdminClient();
  const auth = await authenticateLiff(request, admin);
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) } as const;
  return { admin, caller: auth.caller } as const;
}

export async function GET(request: Request) {
  const g = await guard(request);
  if ("error" in g) return g.error;
  const eventId = new URL(request.url).searchParams.get("e") ?? "";
  if (!UUID.test(eventId)) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  const { data: ev } = await g.admin
    .from("events")
    .select("id, title, event_date, deleted_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.deleted_at) return NextResponse.json({ error: "ไม่พบงานนี้ อาจถูกลบไปแล้ว" }, { status: 404 });
  if (!(await mayOpen(g.admin, eventId, g.caller))) return NextResponse.json({ error: DENIED }, { status: 403 });

  const { data: files } = await g.admin
    .from("event_attachments")
    .select("id, file_name, mime_type, size_bytes, created_at, storage_path")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  // Photo tiles (owner, 26 Oct 2026): the small preview made at upload; an
  // older photo without one falls back to the picture itself. 5-minute links.
  const thumbs = await Promise.all(
    (files ?? []).map(async (f) => {
      if (!isImageMime(f.mime_type)) return null;
      const bucket = g.admin.storage.from(ATTACHMENT_BUCKET);
      const small = await bucket.createSignedUrl(thumbPathFor(f.storage_path), THUMB_TTL_SECONDS);
      if (small.data?.signedUrl) return small.data.signedUrl;
      const full = await bucket.createSignedUrl(f.storage_path, THUMB_TTL_SECONDS);
      return full.data?.signedUrl ?? null;
    }),
  );
  return NextResponse.json({
    title: ev.title,
    eventDate: ev.event_date,
    files: (files ?? []).map((f, i) => ({
      id: f.id,
      fileName: f.file_name,
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      thumb: thumbs[i],
    })),
  });
}

export async function POST(request: Request) {
  const g = await guard(request);
  if ("error" in g) return g.error;
  let id = "";
  try {
    id = String(((await request.json()) as { id?: unknown }).id ?? "");
  } catch {
    /* fall through */
  }
  if (!UUID.test(id)) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });

  const { data: row } = await g.admin
    .from("event_attachments")
    .select("event_id, storage_path, file_name, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.deleted_at) return NextResponse.json({ error: "ไม่พบไฟล์ อาจถูกลบไปแล้ว" }, { status: 404 });
  if (!(await mayOpen(g.admin, row.event_id, g.caller))) return NextResponse.json({ error: DENIED }, { status: 403 });

  const { data: signed, error } = await g.admin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !signed) return NextResponse.json({ error: "เปิดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, fileName: row.file_name });
}
