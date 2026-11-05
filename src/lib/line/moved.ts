// "น้อง ๆ ยังเข้าใจว่าใช้ LINE อยู่" (owner, 5 Nov 2026): anyone who has already
// moved to Telegram and types to the LINE bot gets pointed there. A reply, so it
// costs no LINE quota. "ผูก Telegram" and a pending "ไม่สะดวก" reason still work.

export function movedToTelegramText(callName: string, botUsername: string | null): string {
  return [
    `✈️ ${callName} ย้ายไปใช้ Telegram แล้วนะครับ`,
    "งานใหม่ · รับทราบ · ไม่สะดวก · เพิ่มงาน · แนบไฟล์ · ส่งมุก — ทำใน Telegram ทั้งหมด",
    "",
    botUsername ? `👉 เปิดบอท: https://t.me/${botUsername}` : '👉 เปิดแอป Telegram แล้วเข้าแชท "ผู้ช่วยงาน ปชส."',
    "💬 พิมพ์ถามบอทแบบพูดธรรมดาได้เลย เช่น \"พรุ่งนี้มีงานไหม\"",
  ].join("\n");
}

/** Has this person moved to Telegram (linked a chat)? */
export const movedToTelegram = (p: { telegramChatId?: number | null } | null | undefined): boolean => Boolean(p?.telegramChatId);
