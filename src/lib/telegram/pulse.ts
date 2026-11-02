// "ถามไถ่ทีม" (owner, 2 Nov 2026: keep in touch with the PR team, caring but
// never annoying). A team message from the admin can carry three answer
// buttons; a tap is one free reply that reaches the admins:
//   😊 ใช้ได้ดี      → thank-you only (logged, no admin ping)
//   😕 ยังงงอยู่     → admins are told who to go and help
//   💬 อยากบอกอะไร → the next text (within 30 min) is passed to the admins
// One answer per message per person, so repeated taps never flood anyone.

import type { SupabaseClient } from "@supabase/supabase-js";
import { esc, type TgButton, type TgMessage } from "@/lib/telegram/api";

export type PulseAnswer = "ok" | "confused" | "talk";

export const PULSE_NOTE_MINUTES = 30;

export const pulseCb = (k: PulseAnswer) => `pl|${k}`;

export function pulseButtons(): TgButton[][] {
  return [
    [
      { text: "😊 ใช้ได้ดี", callback_data: pulseCb("ok") },
      { text: "😕 ยังงงอยู่", callback_data: pulseCb("confused") },
    ],
    [{ text: "💬 อยากบอกอะไร", callback_data: pulseCb("talk") }],
  ];
}

export function isPulseAnswer(v: string | undefined): v is PulseAnswer {
  return v === "ok" || v === "confused" || v === "talk";
}

const LABEL: Record<PulseAnswer, string> = { ok: "😊 ใช้ได้ดี", confused: "😕 ยังงงอยู่", talk: "💬 อยากบอกอะไร" };

/** What the person sees right after tapping. */
export function pulseReply(a: PulseAnswer): TgMessage {
  if (a === "ok") return { text: "🙏 <b>ขอบคุณครับ</b> ดีใจที่ใช้ได้ดี · มีอะไรติดขัดบอกได้ตลอดนะครับ" };
  if (a === "confused")
    return { text: ["🙏 <b>ขอบคุณที่บอกครับ</b> เดี๋ยวแอดมินแวะไปช่วยนะครับ", 'ระหว่างนี้ลองกดปุ่ม "วิธีใช้" ใต้แชทได้ครับ'].join("\n") };
  return { text: `💬 <b>พิมพ์มาได้เลยครับ</b> (ภายใน ${PULSE_NOTE_MINUTES} นาที)\nข้อความจะส่งถึงแอดมินโดยตรง` };
}

export function pulseAdminText(name: string, a: PulseAnswer): string | null {
  if (a === "confused") return `😕 ${esc(name)} ตอบว่า "ยังงงอยู่" · แวะไปช่วยหน่อยครับ`;
  return null;
}

export function pulseNoteAdminText(name: string, note: string): string {
  return `💬 <b>${esc(name)} ฝากบอก</b>\n${esc(note.slice(0, 1500))}`;
}

export const PULSE_NOTE_THANKS: TgMessage = { text: "📨 <b>ส่งถึงแอดมินแล้วครับ</b> ขอบคุณที่บอกนะครับ 🙏" };

export async function logPulse(admin: SupabaseClient, personId: string, answer: PulseAnswer | "note", note?: string) {
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "pulse_reply",
    changed_by: null,
    summary: answer === "note" ? "ฝากข้อความถึงแอดมิน (Telegram)" : `ตอบถามไถ่: ${LABEL[answer]}`,
    new_values: { answer, ...(note ? { note: note.slice(0, 1500) } : {}), via: "telegram" },
  });
}
