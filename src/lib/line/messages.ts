// Every message the LINE bot sends, in one place. Thai copy, municipal purple.
// Flex JSON follows https://developers.line.biz/en/reference/messaging-api/#flex-message
//
// Rules the copy follows:
//   - never include internal notes, phone numbers or attachments (docs/08)
//   - every push names the event and the date, so it reads fine out of context
//   - buttons only for things the person can actually do from LINE

import { env } from "@/lib/env";
import { formatThaiDate } from "@/lib/format";
import type { LineAction, LineMessage, QuickReply } from "@/lib/line/api";
import type { TaskItem } from "@/lib/line/data";

const PURPLE = "#5e2f73";
const MUTED = "#6b6475";
const GREEN = "#18784a";
const AMBER = "#a45f08";
const RED = "#b42318";

export const COMMANDS = {
  mine: "งานของฉัน",
  today: "งานวันนี้",
  tomorrow: "งานพรุ่งนี้",
  pending: "ยังไม่รับทราบ",
  help: "วิธีใช้",
} as const;

export const UNAVAILABLE_PRESETS = ["ติดภารกิจอื่น", "ลา", "เวลาชนกับงานอื่น"] as const;

export function appUrl(path: string): string {
  return new URL(path, env.appBaseUrl).toString();
}

export const postback = {
  ack: (t: TaskItem) => `a=ack&id=${t.assignmentId}&v=${t.assignmentVersion}`,
  unavailable: (t: TaskItem) => `a=unav&id=${t.assignmentId}`,
  reason: (assignmentId: string, i: number) => `a=reason&id=${assignmentId}&r=${i}`,
  register: "a=reg",
};

export function parsePostback(data: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(data));
}

function when(t: TaskItem): string {
  const time = t.event.endTime ? `${t.event.startTime}–${t.event.endTime}` : t.event.startTime;
  return `${formatThaiDate(t.event.eventDate)} · ${time} น.`;
}

function row(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: MUTED, flex: 2 },
      { type: "text", text: value || "—", size: "sm", wrap: true, flex: 6 },
    ],
  };
}

function button(action: LineAction, style: "primary" | "secondary" | "link" = "secondary", color?: string) {
  return { type: "button", style, height: "sm", action, ...(color ? { color } : {}) };
}

function statusLine(t: TaskItem) {
  if (t.acknowledged) return { type: "text", text: "✅ รับทราบแล้ว", size: "sm", color: GREEN, weight: "bold" };
  if (t.unavailable)
    return { type: "text", text: `⛔ แจ้งไม่สะดวกแล้ว: ${t.unavailableReason ?? ""}`, size: "sm", color: RED, wrap: true };
  return { type: "text", text: "⏳ ยังไม่รับทราบ", size: "sm", color: AMBER, weight: "bold" };
}

export type BubbleKind = "assignment" | "change" | "reminder" | "list";

const HEADINGS: Record<BubbleKind, { label: string; color: string }> = {
  assignment: { label: "มอบหมายงานใหม่", color: PURPLE },
  change: { label: "งานมีการเปลี่ยนแปลง — กรุณารับทราบใหม่", color: AMBER },
  reminder: { label: "อีกประมาณ 1 ชม. 30 นาที เริ่มงาน", color: RED },
  list: { label: "งานของคุณ", color: PURPLE },
};

/** One assignment as a card with รับทราบ / ไม่สะดวก / ดูรายละเอียด. */
export function taskBubble(t: TaskItem, kind: BubbleKind, changeSummary?: string): Record<string, unknown> {
  const head = HEADINGS[kind];
  const body: unknown[] = [
    { type: "text", text: t.event.title, weight: "bold", size: "lg", wrap: true },
    { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: [
      row("วันเวลา", when(t)),
      row("สถานที่", t.event.locationName),
      row("หน้าที่", t.roleName),
      ...(t.event.shortNote ? [row("หมายเหตุ", t.event.shortNote)] : []),
      ...(changeSummary ? [row("เปลี่ยน", changeSummary)] : []),
    ] },
  ];
  if (kind === "list" || t.acknowledged || t.unavailable) {
    body.push({ type: "box", layout: "vertical", margin: "md", contents: [statusLine(t)] });
  }

  const footer: unknown[] = [];
  if (!t.acknowledged) {
    footer.push(button({ type: "postback", label: "รับทราบ", data: postback.ack(t), displayText: "รับทราบ" }, "primary", PURPLE));
    if (!t.unavailable) {
      footer.push(button({ type: "postback", label: "ไม่สะดวก", data: postback.unavailable(t), displayText: "ไม่สะดวก" }));
    }
  }
  footer.push(button({ type: "uri", label: "ดูรายละเอียด", uri: appUrl("/mobile/my-tasks") }, "link"));

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: head.color,
      paddingAll: "12px",
      contents: [{ type: "text", text: head.label, color: "#ffffff", size: "sm", weight: "bold", wrap: true }],
    },
    body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: footer },
  };
}

