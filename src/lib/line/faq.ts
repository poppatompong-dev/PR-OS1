// Common questions the bot answers by itself (owner, 29 Oct 2026), so the team
// gets the how-to right away without waiting for an admin to read the group.
//
// Every answer is a *reply*, so it costs no quota. In the group the bot still
// speaks only when spoken to: a question must be short and start with (or
// name) one of the words below, and the same answer is given at most once per
// 30 minutes per group so a chatty morning cannot fill the group with it.
// Pure matching here; tests/line-faq.unit.test.ts covers it.

import { LIFF_ADD_EVENT_URL } from "@/lib/liff/config";
import { env } from "@/lib/env";
import type { LineMessage } from "@/lib/line/api";

export type FaqTopic = "start" | "telegram" | "add" | "attach" | "edit" | "monitor";

/** Longer than this is a conversation, not a question for the bot. */
export const FAQ_MAX_CHARS = 60;
/** Same answer at most once per this many minutes in one group. */
export const FAQ_GROUP_COOLDOWN_MIN = 30;

// Words a message STARTS with (after removing spaces).
const STARTS: Array<[FaqTopic, string[]]> = [
  ["start", ["เริ่มต้น", "เริ่มใช้", "วิธีเริ่ม", "เริ่มยังไง", "เริ่มไง", "สมัคร", "มาใหม่", "สมาชิกใหม่", "เริ่มตรงไหน"]],
  ["add", ["เพิ่มงาน", "สร้างงาน", "ลงงาน", "สั่งงาน", "มอบหมายงาน", "บันทึกงาน", "วิธีเพิ่มงาน", "จะเพิ่มงาน"]],
  ["edit", ["แก้งาน", "แก้ไขงาน", "เลื่อนงาน", "ยกเลิกงาน", "ลบงาน", "วิธีแก้งาน", "จะแก้งาน"]],
];
// Words a message CONTAINS anywhere.
const CONTAINS: Array<[FaqTopic, string[]]> = [
  ["attach", ["แนบรูป", "แนบไฟล์", "แนบเอกสาร", "แนบภาพ", "ไฟล์แนบ"]],
  ["monitor", ["จอทีวี", "มอนิเตอร์", "จอมอนิเตอร์"]],
  ["telegram", ["telegram", "เทเลแกรม", "เทเลแกม"]],
];

export function matchFaq(raw: string): FaqTopic | null {
  const t = raw.replace(/\s+/g, "").toLowerCase();
  if (!t || t.length > FAQ_MAX_CHARS) return null;
  for (const [topic, words] of STARTS) if (words.some((w) => t.startsWith(w))) return topic;
  for (const [topic, words] of CONTAINS) if (words.some((w) => t.includes(w))) return topic;
  return null;
}

/** Key for the once-per-30-minutes rule; claimed with claimRun(). */
export function faqCooldownKey(groupId: string, topic: FaqTopic, now = Date.now()): string {
  return `faq:${groupId}:${topic}:${Math.floor(now / (FAQ_GROUP_COOLDOWN_MIN * 60_000))}`;
}

function webUrl(path = ""): string {
  return new URL(path || "/", env.appBaseUrl).toString();
}

export function faqText(topic: FaqTopic, inGroup: boolean): string {
  const where = inGroup ? 'ในแชทส่วนตัวกับ "ผู้ช่วยงาน ปชส."' : "ที่เมนูด้านล่าง";
  switch (topic) {
    case "start":
      return [
        "🚀 เริ่มใช้ PR-OS · 3 ขั้น (ทำครั้งเดียว)",
        "",
        '1️⃣ พิมพ์ "ลงทะเบียน" ในกลุ่ม → กดปุ่ม',
        '2️⃣ กด "เพิ่มเพื่อน" บอท "ผู้ช่วยงาน ปชส."',
        "3️⃣ แอดมินยืนยันชื่อ → บอทส่งลิงก์ Telegram ให้ในแชทส่วนตัว → กด Start",
        "",
        "📲 วิธีใช้งานทั้งหมดสอนใน Telegram",
      ].join("\n");
    case "telegram":
      return [
        "✈️ ย้ายแจ้งเตือนไป Telegram (ฟรี)",
        "",
        "1️⃣ ลงแอป Telegram (ถ้ายังไม่มี)",
        `2️⃣ ${inGroup ? 'ในแชทส่วนตัวกับ "ผู้ช่วยงาน ปชส." ' : ""}พิมพ์ "ผูก Telegram"`,
        "3️⃣ กดลิงก์ที่ได้ → กด Start",
        "",
        "💡 แอดมินยืนยันชื่อแล้ว บอทจะส่งลิงก์ให้เอง",
      ].join("\n");
    case "add":
      return [
        "📝 วิธีเพิ่มงาน",
        `1. กดปุ่ม "เพิ่มงาน" ${where}`,
        "2. กรอกชื่องาน วัน เวลา สถานที่",
        "3. เลือกคน แล้วติ๊กหน้าที่ (1 คนติ๊กได้หลายหน้าที่)",
        "4. แนบรูป/ไฟล์ได้ แล้วกดบันทึก",
        "",
        `หรือกดลิงก์นี้ 👉 ${LIFF_ADD_EVENT_URL}`,
        ...(inGroup ? ["", "(พิมพ์รายละเอียดงานในกลุ่ม บอทยังสร้างงานให้ไม่ได้ครับ)"] : []),
      ].join("\n");
    case "attach":
      return [
        "📎 ไฟล์แนบ",
        `• งานใหม่: ในฟอร์ม "เพิ่มงาน" กด "แนบไฟล์" ได้สูงสุด 5 ไฟล์ ไฟล์ละไม่เกิน 10 MB`,
        `  👉 ${LIFF_ADD_EVENT_URL}`,
        '• งานที่มีอยู่แล้ว: แนบเพิ่มในเว็บ PR-OS หน้ารายละเอียดงาน',
        '• ดูไฟล์: กดปุ่ม "ดูไฟล์แนบ" บนการ์ดงานในไลน์',
        "ไฟล์แนบเปิดได้เฉพาะทีมงาน ไม่ขึ้นบนจอทีวี",
      ].join("\n");
    case "edit":
      return [
        "✏️ แก้ไข / เลื่อน / ยกเลิกงาน",
        `ทำในเว็บ PR-OS 👉 ${webUrl("/schedule")}`,
        "เลือกงาน → แก้ไข (เลื่อนเวลาได้ทีละ 15/30/60 นาที หรือ 1 วัน)",
        "เมื่อแก้วัน เวลา สถานที่ หรือหน้าที่ ระบบส่งการ์ดสีส้มแจ้งคนในงานเอง",
        "ยังไม่มีบัญชีเว็บ แจ้งแอดมินให้แก้แทนได้ครับ",
      ].join("\n");
    case "monitor":
      return [
        "📺 จอทีวีงาน ปชส.",
        `ดูได้ทั้งทีวีและมือถือ 👉 ${webUrl("/tv")}`,
        "🔄 อัปเดตเองทุก 1 นาที",
        '📢 ขึ้นข้อความวิ่ง: พิมพ์ "ประกาศ ข้อความ"',
      ].join("\n");
  }
}

export function faqMessage(topic: FaqTopic, inGroup: boolean): LineMessage {
  return { type: "text", text: faqText(topic, inGroup) };
}
