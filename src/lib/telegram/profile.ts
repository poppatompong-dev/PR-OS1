// What people see on the bot's Telegram profile (owner, 29 Oct 2026: "น่าเชื่อถือ
// ทันสมัย" · tone ทางการ-ทันสมัย). Applied by /api/telegram/setup.
// Every line must stay true of the system; no claims it cannot back.

/** The empty-chat screen before someone presses Start. Telegram allows 512. */
export const BOT_DESCRIPTION = [
  "🏛 ผู้ช่วยงานประชาสัมพันธ์ เทศบาลนครนครสวรรค์",
  "ระบบ PR-OS สำหรับเจ้าหน้าที่",
  "",
  "⚡ แจ้งงานทันทีที่ได้รับมอบหมาย",
  "✅ กดรับทราบ / ไม่สะดวก ได้ในแชท",
  "⏰ เตือนก่อนเริ่มงาน 1 ชม. 30 นาที",
  "☀️ สรุปงานทุกเช้า 07:00",
  "📺 เชื่อมจอทีวีห้อง ปชส. แบบเรียลไทม์",
  "🔒 ยืนยันตัวตนทุกคำสั่ง · เฉพาะเจ้าหน้าที่",
  "",
  'กด "เริ่ม" แล้วผูกบัญชีจาก LINE "ผู้ช่วยงาน ปชส."',
].join("\n");

/** "About" on the profile and in shares. Telegram allows 120. */
export const BOT_SHORT_DESCRIPTION = "ระบบแจ้งงานอัตโนมัติ งานประชาสัมพันธ์ เทศบาลนครนครสวรรค์ · แจ้งทันที · เชื่อมจอทีวี · ปลอดภัย";

export const BOT_COMMANDS = [
  { command: "add", description: "➕ เพิ่มงาน" },
  { command: "my", description: "📋 งานของฉัน" },
  { command: "today", description: "👥 งานของทีมวันนี้" },
  { command: "help", description: "❓ วิธีใช้" },
  { command: "stop", description: "🔕 กลับไปรับแจ้งทาง LINE" },
];

/** Profile pictures drawn for the bot; /api/telegram/setup?photo=a|b|c uploads one. */
export const BOT_PHOTOS = { a: "/bot-avatar-a.jpg", b: "/bot-avatar-b.jpg", c: "/bot-avatar-c.jpg" } as const;
export type BotPhoto = keyof typeof BOT_PHOTOS;
