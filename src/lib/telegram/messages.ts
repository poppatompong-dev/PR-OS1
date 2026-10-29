// Every message the Telegram bot sends (owner, 29 Oct 2026). Same content and
// the same rules as the LINE cards (lib/line/messages.ts): never internal notes,
// phone numbers or attachments; every push names the event and the date.
// Telegram can edit a card after a tap, so the card itself changes to
// "รับทราบแล้ว" instead of a second status card being sent.

import { formatThaiDate } from "@/lib/format";
import type { TaskItem } from "@/lib/line/data";
import { ackLabelFor, type FieldChange } from "@/lib/line/change-diff";
import { COMMANDS, UNAVAILABLE_PRESETS, appUrl, bangkokHhmm, type BubbleKind, type StatusKind } from "@/lib/line/messages";
import { esc, type TgButton, type TgMessage } from "@/lib/telegram/api";

/** Callback data, under Telegram's 64-byte limit (a UUID is 36). */
export const cb = {
  ack: (t: TaskItem) => `a|${t.assignmentId}|${t.assignmentVersion}`,
  unavailable: (t: TaskItem) => `u|${t.assignmentId}`,
  reason: (assignmentId: string, i: number) => `r|${assignmentId}|${i}`,
  typeReason: (assignmentId: string) => `rt|${assignmentId}`,
  cancelReason: (assignmentId: string) => `rc|${assignmentId}`,
  avatarOk: "av|ok",
  avatarOff: "av|off",
  avatarPhoto: "av|photo",
};

export function parseCb(data: string): { a: string; id?: string; v?: string } {
  const [a, id, v] = data.split("|");
  return { a, id, v };
}

/** The buttons under the typing box. */
export const KEYBOARD: string[][] = [
  [COMMANDS.mine, COMMANDS.today],
  [COMMANDS.tomorrow, COMMANDS.pending],
  ["รูปของฉัน", COMMANDS.help],
];

function when(t: TaskItem): string {
  const time = t.event.endTime ? `${t.event.startTime}–${t.event.endTime}` : t.event.startTime;
  return `${formatThaiDate(t.event.eventDate)} · ${time} น.`;
}

const HEADINGS: Record<BubbleKind, string> = {
  assignment: "🟣 <b>มอบหมายงานใหม่</b>",
  change: "🟠 <b>งานเปลี่ยน · ข้อความนี้แทนข้อความก่อนหน้า</b>",
  reminder: "🔴 <b>อีกประมาณ 1 ชม. 30 นาที เริ่มงาน</b>",
  list: "🟣 <b>งานของคุณ</b>",
};

function statusText(t: TaskItem): string {
  if (t.acknowledged) return "✅ <b>รับทราบแล้ว</b>";
  if (t.unavailable) return `⛔ <b>แจ้งไม่สะดวกแล้ว</b>: ${esc(t.unavailableReason ?? "")}`;
  return "⏳ ยังไม่รับทราบ";
}

function details(t: TaskItem, skip: Set<string> = new Set()): string[] {
  const lines: string[] = [];
  if (!skip.has("date") && !skip.has("start") && !skip.has("end")) lines.push(`🗓 ${esc(when(t))}`);
  else if (!skip.has("date")) lines.push(`🗓 ${esc(formatThaiDate(t.event.eventDate))}`);
  else if (!skip.has("start") && !skip.has("end")) lines.push(`🕘 ${esc(t.event.endTime ? `${t.event.startTime}–${t.event.endTime}` : t.event.startTime)} น.`);
  if (!skip.has("location")) lines.push(`📍 ${esc(t.event.locationName)}`);
  if (!skip.has("role")) lines.push(`👤 หน้าที่: ${esc(t.roleName)}`);
  if (t.event.shortNote) lines.push(`📝 ${esc(t.event.shortNote)}`);
  return lines;
}

/** The job card with รับทราบ / ไม่สะดวก, or (after a tap) the same card with its new status and no buttons. */
export function tgTask(t: TaskItem, kind: BubbleKind, changes: FieldChange[] = [], reason: string | null = null, savedAt?: Date): TgMessage {
  const changed = new Set(kind === "change" ? changes.map((c) => c.field) : []);
  const lines = [HEADINGS[kind], "", `<b>${esc(t.event.title)}</b>`];
  if (kind === "change" && (changes.length || reason)) {
    lines.push("");
    for (const c of changes) lines.push(`${esc(c.label)}: <s>${esc(c.from)}</s> → <b>${esc(c.to)}</b>`);
    if (reason) lines.push(`เหตุผล: ${esc(reason)}`);
  }
  lines.push("", ...details(t, changed));
  if (kind === "list" || t.acknowledged || t.unavailable) {
    lines.push("", statusText(t) + (savedAt ? ` · บันทึกเมื่อ ${bangkokHhmm(savedAt)} น.` : ""));
  }
  const buttons: TgButton[][] = [];
  if (!t.acknowledged && t.event.status === "published") {
    const row: TgButton[] = [{ text: `✅ ${kind === "change" ? ackLabelFor(changes) : "รับทราบ"}`, callback_data: cb.ack(t) }];
    if (!t.unavailable) row.push({ text: "⛔ ไม่สะดวก", callback_data: cb.unavailable(t) });
    buttons.push(row);
  }
  const files = t.event.attachmentCount ?? 0;
  if (files > 0) buttons.push([{ text: `📎 ไฟล์แนบ (${files})`, url: appUrl(`/events/${t.event.id}`) }]);
  if (kind === "change") lines.push("", "<i>ข้อความเก่าของงานนี้ใช้ไม่ได้แล้ว</i>");
  return { text: lines.join("\n"), buttons };
}