export function taskMessage(t: TaskItem, kind: BubbleKind, changeSummary?: string): LineMessage {
  const prefix = HEADINGS[kind].label;
  return {
    type: "flex",
    altText: `${prefix}: ${t.event.title} ${formatThaiDate(t.event.eventDate)} ${t.event.startTime} น.`.slice(0, 390),
    contents: taskBubble(t, kind, changeSummary),
  };
}

/** Up to 12 cards side by side (LINE's carousel limit). */
export function taskCarousel(tasks: TaskItem[], altText: string): LineMessage {
  return {
    type: "flex",
    altText: altText.slice(0, 390),
    contents: { type: "carousel", contents: tasks.slice(0, 12).map((t) => taskBubble(t, "list")) },
  };
}

export function cancellationMessage(t: TaskItem): LineMessage {
  return {
    type: "text",
    text: [
      "❌ ยกเลิกงาน",
      `งาน: ${t.event.title}`,
      `วันที่เดิม: ${when(t)}`,
      `เหตุผล: ${t.event.cancellationReason ?? "ไม่ระบุ"}`,
      "ไม่ต้องไปปฏิบัติงานนี้แล้ว",
    ].join("\n"),
  };
}

function dayLines(tasks: TaskItem[]): string[] {
  return tasks.map((t) => {
    const mark = t.acknowledged ? "✅" : t.unavailable ? "⛔" : "⏳";
    return `${mark} ${t.event.startTime} ${t.event.title} (${t.roleName}) @${t.event.locationName}`;
  });
}

/** 07:00 — one message per person, only on days they have work. */
export function dailySummaryMessage(personName: string, today: TaskItem[], tomorrow: TaskItem[]): LineMessage {
  const pending = [...today, ...tomorrow].filter((t) => !t.acknowledged && !t.unavailable).length;
  const lines = [`สวัสดีตอนเช้าครับ คุณ${personName}`];
  if (today.length) lines.push("", `📌 วันนี้ (${formatThaiDate(today[0].event.eventDate)})`, ...dayLines(today));
  if (tomorrow.length) lines.push("", `🗓 พรุ่งนี้ (${formatThaiDate(tomorrow[0].event.eventDate)})`, ...dayLines(tomorrow));
  lines.push("");
  lines.push(pending > 0 ? `ยังไม่รับทราบ ${pending} งาน — กด "${COMMANDS.mine}" เพื่อรับทราบ` : "รับทราบครบทุกงานแล้ว ขอบคุณครับ");
  return { type: "text", text: lines.join("\n").slice(0, 4900), quickReply: commandQuickReply() };
}

/** 17:00 — to the admins, only when someone has not acknowledged tomorrow's work. */
export function adminReportMessage(date: string, pending: TaskItem[], unavailable: TaskItem[]): LineMessage {
  const lines = [`📋 งานพรุ่งนี้ ${formatThaiDate(date)}`];
  if (pending.length) {
    lines.push("", `⏳ ยังไม่รับทราบ ${pending.length} รายการ`);
    for (const t of pending) {
      lines.push(`• ${t.personName}${t.lineUserId ? "" : " (ยังไม่ผูก LINE)"} — ${t.event.startTime} ${t.event.title}`);
    }
  }
  if (unavailable.length) {
    lines.push("", `⛔ แจ้งไม่สะดวก ยังไม่ได้หาคนแทน ${unavailable.length} รายการ`);
    for (const t of unavailable) {
      lines.push(`• ${t.personName} — ${t.event.startTime} ${t.event.title} (${t.unavailableReason ?? "ไม่ระบุ"})`);
    }
  }
  return { type: "text", text: lines.join("\n").slice(0, 4900) };
}

export function unavailableAlertMessage(t: TaskItem): LineMessage {
  return {
    type: "flex",
    altText: `${t.personName} แจ้งไม่สะดวก: ${t.event.title}`.slice(0, 390),
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: RED, paddingAll: "12px",
        contents: [{ type: "text", text: "แจ้งไม่สะดวก — ต้องหาคนแทน", color: "#ffffff", size: "sm", weight: "bold" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: t.event.title, weight: "bold", wrap: true },
          row("ผู้แจ้ง", `${t.personName} (${t.roleName})`),
          row("วันเวลา", when(t)),
          row("เหตุผล", t.unavailableReason ?? "ไม่ระบุ"),
        ],
      },
      footer: {
        type: "box", layout: "vertical",
        contents: [button({ type: "uri", label: "เปิดงานในระบบ", uri: appUrl(`/events/${t.event.id}`) }, "primary", PURPLE)],
      },
    },
  };
}

