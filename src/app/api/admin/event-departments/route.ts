// เติม "หน่วยงานเจ้าของงาน" ย้อนหลัง (owner, 6 Nov 2026: jobs added from the phone
// before the form had the field). Admin web session only. Touches nothing but
// events.owner_department_id — no notifications, no change cards — and logs
// one audit row per job. Body: { items: [{ eventId, departmentShort }] }.

import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { can, getSessionUser } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "ระบบยังไม่พร้อม" }, { status: 503 });
  const user = await getSessionUser(await createClient());
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can.manageSettings(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { items?: Array<{ eventId?: string; departmentShort?: string }> } | null;
  const items = (body?.items ?? []).filter((i) => UUID.test(i.eventId ?? "") && (i.departmentShort ?? "").trim()).slice(0, 200);
  if (!items.length) return NextResponse.json({ error: "ไม่มีรายการ" }, { status: 400 });

  const admin = createAdminClient();
  const { data: depts } = await admin.from("departments").select("id, short_name").eq("is_active", true);
  const byShort = new Map((depts ?? []).map((d) => [String(d.short_name ?? "").trim(), d.id as string]));
  const results: Array<{ eventId: string; ok: boolean; note?: string }> = [];
  for (const it of items) {
    const deptId = byShort.get(it.departmentShort!.trim());
    if (!deptId) { results.push({ eventId: it.eventId!, ok: false, note: `ไม่รู้จักหน่วยงาน ${it.departmentShort}` }); continue; }
    const { data: ev } = await admin.from("events").select("id, title, owner_department_id, deleted_at").eq("id", it.eventId!).maybeSingle();
    if (!ev || ev.deleted_at) { results.push({ eventId: it.eventId!, ok: false, note: "ไม่พบงาน" }); continue; }
    if (ev.owner_department_id) { results.push({ eventId: it.eventId!, ok: false, note: "มีหน่วยงานอยู่แล้ว (ไม่ทับ)" }); continue; }
    const { error } = await admin.from("events").update({ owner_department_id: deptId }).eq("id", ev.id).is("owner_department_id", null);
    if (error) { results.push({ eventId: ev.id, ok: false, note: error.message }); continue; }
    await admin.from("audit_logs").insert({
      entity_type: "event",
      entity_id: ev.id,
      action: "backfill_department",
      changed_by: user.id,
      summary: `เติมหน่วยงานเจ้าของงานย้อนหลัง: ${it.departmentShort}`,
      old_values: { owner_department_id: null },
      new_values: { owner_department_id: deptId },
    });
    results.push({ eventId: ev.id, ok: true });
  }
  return NextResponse.json({ done: results.filter((r) => r.ok).length, results });
}