/** "ไม่สะดวก" tapped: the same card now asks why. */
export function tgReasonPrompt(t: TaskItem): TgMessage {
  return {
    text: [`⛔ <b>แจ้งไม่สะดวก</b>`, "", `<b>${esc(t.event.title)}</b>`, `🗓 ${esc(when(t))}`, "", "เลือกเหตุผล หรือกด \"พิมพ์เหตุผลเอง\""].join("\n"),
    buttons: [
      ...UNAVAILABLE_PRESETS.map((label, i) => [{ text: label, callback_data: cb.reason(t.assignmentId, i) }]),
      [{ text: "✏️ พิมพ์เหตุผลเอง", callback_data: cb.typeReason(t.assignmentId) }],
      [{ text: "↩️ ยกเลิก (ยังไปได้)", callback_data: cb.cancelReason(t.assignmentId) }],
    ],
  };
}

function notice(head: string, t: TaskItem, lines: string[]): TgMessage {
  return {
    text: [head, "", `<s>${esc(t.event.title)}</s>`, `🗓 เดิม ${esc(when(t))}`, `📍 ${esc(t.event.locationName)}`, "", ...lines.map(esc)].join("\n"),
  };
}

export function tgCancellation(t: TaskItem): TgMessage {
  return notice("❌ <b>ยกเลิกงาน</b>", t, [`เหตุผล: ${t.event.cancellationReason ?? "ไม่ระบุ"}`, "ไม่ต้องไปปฏิบัติงานนี้แล้ว"]);
}

export function tgPostponed(t: TaskItem, reason: string | null): TgMessage {
  return notice("⏸ <b>งานเลื่อนออกไปก่อน · ยังไม่มีวันใหม่</b>", t, [
    `เหตุผล: ${reason ?? "ไม่ระบุ"}`,
    "ยังไม่ต้องไปตามวันเวลาเดิม เมื่อได้วันใหม่ ระบบจะส่งข้อความสีส้มให้กดรับทราบอีกครั้ง",
  ]);
}

export function tgRemoved(t: TaskItem): TgMessage {
  return notice("➖ <b>ถอนชื่อคุณออกจากงานนี้แล้ว</b>", t, [
    "งานนี้ยังมีอยู่ แต่ไม่ต้องไปปฏิบัติแล้ว (หัวหน้าปรับคนรับผิดชอบ)",
    "การเตือนก่อนงานของงานนี้จะไม่ส่งถึงคุณอีก",
  ]);
}

function mark(t: TaskItem) {
  return t.acknowledged ? "✅" : t.unavailable ? "⛔" : "⏳";
}

export function tgDailySummary(personName: string, today: TaskItem[], tomorrow: TaskItem[]): TgMessage {
  const pending = [...today, ...tomorrow].filter((t) => !t.acknowledged && !t.unavailable).length;
  const day = (ts: TaskItem[]) => ts.map((t) => `${mark(t)} ${t.event.startTime} ${esc(t.event.title)} (${esc(t.roleName)}) · ${esc(t.event.locationName)}`);
  const lines = [`☀️ สวัสดีตอนเช้าครับ คุณ${esc(personName)}`];
  if (today.length) lines.push("", `📌 <b>วันนี้</b> (${esc(formatThaiDate(today[0].event.eventDate))})`, ...day(today));
  if (tomorrow.length) lines.push("", `🗓 <b>พรุ่งนี้</b> (${esc(formatThaiDate(tomorrow[0].event.eventDate))})`, ...day(tomorrow));
  lines.push("", pending > 0 ? `ยังไม่รับทราบ ${pending} งาน — กด "${COMMANDS.mine}" เพื่อรับทราบ` : "รับทราบครบทุกงานแล้ว ขอบคุณครับ");
  return { text: lines.join("\n"), keyboard: KEYBOARD };
}