export function quotaWarningMessage(used: number, limit: number): LineMessage {
  return {
    type: "text",
    text: [
      "⚠️ โควต้าข้อความ LINE เดือนนี้ใกล้หมด",
      `ใช้ไปแล้ว ${used} จาก ${limit} ข้อความ`,
      "เมื่อหมด ระบบจะหยุดส่งแจ้งเตือนทาง LINE จนถึงต้นเดือนหน้า",
      "ระหว่างนั้นให้ทีมดูงานและกดรับทราบผ่านเว็บ PR-OS แทน",
      "(การพิมพ์ถามบอท เช่น \"งานวันนี้\" ยังใช้ได้ตามปกติ ไม่เสียโควต้า)",
    ].join("\n"),
  };
}

/** Team view of one day. Shown in the group chat too, so names + roles only. */
export function teamDayMessage(label: string, date: string, tasks: TaskItem[]): LineMessage {
  if (tasks.length === 0) {
    return { type: "text", text: `${label} (${formatThaiDate(date)}) ไม่มีงานที่เผยแพร่แล้ว`, quickReply: commandQuickReply() };
  }
  const byEvent = new Map<string, TaskItem[]>();
  for (const t of tasks) byEvent.set(t.event.id, [...(byEvent.get(t.event.id) ?? []), t]);
  const lines = [`${label} ${formatThaiDate(date)} — ${byEvent.size} งาน`];
  for (const group of byEvent.values()) {
    const first = group[0];
    lines.push("", `🕘 ${first.event.startTime}${first.event.endTime ? `–${first.event.endTime}` : ""} ${first.event.title}`);
    lines.push(`📍 ${first.event.locationName}`);
    for (const t of group) {
      const mark = t.acknowledged ? "✅" : t.unavailable ? "⛔" : "⏳";
      lines.push(`   ${mark} ${t.personName} (${t.roleName})`);
    }
  }
  lines.push("", "✅ รับทราบแล้ว  ⏳ ยังไม่รับทราบ  ⛔ ไม่สะดวก");
  return { type: "text", text: lines.join("\n").slice(0, 4900), quickReply: commandQuickReply() };
}

/** "งานของฉัน" asked in the group: a plain list, no personal buttons in front of everyone. */
export function myTasksTextMessage(personName: string, tasks: TaskItem[]): LineMessage {
  const lines = [`งานของคุณ${personName} (7 วันข้างหน้า) ${tasks.length} งาน`];
  for (const t of tasks) {
    const mark = t.acknowledged ? "✅" : t.unavailable ? "⛔" : "⏳";
    lines.push(`${mark} ${formatThaiDate(t.event.eventDate)} ${t.event.startTime} ${t.event.title} (${t.roleName})`);
  }
  lines.push("", "กดรับทราบได้ในแชทส่วนตัวกับบอท หรือในเว็บ");
  return { type: "text", text: lines.join("\n").slice(0, 4900), quickReply: commandQuickReply() };
}

export function pendingListMessage(tasks: TaskItem[], scope: "mine" | "team"): LineMessage {
  if (tasks.length === 0) {
    return {
      type: "text",
      text: scope === "mine" ? "คุณรับทราบครบทุกงานแล้ว 👍" : "ทุกคนรับทราบงาน 7 วันข้างหน้าครบแล้ว 👍",
      quickReply: commandQuickReply(),
    };
  }
  if (scope === "mine") return taskCarousel(tasks, `ยังไม่รับทราบ ${tasks.length} งาน`);
  const lines = [`⏳ ยังไม่รับทราบ (7 วันข้างหน้า) ${tasks.length} รายการ`];
  for (const t of tasks) {
    lines.push(`• ${formatThaiDate(t.event.eventDate)} ${t.event.startTime} ${t.event.title} — ${t.personName}${t.unavailable ? " ⛔ไม่สะดวก" : ""}`);
  }
  return { type: "text", text: lines.join("\n").slice(0, 4900), quickReply: commandQuickReply() };
}

export function commandQuickReply(): QuickReply {
  return {
    items: [COMMANDS.mine, COMMANDS.today, COMMANDS.tomorrow, COMMANDS.pending].map((c) => ({
      type: "action" as const,
      action: { type: "message" as const, label: c, text: c },
    })),
  };
}

export function helpMessage(): LineMessage {
  return {
    type: "text",
    text: [
      "ผู้ช่วยงาน ปชส. ตอบได้ตามนี้ครับ",
      `• "${COMMANDS.mine}" — งานที่คุณได้รับมอบหมาย 7 วันข้างหน้า พร้อมปุ่มรับทราบ`,
      `• "${COMMANDS.today}" / "${COMMANDS.tomorrow}" — ใครไปงานไหน`,
      `• "${COMMANDS.pending}" — งานที่ยังไม่ได้กดรับทราบ`,
      "",
      "กรอกหรือแก้ไขงาน แนบรูป และดูรายงาน ทำในเว็บ PR-OS",
    ].join("\n"),
    quickReply: commandQuickReply(),
  };
}

