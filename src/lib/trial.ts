// ภารกิจทดสอบ (owner, 29 Oct 2026: "ให้ทุกคนเข้าแถวทดสอบใช้งานระบบได้อย่างเต็มที่").
// Four things each person tries once in Telegram; the bot ticks them off by
// itself and the team table shows who has finished. Stored in
// people.metadata.trial = { tour: iso, demo: iso, avatar: iso, draft: iso }.

import type { SupabaseClient } from "@supabase/supabase-js";

export const TRIAL_STEPS = [
  { key: "tour", label: "ดูทัวร์วิธีใช้จนจบ", how: 'พิมพ์ "ทัวร์" → กดจนถึง "เข้าใจแล้ว"' },
  { key: "demo", label: "ลองกดปุ่มบนการ์ดตัวอย่าง", how: 'ในทัวร์หน้า 1 กด "รับทราบ" หรือ "ไม่สะดวก"' },
  { key: "avatar", label: "ดูรูปการ์ตูนของตัวเอง", how: 'พิมพ์ "รูปของฉัน" → เลือกใช้/ไม่ใช้' },
  { key: "draft", label: "ลองเพิ่มงานแบบร่าง", how: 'ปุ่ม "งาน" ซ้ายล่าง → ＋ เพิ่มงาน → กด "บันทึกร่าง" (ไม่ส่งถึงใคร)' },
] as const;

export type TrialKey = (typeof TRIAL_STEPS)[number]["key"];

export function trialDone(metadata: unknown): Set<TrialKey> {
  const t = (metadata as { trial?: Record<string, unknown> } | null)?.trial;
  const done = new Set<TrialKey>();
  if (t && typeof t === "object") for (const s of TRIAL_STEPS) if (t[s.key]) done.add(s.key);
  return done;
}

/** Tick one step for a person; returns true the first time (so the bot can say "ครบแล้ว"). */
export async function markTrial(admin: SupabaseClient, personId: string, key: TrialKey, now = new Date()): Promise<{ first: boolean; done: number }> {
  const { data } = await admin.from("people").select("metadata").eq("id", personId).maybeSingle();
  const metadata = (data?.metadata as Record<string, unknown> | null) ?? {};
  const trial = { ...((metadata.trial as Record<string, unknown>) ?? {}) };
  const first = !trial[key];
  if (first) {
    trial[key] = now.toISOString();
    await admin.from("people").update({ metadata: { ...metadata, trial } }).eq("id", personId);
  }
  return { first, done: trialDone({ trial }).size };
}