export function tgAdminReport(date: string, pending: TaskItem[], unavailable: TaskItem[], failedToday = 0): TgMessage {
  const lines = [`📋 <b>งานพรุ่งนี้ ${esc(formatThaiDate(date))}</b>`];
  if (pending.length) {
    lines.push("", `⏳ ยังไม่รับทราบ ${pending.length} รายการ`);
    for (const t of pending) {
      const where = t.telegramChatId ? "" : t.lineUserId ? " (LINE)" : " (ยังไม่ผูกแชท)";
      lines.push(`• ${esc(t.personName)}${where} — ${t.event.startTime} ${esc(t.event.title)}`);
    }
  }
  if (unavailable.length) {
    lines.push("", `⛔ แจ้งไม่สะดวก ยังไม่ได้หาคนแทน ${unavailable.length} รายการ`);
    for (const t of unavailable) lines.push(`• ${esc(t.personName)} — ${t.event.startTime} ${esc(t.event.title)} (${esc(t.unavailableReason ?? "ไม่ระบุ")})`);
  }
  if (failedToday > 0) lines.push("", `⚠️ วันนี้ส่งแจ้งเตือนไม่สำเร็จ ${failedToday} ข้อความ (ลองซ้ำแล้ว) — ดูที่หน้าตั้งค่า`);
  return { text: lines.join("\n") };
}

export function tgUnavailableAlert(t: TaskItem): TgMessage {
  return {
    text: [
      "🚨 <b>แจ้งไม่สะดวก — ต้องหาคนแทน</b>",
      "",
      `<b>${esc(t.event.title)}</b>`,
      `ผู้แจ้ง: ${esc(t.personName)} (${esc(t.roleName)})`,
      `🗓 ${esc(when(t))}`,
      `เหตุผล: ${esc(t.unavailableReason ?? "ไม่ระบุ")}`,
    ].join("\n"),
    buttons: [[{ text: "เปิดงานในระบบ", url: appUrl(`/events/${t.event.id}`) }]],
  };
}

export const STATUS_TOAST: Record<StatusKind, string> = {
  acked: "✅ รับทราบแล้ว บันทึกในระบบเรียบร้อย",
  already_acked: "✅ งานนี้รับทราบไว้แล้ว",
  unavailable: "⛔ แจ้งไม่สะดวกแล้ว ส่งถึงแอดมินแล้ว",
  already_unavailable: "⛔ งานนี้แจ้งไม่สะดวกไว้แล้ว",
};

/** Team / personal lists: the LINE text, made safe for Telegram HTML. */
export function tgFromLineText(text: string): TgMessage {
  return { text: esc(text), keyboard: KEYBOARD };
}

export function tgHelp(): TgMessage {
  return {
    text: [
      "🤖 <b>ผู้ช่วยงาน ปชส.</b> ตอบได้ตามนี้ครับ",
      "",
      `👤 <b>ของฉัน</b>`,
      `• "${COMMANDS.mine}" — งานของคุณ 7 วันข้างหน้า พร้อมปุ่มรับทราบ / ไม่สะดวก`,
      `• "รูปของฉัน" — ดูรูปการ์ตูนของคุณที่ใช้บนจอ`,
      "",
      `👥 <b>ของทีม</b>`,
      `• "${COMMANDS.today}" / "${COMMANDS.tomorrow}" — ใครไปงานไหน`,
      `• "${COMMANDS.pending}" — ใครยังไม่กดรับทราบ`,
      "",
      `📢 <b>ประกาศบนจอทีวี</b>: พิมพ์ "ประกาศ ข้อความ" เช่น ประกาศ พรุ่งนี้ประชุม 9 โมง ห้อง 1`,
      "",
      `แก้ไขงาน แนบไฟล์ และดูรายงาน ทำในเว็บ PR-OS 👉 ${esc(appUrl("/"))}`,
      `เลิกรับแจ้งทาง Telegram (กลับไปใช้ LINE): พิมพ์ /stop`,
    ].join("\n"),
    keyboard: KEYBOARD,
  };
}

export function tgLinked(name: string): TgMessage {
  return {
    text: [
      `✅ ผูก Telegram กับ PR-OS แล้วครับ คุณ${esc(name)}`,
      "",
      "จากนี้แจ้งเตือนงานทั้งหมดจะมาที่นี่แทน LINE",
      "กดปุ่มด้านล่าง หรือพิมพ์ \"วิธีใช้\" ดูคำสั่งได้",
    ].join("\n"),
    keyboard: KEYBOARD,
  };
}

export function tgNotLinked(): TgMessage {
  return {
    text: [
      "ยังไม่ได้ผูก Telegram นี้กับ PR-OS ครับ",
      "",
      "วิธีผูก: ในแชท LINE \"ผู้ช่วยงาน ปชส.\" พิมพ์ <b>ผูก Telegram</b>",
      "บอทจะส่งลิงก์มา กดลิงก์แล้วกด Start ครั้งเดียวก็เสร็จ",
    ].join("\n"),
  };
}