export function linkPromptMessage(): LineMessage {
  return {
    type: "flex",
    altText: "ผูกบัญชี LINE กับ PR-OS เพื่อรับแจ้งเตือนงาน",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "ยังไม่ได้ผูกบัญชีกับ PR-OS", weight: "bold", wrap: true },
          { type: "text", text: "กดปุ่มด้านล่าง เข้าสู่ระบบด้วยชื่อผู้ใช้ของคุณครั้งเดียว แล้วระบบจะส่งแจ้งเตือนงานมาที่ LINE นี้", size: "sm", color: MUTED, wrap: true },
          { type: "text", text: "หรือกด \"ลงทะเบียนรับแจ้งงาน\" ในกลุ่มไลน์งาน แล้วรอแอดมินยืนยันชื่อ", size: "sm", color: MUTED, wrap: true },
        ],
      },
      footer: {
        type: "box", layout: "vertical",
        contents: [button({ type: "uri", label: "ผูกบัญชี", uri: appUrl("/link-line") }, "primary", PURPLE)],
      },
    },
  };
}

export function unavailableReasonPrompt(assignmentId: string, title: string): LineMessage {
  return {
    type: "text",
    text: `ไม่สะดวกไปงาน "${title}" เพราะอะไรครับ\nเลือกด้านล่าง หรือพิมพ์เหตุผลสั้น ๆ ส่งมาได้เลย (ภายใน 10 นาที)`,
    quickReply: {
      items: [
        ...UNAVAILABLE_PRESETS.map((label, i) => ({
          type: "action" as const,
          action: { type: "postback" as const, label, data: postback.reason(assignmentId, i), displayText: label },
        })),
        {
          type: "action" as const,
          action: { type: "postback" as const, label: "ยกเลิก", data: "a=cancelreason", displayText: "ยกเลิก" },
        },
      ],
    },
  };
}

export function text(t: string, withCommands = false): LineMessage {
  return withCommands ? { type: "text", text: t, quickReply: commandQuickReply() } : { type: "text", text: t };
}

// ---- registration from the team group (owner, 20 Oct 2026) ------------------

/** Posted in the team group: each person taps once, no password needed. */
export function registerCardMessage(): LineMessage {
  return {
    type: "flex",
    altText: "รับแจ้งงานที่ได้รับมอบหมาย — กดปุ่มลงทะเบียน 1 ครั้งต่อคน",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "รับแจ้งงานที่ได้รับมอบหมาย", weight: "bold", color: PURPLE, wrap: true },
          { type: "text", text: "กดปุ่มนี้ 1 ครั้งต่อคน แอดมินจะยืนยันชื่อให้ แล้วงานของคุณจะส่งเข้าแชทส่วนตัวกับบอท", size: "sm", color: MUTED, wrap: true },
        ],
      },
      footer: {
        type: "box", layout: "vertical",
        contents: [
          button(
            // displayText is posted in the group as the person; it must not be a command itself.
            { type: "postback", label: "ลงทะเบียนรับแจ้งงาน", data: postback.register, displayText: "✋ ขอรับแจ้งงานส่วนตัว" },
            "primary",
            PURPLE,
          ),
        ],
      },
    },
  };
}

/** Answer to a tap on the card: next step is adding the bot as a friend. */
export function registerReceivedMessage(displayName: string, addFriendUri: string | null): LineMessage {
  const body = `รับทราบครับ คุณ${displayName} แอดมินจะยืนยันชื่อให้ จากนั้นกดเพิ่มเพื่อนผมเพื่อรับแจ้งงานส่วนตัว (LINE ส่งข้อความส่วนตัวได้เฉพาะคนที่เป็นเพื่อน)`;
  if (!addFriendUri) return { type: "text", text: body };
  return {
    type: "flex",
    altText: body.slice(0, 400),
    contents: {
      type: "bubble",
      size: "kilo",
      body: { type: "box", layout: "vertical", contents: [{ type: "text", text: body, size: "sm", wrap: true }] },
      footer: {
        type: "box", layout: "vertical",
        contents: [button({ type: "uri", label: "เพิ่มเพื่อน", uri: addFriendUri }, "primary", PURPLE)],
      },
    },
  };
}

export function pendingApprovalMessage(): LineMessage {
  return { type: "text", text: "รอแอดมินยืนยันชื่ออยู่ครับ ยืนยันแล้วจะได้รับแจ้งงานที่นี่" };
}
