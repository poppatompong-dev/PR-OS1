// คำถามจากน้อง ๆ ที่บอทตอบเองไม่ได้ (owner, 6 Nov 2026): instead of a dead-end
// "ยังไม่เข้าใจ", the question goes to the admin recipients (ป๊อบ + พี่เอิร์ธ) on
// Telegram with a #Qxxxxx tag. An admin taps Reply on it and types the answer;
// the bot sends that answer back to whoever asked and tells the other admins it
// is done. Logged as audit team_question / team_answer. Free: Telegram only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminRecipientIds, getPeopleByIds, type LinePerson } from "@/lib/line/data";
import { esc, sendTelegram, type TgMessage } from "@/lib/telegram/api";
import { titleFor } from "@/lib/telegram/chat";

export const Q_TAG = /#Q([A-Z0-9]{5})\b/;
const LAUGH = /^(5{2,}|ฮ่?า+|ha+|อิ+|อุ+|โอเค|ok|ค่ะ|คะ|ครับ|คับ|จ้า|จ้ะ|ได้|ๆ|\.)+$/i;

/** Worth a human's time: real Thai words (or a ?), not a laugh, an emoji or a key-mash. */
export function looksLikeQuestion(text: string): boolean {
  const t = text.replace(/[\s\p{Extended_Pictographic}️!.,~]/gu, "");
  if (t.length < 4 || LAUGH.test(t)) return false;
  const thai = (t.match(/[ก-ฮะ-ฺเ-ๅ]/g) ?? []).length;
  if (/[?？]/.test(text)) return true;
  // 9 Nov 2026: chatter ("อากาศร้อน", "ยินดีกับ…") reached the admins — a question needs a question word.
  return thai >= 4 && QUESTION_CUE.test(t);
}

/** Thai question words / asking for help / reporting a problem. */
export const QUESTION_CUE =
  /(ไหม|มั้ย|มั๊ย|ป่าว|เปล่า|ยังไง|ยังงัย|อย่างไร|ทำไง|ไง|ทำไม|เมื่อไร|เมื่อไหร่|ตอนไหน|ที่ไหน|ตรงไหน|ใคร|อะไร|กี่|หรือยัง|รึยัง|ช่วย|สอบถาม|ถามหน่อย|สงสัย|ไม่ได้|ไม่ขึ้น|ไม่เห็น|ไม่มา|ไม่ทำงาน|เสีย|ค้าง|error|ผิด|ปัญหา)/;

export function isChatter(text: string): boolean {
  const t = text.replace(/[\s\p{Extended_Pictographic}\uFE0F!.,~]/gu, "");
  return (t.match(/[ก-ฮะ-ฺเ-ๅ]/g) ?? []).length >= 4 && !looksLikeQuestion(text);
}

const newCode = () => Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

/** Forward to every admin recipient except the asker. Returns how many got it (0 = nobody, or the asker is an admin). */
export async function forwardQuestion(admin: SupabaseClient, person: LinePerson, raw: string): Promise<number> {
  const ids = await getAdminRecipientIds(admin);
  if (ids.includes(person.id)) return 0;
  const admins = (await getPeopleByIds(admin, ids)).filter((a) => a.telegramChatId);
  if (!admins.length) return 0;
  const text = raw.trim().slice(0, 800);
  const code = newCode();
  const who = titleFor(person.id, person.displayName);
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: person.id,
    action: "team_question",
    changed_by: null,
    summary: "คำถามจากทีม (Telegram)",
    new_values: { text, code, via: "telegram" },
  });
  let sent = 0;
  for (const a of admins) {
    const res = await sendTelegram(a.telegramChatId!, {
      text: `❓ <b>คำถามจาก ${esc(who)}</b>\n\n${esc(text)}\n\n↩️ กด <b>ตอบกลับ (Reply)</b> ที่ข้อความนี้ แล้วพิมพ์คำตอบ บอทจะส่งถึง${esc(who)}ให้ · #Q${code}`,
    });
    if (res.ok) sent += 1;
  }
  return sent;
}

/** An admin replied to a #Q message. null = not an answer (handle the text as usual). */
export async function answerQuestion(admin: SupabaseClient, answerer: LinePerson, repliedTo: string, raw: string): Promise<TgMessage[] | null> {
  const code = repliedTo.match(Q_TAG)?.[1];
  if (!code) return null;
  const ids = await getAdminRecipientIds(admin);
  if (!ids.includes(answerer.id)) return null;
  const answer = raw.trim().slice(0, 1500);
  if (!answer) return null;

  const { data } = await admin.from("audit_logs").select("entity_id, new_values").eq("action", "team_question").order("created_at", { ascending: false }).limit(300);
  type Row = { entity_id: string; new_values: { code?: string; text?: string } | null };
  const q = ((data ?? []) as Row[]).find((r) => r.new_values?.code === code);
  if (!q) return [{ text: `⚠️ หาคำถาม #Q${code} ไม่เจอ · ตอบน้องในแชทส่วนตัวแทนนะ` }];
  const [asker] = await getPeopleByIds(admin, [q.entity_id]);
  const askerName = asker ? titleFor(asker.id, asker.displayName) : "เจ้าของคำถาม";
  if (!asker?.telegramChatId) return [{ text: `⚠️ ${esc(askerName)} ไม่ได้ผูก Telegram แล้ว ส่งคำตอบไม่ได้ · บอกเองนะ` }];

  const by = titleFor(answerer.id, answerer.displayName);
  const question = String(q.new_values?.text ?? "");
  const res = await sendTelegram(asker.telegramChatId, {
    text: `💬 <b>แอดมินตอบคำถามแล้ว</b> (${esc(by)})\n\n${esc(answer)}\n\n<i>คำถาม: ${esc(question.length > 120 ? `${question.slice(0, 119)}…` : question)}</i>\n\nถามต่อได้เลย พิมพ์มาในแชทนี้`,
  });
  if (!res.ok) return [{ text: `⚠️ ส่งคำตอบถึง${esc(askerName)}ไม่สำเร็จ ลองใหม่อีกครั้ง` }];

  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: asker.id,
    action: "team_answer",
    changed_by: null,
    summary: "แอดมินตอบคำถามทีม (Telegram)",
    new_values: { code, text: answer, by: answerer.id },
  });
  for (const a of await getPeopleByIds(admin, ids.filter((id) => id !== answerer.id))) {
    if (a.telegramChatId) await sendTelegram(a.telegramChatId, { text: `✅ ${esc(by)} ตอบคำถาม #Q${code} ของ${esc(askerName)}แล้ว` });
  }
  return [{ text: `✅ ส่งคำตอบถึง${esc(askerName)}แล้ว` }];
}
