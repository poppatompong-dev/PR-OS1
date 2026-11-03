// The pins of one job for "🗺️ ดูพิกัด" on a Telegram/LINE card (owner, 3 Nov
// 2026: ผู้ได้รับมอบหมายดูพิกัดได้อย่างละเอียด และกดนำทาง GPS ได้).
// Same people as the files: those on the job, the admins.
//   GET ?e=<event id> → { title, eventDate, startTime, endTime, place, points }

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authenticateLiff } from "@/lib/liff/auth";
import { mayOpenJob } from "@/lib/liff/may-open";
import { isSupabaseConfigured } from "@/lib/env";
import { pointsFromMetadata } from "@/lib/maps";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "ระบบยังไม่พร้อม" }, { status: 503 });
  const admin = createAdminClient();
  const auth = await authenticateLiff(request, admin);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const eventId = new URL(request.url).searchParams.get("e") ?? "";
  if (!UUID.test(eventId)) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  const { data: ev } = await admin
    .from("events")
    .select("id, title, event_date, start_time, end_time, metadata, deleted_at, location:locations(name)")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.deleted_at) return NextResponse.json({ error: "ไม่พบงานนี้ อาจถูกลบไปแล้ว" }, { status: 404 });
  if (!(await mayOpenJob(admin, eventId, auth.caller))) {
    return NextResponse.json({ error: "พิกัดของงานนี้เปิดได้เฉพาะคนที่ได้รับมอบหมาย และหัวหน้า/แอดมินครับ" }, { status: 403 });
  }
  const loc = Array.isArray(ev.location) ? ev.location[0] : ev.location;
  return NextResponse.json({
    title: ev.title,
    eventDate: ev.event_date,
    startTime: String(ev.start_time ?? "").slice(0, 5),
    endTime: ev.end_time ? String(ev.end_time).slice(0, 5) : null,
    place: (loc as { name?: string } | null)?.name ?? "",
    points: pointsFromMetadata(ev.metadata),
  });
}
