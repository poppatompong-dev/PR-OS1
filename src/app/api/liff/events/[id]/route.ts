// One job from the phone app: GET = fill the edit form, PATCH = save the form,
// POST {action, reason} = เผยแพร่ / เลื่อนออกไปก่อน / ยกเลิก / ลบร่าง.
// Auth: LINE ID token or Telegram initData (src/lib/liff/auth.ts).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_WRITE_MESSAGE } from "@/lib/demo-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { authenticateLiff } from "@/lib/liff/auth";
import { parseLiffEventInput } from "@/lib/liff/create-event";
import { editJob, getJob, jobAction, type JobAction } from "@/lib/liff/manage-event";
import { kickNotifications } from "@/lib/notifications/kick";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: JobAction[] = ["publish", "postpone", "cancel", "delete"];

async function setup(request: Request, params: Promise<{ id: string }>) {
  if (!isSupabaseConfigured()) return { res: NextResponse.json({ error: DEMO_WRITE_MESSAGE }, { status: 503 }) };
  const { id } = await params;
  if (!UUID.test(id)) return { res: NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 }) };
  const admin = createAdminClient();
  const auth = await authenticateLiff(request, admin);
  if (!auth.ok) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  return { id, admin, caller: auth.caller };
}

function refresh(id: string) {
  revalidatePath("/schedule");
  revalidatePath("/monitor");
  revalidatePath(`/events/${id}`);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await setup(request, params);
  if ("res" in s) return s.res;
  const r = await getJob(s.admin, s.caller, s.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.job);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await setup(request, params);
  if ("res" in s) return s.res;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = parseLiffEventInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const reason = typeof (body as { reason?: unknown })?.reason === "string" ? String((body as { reason: string }).reason).trim().slice(0, 200) : "";
  const r = await editJob(s.admin, s.caller, s.id, parsed.input, reason);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.notified > 0) kickNotifications();
  refresh(s.id);
  return NextResponse.json(r);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await setup(request, params);
  if ("res" in s) return s.res;
  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
  const action = ACTIONS.find((a) => a === body.action);
  if (!action) return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  const r = await jobAction(s.admin, s.caller, s.id, action, String(body.reason ?? ""));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.notified > 0) kickNotifications();
  refresh(s.id);
  return NextResponse.json(r);
}
