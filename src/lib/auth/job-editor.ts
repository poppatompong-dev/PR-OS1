// ใครเพิ่ม/แก้/เลื่อน/ยกเลิกงานได้ (owner via พี่เอิร์ธ, 20 Nov 2026 — "น้องเปลี่ยนแปลงกัน
// โดยที่พี่เอิร์ธและหัวหน้าไม่ทราบ"): พี่เอิร์ธคนเดียว. When he is away the owner can
// switch one other person on for the rest of the day (/settings › ทีมงาน › ⋯).
// Everyone still reads jobs and presses รับทราบ / ไม่สะดวก.

import type { SupabaseClient } from "@supabase/supabase-js";

/** พี่เอิร์ธ (ธนันธร) — หัวหน้างาน ปชส., the one who gives out the work. */
export const JOB_OWNER_ID = "00000000-0000-0000-0000-000000000502";
export const DELEGATE_KEY = "job_editor_delegate";
export const NOT_EDITOR_MSG = "เพิ่ม/แก้ไขงานได้เฉพาะพี่เอิร์ธ · มีอะไรเปลี่ยน แจ้งพี่เอิร์ธได้เลย";

export type Delegate = { personId: string; until: string } | null;

export function isJobEditor(personId: string | null | undefined, delegate: Delegate, now = new Date()): boolean {
  if (!personId) return false;
  if (personId === JOB_OWNER_ID) return true;
  return Boolean(delegate && delegate.personId === personId && Date.parse(delegate.until) > now.getTime());
}

export async function loadDelegate(admin: SupabaseClient, now = new Date()): Promise<Delegate> {
  const { data } = await admin.from("settings").select("value").eq("key", DELEGATE_KEY).maybeSingle();
  const v = data?.value as { personId?: string; until?: string } | null;
  if (!v?.personId || !v.until || Date.parse(v.until) <= now.getTime()) return null;
  return { personId: v.personId, until: v.until };
}

export async function canEditJobs(admin: SupabaseClient, personId: string | null | undefined): Promise<boolean> {
  if (!personId) return false;
  if (personId === JOB_OWNER_ID) return true;
  return isJobEditor(personId, await loadDelegate(admin));
}

/** End of today, Bangkok — when a stand-in's rights lapse. */
export function endOfBangkokDay(now = new Date()): string {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${d}T23:59:59+07:00`).toISOString();
}
