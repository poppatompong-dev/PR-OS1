// Every message the Telegram bot sends (owner, 29 Oct 2026). Same content and
// the same rules as the LINE cards (lib/line/messages.ts): never internal notes,
// phone numbers or attachments; every push names the event and the date.
// Telegram can edit a card after a tap, so the card itself changes to
// "รับทราบแล้ว" instead of a second status card being sent.

import { formatThaiDate } from "@/lib/format";
import { dailyTip, roleKey, titleFor } from "@/lib/telegram/chat";
import type { TaskItem } from "@/lib/line/data";
import { ackLabelFor, type FieldChange } from "@/lib/line/change-diff";
import { COMMANDS, UNAVAILABLE_PRESETS, appUrl, bangkokHhmm, type BubbleKind, type StatusKind } from "@/lib/line/messages";
import { esc, type TgButton, type TgMessage } from "@/lib/telegram/api";
import { callName, shortName } from "@/lib/names";
import { jobIcon } from "@/lib/events/job-icon";
import { pointButton, pointNavUrl } from "@/lib/maps";

/** The job type at a glance, e.g. 🚴 for a cycling event. */
const ic = (e: { title: string; icon?: string | null }) => jobIcon(e.title, e.icon).emoji;

/** "พฤ. 30 ต.ค." — lists have no room for the year. */
function dayShort(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00+07:00`));
}

/** Adds blocks until Telegram's limit is near, never cutting through an HTML tag. */
function fit(head: string[], blocks: string[][], tail: string[] = []): string {
  const out = [...head];
  let used = head.join("\n").length + tail.join("\n").length + 40;
  let shown = 0;
  for (const b of blocks) {
    const add = b.join("\n").length + 1;
    if (used + add > 3900) break;
    out.push(...b);
    used += add;
    shown++;
  }
  if (shown < blocks.length) out.push("", `… และอีก ${blocks.length - shown} งาน`);
  return [...out, ...tail].join("\n");
}

const MARK_LEGEND = "<i>✅ รับทราบ · ⏳ รอ · ⛔ ไม่สะดวก</i>";

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

/** Opens the add-job form inside Telegram (Mini App); the form checks Telegram's signature. */
export function addEventButton(): TgButton {
  return { text: "➕ เพิ่มงาน", web_app: { url: appUrl("/liff/add-event?tg=1") } };
}

/** รายการงาน: see / edit / publish / put on hold / cancel / delete (owner, 30 Oct 2026). */
export function jobsButton(): TgButton {
  return { text: "📋 รายการงาน · แก้ไข", web_app: { url: appUrl("/liff/add-event/jobs?tg=1") } };
}

export function tgAddEvent(): TgMessage {
  return {
    text: "📝 <b>เพิ่มงาน</b>\nกดปุ่มด้านล่าง กรอกแล้วกดบันทึก 👇",
    buttons: [[addEventButton()], [jobsButton()]],
  };
}

export function tgJobs(): TgMessage {
  return {
    text: ["📋 <b>รายการงาน</b>", "ดูงานทั้งหมด · ✏️ แก้ไข · 📢 เผยแพร่ · ⏸ เลื่อน · ✖️ ยกเลิก", "แก้วัน/เวลา/สถานที่ → ทีมได้การ์ดสีส้มเอง 👇"].join("\n"),
    buttons: [[jobsButton()], [addEventButton()]],
  };
}

/** The buttons under the typing box. */
export const KEYBOARD: string[][] = [
  [COMMANDS.mine, COMMANDS.today],
  [COMMANDS.tomorrow, COMMANDS.pending],
  ["📋 รายการงาน", "🖼 เปลี่ยนรูป", COMMANDS.help],
];

function when(t: TaskItem): string {
  const time = t.event.endTime ? `${t.event.startTime}–${t.event.endTime}` : t.event.startTime;
  return `${formatThaiDate(t.event.eventDate)} · ${time} น.`;
}

const HEADINGS: Record<BubbleKind, string> = {
  assignment: "🟣 <b>มอบหมายงานใหม่</b>",
  change: "🟠 <b>งานเปลี่ยน</b> · ใช้ข้อความนี้แทนอันเก่า",
  reminder: "⏰ <b>อีก 1 ชม. 30 นาที เริ่มงาน</b>",
  list: "",
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
  if (!skip.has("role")) lines.push(`👤 ${esc(t.roleName)}`);
  if (t.event.shortNote) lines.push(`📝 ${esc(t.event.shortNote)}`);
  return lines;
}

/** The job card with รับทราบ / ไม่สะดวก, or (after a tap) the same card with its new status and no buttons. */
export function tgTask(t: TaskItem, kind: BubbleKind, changes: FieldChange[] = [], reason: string | null = null, savedAt?: Date): TgMessage {
  const changed = new Set(kind === "change" ? changes.map((c) => c.field) : []);
  const lines = HEADINGS[kind] ? [HEADINGS[kind], ""] : [];
  lines.push(`${ic(t.event)} <b>${esc(t.event.title)}</b>`);
  if (kind === "change" && (changes.length || reason)) {
    for (const c of changes) lines.push(`✏️ ${esc(c.label)}: <s>${esc(c.from)}</s> → <b>${esc(c.to)}</b>`);
    if (reason) lines.push(`💬 ${esc(reason)}`);
  }
  lines.push(...details(t, changed));
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
  // พิกัด (3 Nov 2026): 🧭 straight to directions for each pin (two per row), and
  // 🗺️ the map page with every pin, its name and coordinates, and where I am.
  const pts = t.event.status === "published" ? (t.event.mapPoints ?? []) : [];
  const nav: TgButton[] = pts.map((p, i) => ({ text: pointButton(p, i, pts.length), url: pointNavUrl(p) }));
  for (let i = 0; i < nav.length; i += 2) buttons.push(nav.slice(i, i + 2));
  const extra: TgButton[] = [];
  if (pts.length) extra.push({ text: `🗺️ ดูพิกัด${pts.length > 1 ? ` (${pts.length} จุด)` : ""}`, web_app: { url: appUrl(`/liff/add-event/map?tg=1&e=${t.event.id}`) } });
  // Opens inside Telegram (no web login needed) — 5 Nov 2026.
  if (files > 0) extra.push({ text: `📎 ไฟล์แนบ (${files})`, web_app: { url: appUrl(`/liff/add-event/files?tg=1&e=${t.event.id}`) } });
  if (extra.length) buttons.push(extra);
  return { text: lines.join("\n"), buttons };
}

/** "ไม่สะดวก" tapped: the same card now asks why. */
export function tgReasonPrompt(t: TaskItem): TgMessage {
  return {
    text: [`⛔ <b>แจ้งไม่สะดวก</b>`, "", `${ic(t.event)} <b>${esc(t.event.title)}</b>`, `🗓 ${esc(when(t))}`, "", "เลือกเหตุผล 👇"].join("\n"),
    buttons: [
      ...UNAVAILABLE_PRESETS.map((label, i) => [{ text: label, callback_data: cb.reason(t.assignmentId, i) }]),
      [{ text: "✏️ พิมพ์เหตุผลเอง", callback_data: cb.typeReason(t.assignmentId) }],
      [{ text: "↩️ ยกเลิก (ยังไปได้)", callback_data: cb.cancelReason(t.assignmentId) }],
    ],
  };
}

function notice(head: string, t: TaskItem, lines: string[]): TgMessage {
  return {
    text: [head, "", `<s>${esc(t.event.title)}</s>`, `🗓 ${esc(when(t))}`, `📍 ${esc(t.event.locationName)}`, "", ...lines.map(esc)].join("\n"),
  };
}

export function tgCancellation(t: TaskItem): TgMessage {
  return notice("❌ <b>ยกเลิกงาน</b>", t, [`💬 ${t.event.cancellationReason ?? "ไม่ระบุเหตุผล"}`, "🙅 ไม่ต้องไปแล้ว"]);
}

export function tgPostponed(t: TaskItem, reason: string | null): TgMessage {
  return notice("⏸ <b>เลื่อนงาน</b> · ยังไม่มีวันใหม่", t, [
    `💬 ${reason ?? "ไม่ระบุเหตุผล"}`,
    "🙅 ยังไม่ต้องไป · ได้วันใหม่จะแจ้งอีกครั้ง",
  ]);
}

export function tgRemoved(t: TaskItem): TgMessage {
  return notice("➖ <b>ถอนชื่อคุณออกจากงานนี้</b>", t, [
    "🙅 ไม่ต้องไปแล้ว · จะไม่มีเตือนก่อนงานนี้",
  ]);
}

function mark(t: TaskItem) {
  return t.acknowledged ? "✅" : t.unavailable ? "⛔" : "⏳";
}

export function tgDailySummary(personName: string, today: TaskItem[], tomorrow: TaskItem[]): TgMessage {
  const pending = [...today, ...tomorrow].filter((t) => !t.acknowledged && !t.unavailable).length;
  const day = (ts: TaskItem[]) => ts.map((t) => `${mark(t)} <b>${t.event.startTime}</b> ${ic(t.event)} ${esc(t.event.title)}\n      📍 ${esc(t.event.locationName)} · 👤 ${esc(t.roleName)}`);
  const first = today[0] ?? tomorrow[0];
  const lines = [`☀️ อรุณสวัสดิ์ครับ ${esc(first ? titleFor(first.personId, personName) : callName(personName))}`];
  if (today.length) lines.push("", `📌 <b>วันนี้</b> · ${esc(dayShort(today[0].event.eventDate))}`, ...day(today));
  if (tomorrow.length) lines.push("", `🗓 <b>พรุ่งนี้</b> · ${esc(dayShort(tomorrow[0].event.eventDate))}`, ...day(tomorrow));
  lines.push("", pending > 0 ? `⏳ ยังไม่รับทราบ ${pending} งาน → กด "${COMMANDS.mine}"` : "✅ รับทราบครบแล้ว ขอบคุณครับ 🙏");
  // ทิปส่วนตัว 1 บรรทัด (5 Nov 2026): rides on this message, never a message of its own.
  const role = first ? roleKey(first.roleName) : null;
  if (role && first) lines.push(`💡 ${esc(dailyTip(role, first.event.eventDate))}`);
  return { text: lines.join("\n"), keyboard: KEYBOARD };
}

export function tgAdminReport(date: string, pending: TaskItem[], unavailable: TaskItem[], failedToday = 0): TgMessage {
  const lines = [`📋 <b>รายงานงานพรุ่งนี้</b> · ${esc(dayShort(date))}`];
  if (pending.length) {
    lines.push("", `⏳ ยังไม่รับทราบ ${pending.length} รายการ`);
    for (const t of pending) {
      const where = t.telegramChatId ? "" : t.lineUserId ? " (LINE)" : " (ยังไม่ผูกแชท)";
      lines.push(`• ${esc(shortName(t.personName))}${where} — ${t.event.startTime} ${esc(t.event.title)}`);
    }
  }
  if (unavailable.length) {
    lines.push("", `⛔ ไม่สะดวก ยังไม่มีคนแทน ${unavailable.length} รายการ`);
    for (const t of unavailable) lines.push(`• ${esc(shortName(t.personName))} — ${t.event.startTime} ${esc(t.event.title)} (${esc(t.unavailableReason ?? "ไม่ระบุ")})`);
  }
  if (failedToday > 0) lines.push("", `⚠️ ส่งแจ้งเตือนไม่สำเร็จวันนี้ ${failedToday} ข้อความ → ดูหน้าตั้งค่า`);
  return { text: lines.join("\n") };
}

export function tgUnavailableAlert(t: TaskItem): TgMessage {
  return {
    text: [
      "🚨 <b>ไม่สะดวก · ต้องหาคนแทน</b>",
      "",
      `${ic(t.event)} <b>${esc(t.event.title)}</b>`,
      `🗓 ${esc(when(t))}`,
      `👤 ${esc(shortName(t.personName))} · ${esc(t.roleName)}`,
      `💬 ${esc(t.unavailableReason ?? "ไม่ระบุเหตุผล")}`,
    ].join("\n"),
    buttons: [[{ text: "🔎 เปิดงานในระบบ", url: appUrl(`/events/${t.event.id}`) }]],
  };
}

export const STATUS_TOAST: Record<StatusKind, string> = {
  acked: "✅ รับทราบแล้ว",
  already_acked: "✅ งานนี้รับทราบไว้แล้ว",
  unavailable: "⛔ แจ้งไม่สะดวกแล้ว · ส่งถึงแอดมินแล้ว",
  already_unavailable: "⛔ งานนี้แจ้งไม่สะดวกไว้แล้ว",
};

/** Team / personal lists: the LINE text, made safe for Telegram HTML. */
export function tgFromLineText(text: string): TgMessage {
  return { text: esc(text), keyboard: KEYBOARD };
}

function helpLines(): string[] {
  return [
    `📋 <b>รายการงาน</b> → ปุ่ม "งาน" ซ้ายล่าง: ดู · เพิ่ม · ✏️ แก้ · ยกเลิก`,
    `📋 <b>${COMMANDS.mine}</b> → รับทราบ / ไม่สะดวก`,
    `👥 <b>${COMMANDS.today}</b> · <b>${COMMANDS.tomorrow}</b> · <b>${COMMANDS.pending}</b>`,
    `📢 <b>ประกาศ</b> ข้อความ → ขึ้นจอทีวี`,
    `      เช่น <code>ประกาศ ประชุม 9 โมง ห้อง 1</code>`,
    `😂 <b>มุก</b> → ส่งมุกให้ตัวการ์ตูนเล่าบนจอ · 🎬 <b>ไอเดีย</b> → เสนอเรื่องแก็ก`,
    `🖼 <b>เปลี่ยนรูป</b> · ✨ <b>ขอลุค</b> → ลุค/ฉายาพิเศษ`,
    `💬 ถามแบบพูดธรรมดาได้: "พรุ่งนี้มีงานไหม" "ใครไปด้วย" "ทิปพิธีกร"`,
    "",
    `🌐 รายงาน · ตั้งค่า → <a href="${esc(appUrl("/"))}">เว็บ PR-OS</a>`,
  ];
}

export function tgHelp(): TgMessage {
  return {
    text: ["🤖 <b>ใช้งานผู้ช่วยงาน ปชส.</b>", "", ...helpLines(), "🧭 ดูทีละเรื่อง → พิมพ์ <b>ทัวร์</b>", `🔕 กลับไปใช้ LINE → /stop`].join("\n"),
    keyboard: KEYBOARD,
  };
}

/** One message on linking: hello + what to tap. */
export function tgLinked(name: string): TgMessage {
  return {
    text: [`✅ <b>ผูกสำเร็จ</b> · สวัสดีครับ ${esc(callName(name))}`, "🔔 จากนี้แจ้งเตือนงานมาที่นี่แทน LINE"].join("\n"),
    keyboard: KEYBOARD,
  };
}

export function tgNotLinked(): TgMessage {
  return {
    text: [
      "👋 <b>ยังไม่ได้ผูก Telegram กับ PR-OS</b>",
      "",
      `1️⃣ เปิดแชท LINE "ผู้ช่วยงาน ปชส."`,
      "2️⃣ พิมพ์ <b>ผูก Telegram</b>",
      "3️⃣ กดลิงก์ที่ได้ → กด Start",
    ].join("\n"),
  };
}

/** Team view of one day, grouped by job; first names only. */
export function tgTeamDay(label: string, date: string, tasks: TaskItem[]): TgMessage {
  const head = `👥 <b>${esc(label)}</b> · ${esc(dayShort(date))}`;
  if (tasks.length === 0) return { text: `${head}\n\n🌤 ยังไม่มีงาน`, keyboard: KEYBOARD };
  const byEvent = new Map<string, TaskItem[]>();
  for (const t of tasks) byEvent.set(t.event.id, [...(byEvent.get(t.event.id) ?? []), t]);
  const blocks = [...byEvent.values()].map((group) => {
    const e = group[0].event;
    return [
      "",
      `${ic(e)} <b>${e.startTime}${e.endTime ? `–${e.endTime}` : ""}</b> ${esc(e.title)}`,
      `📍 ${esc(e.locationName)}`,
      ...group.map((t) => `      ${mark(t)} ${esc(shortName(t.personName))} · ${esc(t.roleName)}`),
    ];
  });
  return { text: fit([`${head} · ${byEvent.size} งาน`], blocks, ["", MARK_LEGEND]), keyboard: KEYBOARD };
}

/** Who has not tapped รับทราบ yet, by job. */
export function tgPendingTeam(tasks: TaskItem[]): TgMessage {
  if (tasks.length === 0) return { text: "✅ ทุกคนรับทราบงาน 7 วันข้างหน้าครบแล้ว 👍", keyboard: KEYBOARD };
  const byEvent = new Map<string, TaskItem[]>();
  for (const t of tasks) byEvent.set(t.event.id, [...(byEvent.get(t.event.id) ?? []), t]);
  const blocks = [...byEvent.values()].map((group) => {
    const e = group[0].event;
    return [
      "",
      `${ic(e)} <b>${esc(dayShort(e.eventDate))} ${e.startTime}</b> ${esc(e.title)}`,
      `      ${group.map((t) => `${esc(shortName(t.personName))}${t.unavailable ? " ⛔" : ""}`).join(", ")}`,
    ];
  });
  return { text: fit([`⏳ <b>ยังไม่รับทราบ</b> · 7 วันข้างหน้า · ${tasks.length} รายการ`], blocks), keyboard: KEYBOARD };
}

// ---- Welcome tour (owner, 29 Oct 2026: "ทำความเข้าใจในเทเลแกรมอีกรอบ") ----------
// One message that turns its own pages (editMessageText), so the chat does not
// fill up. Page 2 has a sample card whose buttons only answer with a toast.

const DEMO_CARD = [
  "┈┈┈┈ ตัวอย่าง ┈┈┈┈",
  "🟣 <b>มอบหมายงานใหม่</b>",
  "",
  "🚴 <b>ปั่นจักรยานรอบบึงบอระเพ็ด</b>",
  "🗓 ส. 1 พ.ย. 2569 · 07:00 น.",
  "📍 สวนสาธารณะบึงบอระเพ็ด",
  "👤 ถ่ายภาพนิ่ง",
  "┈┈┈┈┈┈┈┈┈┈┈┈┈┈",
];

export const TOUR_PAGES: string[] = [
  [
    "👋 <b>ยินดีต้อนรับสู่ PR-OS</b>",
    "",
    "✈️ Telegram นี้คือช่องทางหลักของทีม ปชส.",
    "📩 งานที่ได้รับมอบหมายจะเด้งมาที่นี่",
    "🧪 ช่วงทดลองใช้: งานในระบบเป็นงานจริง ไม่แน่ใจถามแอดมินได้",
    "",
    "มี 4 เรื่องสั้น ๆ กด <b>ต่อไป ▶</b>",
  ].join("\n"),
  [
    "📩 <b>1/4 · รับงาน</b>",
    "",
    ...DEMO_CARD,
    "",
    "👤 = หน้าที่ของคุณในงานนั้น",
    "✅ ได้งาน → กด <b>รับทราบ</b> ให้เร็วที่สุด",
    "⛔ ไปไม่ได้ → กด <b>ไม่สะดวก</b> + เหตุผล → แอดมินหาคนแทน",
    "",
    "👇 ลองกดปุ่มตัวอย่างดูได้ (ไม่บันทึกจริง)",
  ].join("\n"),
  [
    "🔔 <b>2/4 · ข้อความที่จะได้รับ</b>",
    "",
    "🟣 งานใหม่ → กดรับทราบ",
    "🟠 งานเปลี่ยน → กดรับทราบใหม่",
    "❌ ยกเลิกงาน → ไม่ต้องไป",
    "⏰ เตือนก่อนเริ่มงาน 1 ชม. 30 นาที",
    "☀️ สรุปงานตอน 07:00 (เฉพาะวันที่มีงาน)",
  ].join("\n"),
  [
    "➕ <b>3/4 · ทำเองได้ในแชทนี้</b>",
    "",
    "➕ ปุ่ม <b>เพิ่มงาน</b> ซ้ายล่าง → กรอก → บันทึก",
    "📢 พิมพ์ <code>ประกาศ ข้อความ</code> → ขึ้นจอทีวีถึงเที่ยงคืน",
    "🖼 พิมพ์ <b>รูปของฉัน</b> → ดูรูปการ์ตูนบนจอ",
    "",
    "⌨️ ปุ่มใต้ช่องพิมพ์: งานของฉัน · ทีมวันนี้ · ทีมพรุ่งนี้ · ใครยังไม่รับทราบ",
  ].join("\n"),
  [
    "🧭 <b>4/4 · ช่องทางอื่น</b>",
    "",
    "✈️ Telegram (ที่นี่) → รับงาน กดรับทราบ เพิ่มงาน",
    "👥 กลุ่ม LINE → ถามตอบเท่านั้น",
    "📺 จอทีวีห้อง ปชส. → ภาพรวมงานของทีม",
    "🌐 เว็บ PR-OS → แก้งาน แนบไฟล์ (คนที่มีบัญชี)",
    "",
    "🔕 งานจะมาที่ Telegram ที่เดียว ไม่ซ้ำใน LINE",
  ].join("\n"),
];

export function tgTour(page: number): TgMessage {
  const i = Math.max(0, Math.min(TOUR_PAGES.length - 1, Math.trunc(page) || 0));
  const nav: TgButton[] = [];
  if (i > 0) nav.push({ text: "◀ ย้อน", callback_data: `t|${i - 1}` });
  nav.push(i < TOUR_PAGES.length - 1 ? { text: "ต่อไป ▶", callback_data: `t|${i + 1}` } : { text: "✅ เข้าใจแล้ว", callback_data: "t|done" });
  const buttons: TgButton[][] = [];
  if (i === 1) buttons.push([{ text: "✅ รับทราบ", callback_data: "t|demo" }, { text: "⛔ ไม่สะดวก", callback_data: "t|demo" }]);
  buttons.push(nav);
  return { text: TOUR_PAGES[i], buttons };
}

export function tgTourDone(): TgMessage {
  return { text: "🎉 <b>พร้อมใช้งานแล้ว</b>\nงานใหม่จะเด้งมาที่นี่ · ดูอีกครั้งพิมพ์ <b>ทัวร์</b> · ติดขัดพิมพ์ <b>วิธีใช้</b>\n🧪 ช่วงทดลอง: พิมพ์ <b>ภารกิจ</b> ดูสิ่งที่ควรลอง" };
}

// ---- ภารกิจทดสอบ (lib/trial.ts) ---------------------------------------------------

export function tgTrial(done: Set<string>, steps: ReadonlyArray<{ key: string; label: string; how: string }>, greetName?: string): TgMessage {
  const lines = [
    ...(greetName
      ? [`👋 ${esc(callName(greetName))} ย้ายมา Telegram แล้ว ขอบคุณครับ 🙏`, `เหลืออีกนิด ลองให้คล่องก่อนรับงานจริง (~3 นาที)`, ""]
      : []),
    `🧪 <b>ภารกิจทดสอบ</b> · ${done.size}/${steps.length}`,
    "",
  ];
  for (const s of steps) lines.push(`${done.has(s.key) ? "✅" : "⬜"} <b>${esc(s.label)}</b>`, `      ${esc(s.how)}`);
  lines.push("", done.size >= steps.length ? "🎉 ครบแล้ว ขอบคุณครับ!" : "บอทติ๊กให้เอง · ดูความคืบหน้าพิมพ์ <b>ภารกิจ</b>");
  return { text: lines.join("\n"), buttons: done.size >= steps.length ? [] : [[{ text: "▶ เริ่มทัวร์", callback_data: "t|0" }]] };
}

/** "รูปการ์ตูนใหม่เสร็จแล้ว": sent by the admin's button once a redraw is live (owner, 2 Nov 2026). */
export function tgAvatarReady(name: string, photoUrl: string): TgMessage {
  return {
    photo: photoUrl,
    text: [`🎨 <b>รูปการ์ตูนใหม่ของ${esc(callName(name))}เสร็จแล้ว</b>`, "ขึ้นจอทีวีและในระบบแล้ว · ชอบไหมครับ? 👇"].join("\n"),
    buttons: [
      [{ text: "👍 ใช้รูปนี้", callback_data: cb.avatarOk }, { text: "🚫 ไม่ใช้รูป", callback_data: cb.avatarOff }],
      [{ text: "📷 ส่งรูปให้ทำใหม่", callback_data: cb.avatarPhoto }],
    ],
  };
}

export function tgTrialComplete(): TgMessage {
  return { text: "🎉 <b>ภารกิจทดสอบครบ 4/4</b>\nพร้อมรับงานจริงแล้ว ขอบคุณครับ 🙏" };
}

// ---- คู่มือหัวหน้า / ผู้ติดตามงาน (owner, 12 Nov 2026: "ควรมีน้องบอทคอยดูแลสื่อสาร
// การใช้งานระบบเบื้องต้น" for the new head of section). Sent right after linking
// when the person is an admin recipient; "คู่มือ" shows it again. Polite voice.
export function tgHeadGuide(name: string, pulse: TgButton[][]): TgMessage {
  return {
    text: [
      `🎬 <b>คู่มือสั้น ๆ สำหรับ${esc(callName(name))}</b>`,
      "",
      "<b>สิ่งที่จะได้รับในแชทนี้</b>",
      "📋 การ์ดงานที่ได้รับมอบหมาย · กด ✅ รับทราบ หรือ ⛔ ไม่สะดวก",
      "🕔 รายงาน 17.00 น. · ใครยังไม่รับทราบงานพรุ่งนี้",
      "⛔ แจ้งทันทีเมื่อมีน้องกดไม่สะดวก · หาคนแทนได้เลย",
      "❓ คำถามจากน้องที่บอทตอบไม่ได้ · กด <b>ตอบกลับ (Reply)</b> แล้วพิมพ์ บอทส่งให้น้องเอง",
      "✨ คำขอลุค/แก็ก และ 😂 มุกจากทีม · กดปุ่มใต้ข้อความได้เลย",
      "",
      "<b>สั่งงานจากมือถือ</b>",
      "➕ เพิ่มงาน · 📋 รายการงาน (แก้ไข เลื่อน ยกเลิก มอบหมาย)",
      "พิมพ์ถามได้ เช่น <b>งานพรุ่งนี้</b> · <b>ยังไม่รับทราบ</b> · <b>งานของฉัน</b>",
      "",
      "📺 จอทีวีห้อง: pr-os1.vercel.app/tv",
      "",
      "ดูคู่มือนี้อีกครั้ง พิมพ์ <b>คู่มือ</b> · ติดตรงไหน กดด้านล่างได้เลยครับ 👇",
    ].join("\n"),
    buttons: [[addEventButton(), jobsButton()], [{ text: "▶ ทัวร์ 1 นาที", callback_data: "t|0" }], ...pulse],
  };
}
