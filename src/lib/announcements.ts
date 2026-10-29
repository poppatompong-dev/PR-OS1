// ประกาศบนจอทีวี (ตัววิ่ง) — owner, 29 Oct 2026: everyone on the team may post,
// no approval, shown at once, gone at midnight (Bangkok) unless a later end
// is chosen; the screen shows who posted it and an admin can remove it.
// Same rules from every door: the LINE / Telegram chat ("ประกาศ …"), the web
// page and the job form. Pure parts are covered by tests/announcements.unit.test.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysIso, bangkokNow } from "@/lib/monitor/thai-time";

export const ANNOUNCE_MAX = 140;
export const ANNOUNCE_MAX_DAYS = 14;

const PREFIX = /^\s*(ประกาศ|📢)\s*[:：-]?\s*/u;

/** "ประกาศ พรุ่งนี้ประชุม 9 โมง" → "พรุ่งนี้ประชุม 9 โมง"; anything else → null. */
export function parseAnnounceCommand(raw: string): string | null {
  if (!PREFIX.test(raw)) return null;
  const rest = raw.replace(PREFIX, "").replace(/\s+/g, " ").trim();
  return rest;
}

/** 00:00 of the day after `days` (0 = tonight's midnight), Bangkok time, as an instant. */
export function bangkokMidnightAfter(days = 0, now = new Date()): Date {
  const today = bangkokNow(now).iso;
  return new Date(`${addDaysIso(today, days + 1)}T00:00:00+07:00`);
}

export function cleanAnnouncement(text: string): { ok: true; message: string } | { ok: false; error: string } {
  const message = text.replace(/\s+/g, " ").trim();
  if (!message) return { ok: false, error: 'พิมพ์ข้อความต่อจากคำว่า "ประกาศ" ด้วยครับ เช่น ประกาศ พรุ่งนี้ประชุม 9 โมง ห้อง 1' };
  if (message.length > ANNOUNCE_MAX) return { ok: false, error: `ประกาศยาวเกินไป (${message.length} ตัวอักษร) — ไม่เกิน ${ANNOUNCE_MAX} ตัวอักษร` };
  return { ok: true, message };
}

export async function createAnnouncement(
  admin: SupabaseClient,
  input: { text: string; personId: string | null; authorName: string; source: "web" | "line" | "telegram" | "event_form"; eventId?: string | null; days?: number },
  now = new Date(),
): Promise<{ ok: true; id: string; message: string; endsAt: Date } | { ok: false; error: string }> {
  const cleaned = cleanAnnouncement(input.text);
  if (!cleaned.ok) return cleaned;
  const days = Math.max(0, Math.min(ANNOUNCE_MAX_DAYS, Math.floor(input.days ?? 0)));
  const endsAt = bangkokMidnightAfter(days, now);
  const { data, error } = await admin
    .from("tv_announcements")
    .insert({
      message: cleaned.message,
      author_person_id: input.personId,
      author_name: input.authorName,
      source: input.source,
      event_id: input.eventId ?? null,
      ends_at: endsAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "บันทึกประกาศไม่สำเร็จ ลองใหม่อีกครั้ง" };
  return { ok: true, id: data.id, message: cleaned.message, endsAt };
}

export function announceDoneText(message: string, endsAt: Date): string {
  const d = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }).format(new Date(endsAt.getTime() - 1));
  return `📢 ขึ้นจอทีวีแล้ว (ภายใน 1 นาที)\n"${message}"\n⏱ ถึงสิ้นวัน ${d} · ลบได้ที่เว็บ หน้า "ประกาศบนจอ"`;
}
