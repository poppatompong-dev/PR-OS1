// What the bot does with each LINE webhook event.
//
// Owner decisions (19 Oct 2026):
//   - 1:1 chat: commands, รับทราบ / ไม่สะดวก buttons, link prompt
//   - group chat (the team's existing group): answer only when asked —
//     recognised commands get a reply, everything else is ignored
//   - every answer is a *reply* (free), never a push
//
// Webhook payload reference: https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayInBangkok } from "@/lib/date";
import { addFriendUrl, getBotBasicId, getGroupMemberProfile, replyMessages, startLoading, type LineMessage } from "@/lib/line/api";
import { alertAdminsUnavailable } from "@/lib/line/alerts";
import {
  claimRun,
  clearPending,
  findPersonByLineUserId,
  allowGroup,
  getAdminRecipientIds,
  getAllowedGroupIds,
  addPendingRegistration,
  isPendingRegistration,
  loadTask,
  loadTasks,
  recordAck,
  recordUnavailable,
  setPendingReason,
  takePendingReason,
  withinRateLimit,
  type LinePerson,
} from "@/lib/line/data";
import { loadChangeInfo } from "@/lib/line/change-diff";
import { faqCooldownKey, faqMessage, matchFaq } from "@/lib/line/faq";
import { announceDoneText, createAnnouncement, parseAnnounceCommand } from "@/lib/announcements";
import { avatarUrl, hasAvatar } from "@/lib/avatars";
import { isTelegramConfigured } from "@/lib/env";
import { getBotUsername } from "@/lib/telegram/api";
import { LINK_TOKEN_MINUTES, createLinkToken } from "@/lib/telegram/link";
import {
  COMMANDS,
  appUrl,
  UNAVAILABLE_PRESETS,
  helpMessage,
  linkPromptMessage,
  myTasksTextMessage,
  parsePostback,
  statusCardMessage,
  pendingApprovalMessage,
  pendingListMessage,
  registerCardMessage,
  registerReceivedMessage,
  taskCarousel,
  taskMessage,
  teamDayMessage,
  text,
  unavailableReasonPrompt,
} from "@/lib/line/messages";

export type LineSource = { type: "user" | "group" | "room"; userId?: string; groupId?: string; roomId?: string };

export type LineEvent = {
  type: string;
  replyToken?: string;
  source: LineSource;
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
  message?: { type: string; text?: string };
  postback?: { data: string };
};

type Command = keyof typeof COMMANDS;

const ALLOW_GROUP_PHRASES = new Set(["อนุญาตกลุ่มนี้", "อนุญาตกลุ่ม"]);

/** Map what someone typed to a command. Tolerant of spaces and a trailing "?" */
export function matchCommand(raw: string): Command | null {
  const t = raw.replace(/\s+/g, "").replace(/[?？!]+$/u, "");
  const table: Array<[Command, string[]]> = [
    ["mine", ["งานของฉัน", "งานฉัน", "งานของผม", "งานของหนู", "งานผม"]],
    ["today", ["ทีมวันนี้", "งานวันนี้", "วันนี้", "งานทีมวันนี้"]],
    ["tomorrow", ["ทีมพรุ่งนี้", "งานพรุ่งนี้", "พรุ่งนี้", "งานทีมพรุ่งนี้"]],
    ["pending", ["ยังไม่รับทราบ", "ใครยังไม่รับทราบ", "ค้างรับทราบ"]],
    ["help", ["วิธีใช้", "ช่วยด้วย", "help", "เมนู"]],
  ];
  for (const [cmd, words] of table) if (words.includes(t.toLowerCase())) return cmd;
  return null;
}

const REGISTER_WORDS = new Set(["ลงทะเบียน", "ลงทะเบียนรับแจ้งงาน", "ลงทะเบียนรับแจ้งเตือน"]);

/** "ลงทะเบียน" typed in the group: re-post the registration card. Exact words only. */
export function matchRegister(raw: string): boolean {
  return REGISTER_WORDS.has(raw.replace(/\s+/g, "").replace(/[?？!]+$/u, ""));
}

type Ctx = { admin: SupabaseClient };

/** For someone whose LINE is not linked to anyone yet (1:1 chat). */
async function notLinkedReply(ctx: Ctx, userId: string | undefined): Promise<LineMessage[]> {
  if (userId && (await isPendingRegistration(ctx.admin, userId))) return [pendingApprovalMessage()];
  return [linkPromptMessage()];
}

/**
 * A tap on "ลงทะเบียนรับแจ้งงาน" in the team group. Records the LINE account for
 * an admin to confirm on the ทีมงาน page; the person never signs in.
 */
async function handleRegister(ctx: Ctx, ev: LineEvent, person: LinePerson | null): Promise<LineMessage[]> {
  const src = ev.source;
  if (src.type === "user") return person ? [text(`คุณ${person.displayName} ลงทะเบียนไว้แล้วครับ`, true)] : notLinkedReply(ctx, src.userId);
  const groupId = src.groupId ?? src.roomId ?? "";
  // Only in a group an admin allowed: a stranger's group cannot add entries.
  if (!groupId || !(await getAllowedGroupIds(ctx.admin)).includes(groupId)) return [];
  if (!src.userId) {
    return [text("ลงทะเบียนไม่สำเร็จ เพราะ LINE ไม่ส่งรหัสผู้ใช้มาให้ กรุณาอัปเดตแอป LINE แล้วกดใหม่")];
  }
  if (person) return [text(`คุณ${person.displayName} ลงทะเบียนไว้แล้วครับ`)];

  const profile = await getGroupMemberProfile(src, src.userId);
  const displayName = profile?.displayName || "ผู้ใช้ LINE";
  await addPendingRegistration(ctx.admin, {
    lineUserId: src.userId,
    displayName,
    pictureUrl: profile?.pictureUrl ?? null,
    groupId,
    at: new Date().toISOString(),
  });
  const basicId = await getBotBasicId();
  return [registerReceivedMessage(displayName, basicId ? addFriendUrl(basicId) : null)];
}

async function reply(ev: LineEvent, messages: LineMessage[]) {
  if (!ev.replyToken || messages.length === 0) return;
  const res = await replyMessages(ev.replyToken, messages);
  // A rejected reply is otherwise invisible: the person just sees nothing happen.
  if (!res.ok) console.error("line reply failed", ev.type, res.status ?? "", res.error ?? "");
}

async function runCommand(ctx: Ctx, cmd: Command, person: LinePerson | null, inGroup: boolean): Promise<LineMessage[]> {
  const today = todayInBangkok();
  if (cmd === "help") return [helpMessage()];
  // Anyone can add a LINE OA as a friend, or invite it into their own group.
  // The schedule names real staff, so only people linked to PR-OS may read it.
  if (!person) return inGroup ? [] : [linkPromptMessage()];
  switch (cmd) {
    case "today":
      return [teamDayMessage("งานของทีมวันนี้", today, await loadTasks(ctx.admin, { from: today, to: today }))];
    case "tomorrow": {
      const d = addDays(today, 1);
      return [teamDayMessage("งานของทีมพรุ่งนี้", d, await loadTasks(ctx.admin, { from: d, to: d }))];
    }
    case "mine": {
      const tasks = await loadTasks(ctx.admin, { from: today, to: addDays(today, 7), personId: person.id });
      if (tasks.length === 0) return [text(`คุณ${person.displayName} ไม่มีงานใน 7 วันข้างหน้าครับ`, true)];
      // In the group, a carousel of someone's personal buttons is noise for everyone else.
      if (inGroup) return [myTasksTextMessage(person.displayName, tasks)];
      return [taskCarousel(tasks, `งานของคุณ ${tasks.length} งาน`)];
    }
    case "pending": {
      // Owner decision (20 Oct 2026): everyone on the team sees the whole
      // team's outstanding acknowledgements, in the group and in 1:1 chat alike
      // — the same picture the office TV already shows.
      const tasks = (await loadTasks(ctx.admin, { from: today, to: addDays(today, 7) })).filter(
        (t) => !t.acknowledged,
      );
      return [pendingListMessage(tasks, "team")];
    }
  }
}

/** Why a button on this job does nothing any more, in the job's own words. */
function closedText(task: { event: { status: string } } | null): string {
  if (task?.event.status === "draft") return "งานนี้เลื่อนออกไปก่อน ยังไม่มีวันใหม่ เมื่อได้วันใหม่ระบบจะส่งการ์ดให้กดรับทราบอีกครั้งครับ";
  if (task?.event.status === "completed") return "งานนี้ปิดไปแล้ว (เสร็จสิ้น) ครับ";
  return "งานนี้ถูกยกเลิกไปแล้ว ไม่ต้องไปปฏิบัติครับ";
}

async function finishUnavailable(ctx: Ctx, person: LinePerson, assignmentId: string, reason: string): Promise<LineMessage[]> {
  const { outcome, task } = await recordUnavailable(ctx.admin, { assignmentId, personId: person.id, reason });
  if (outcome === "not_found") return [text("ไม่พบงานนี้แล้ว อาจถูกนำชื่อออกหรือลบไปแล้ว", true)];
  if (outcome === "not_yours") return [text("งานนี้ไม่ได้มอบหมายให้คุณครับ", true)];
  if (outcome === "closed") return [text(closedText(task), true)];
  if (outcome === "already") return [statusCardMessage(task!, "already_unavailable")];
  if (outcome === "acknowledged") {
    return [text("งานนี้คุณกดรับทราบไว้แล้ว ถ้าไปไม่ได้จริง ๆ กรุณาแจ้งแอดมินโดยตรงครับ", true)];
  }
  await alertAdminsUnavailable(ctx.admin, task!);
  return [statusCardMessage(task!, "unavailable")];
}

async function handlePostback(ctx: Ctx, ev: LineEvent, person: LinePerson | null): Promise<LineMessage[]> {
  const p = parsePostback(ev.postback?.data ?? "");
  if (p.a === "reg") return handleRegister(ctx, ev, person);
  if (!person) return ev.source.type === "user" ? notLinkedReply(ctx, ev.source.userId) : [];
  const userId = ev.source.userId!;

  switch (p.a) {
    case "ack": {
      const { outcome, task } = await recordAck(ctx.admin, {
        assignmentId: p.id,
        version: Number(p.v),
        personId: person.id,
        channel: "line",
      });
      if (outcome === "ok") return [statusCardMessage(task!, "acked")];
      if (outcome === "already") return [statusCardMessage({ ...task!, acknowledged: true }, "already_acked")];
      if (outcome === "stale") {
        // The newest card again, with the same old → new lines the change push had (found in the 21 Oct loop test).
        const { changes, reason } = await loadChangeInfo(ctx.admin, task!.event.id, task!);
        return [text("งานนี้มีการแก้ไขหลังจากส่งข้อความนี้ ใช้การ์ดด้านล่างแทนแล้วกดรับทราบอีกครั้งครับ"), taskMessage(task!, "change", changes, reason)];
      }
      if (outcome === "closed") return [text(closedText(task), true)];
      if (outcome === "not_yours") return [text("งานนี้ไม่ได้มอบหมายให้คุณครับ", true)];
      return [text("ไม่พบงานนี้แล้ว อาจถูกนำชื่อออกหรือลบไปแล้ว", true)];
    }
    case "unav": {
      const task = await loadTask(ctx.admin, p.id);
      if (!task || task.personId !== person.id) return [text("ไม่พบงานนี้ หรืองานนี้ไม่ได้มอบหมายให้คุณแล้ว", true)];
      if (task.event.status !== "published") return [text(closedText(task), true)];
      if (task.unavailable) return [statusCardMessage(task, "already_unavailable")];
      if (task.acknowledged) return [text("งานนี้คุณกดรับทราบไว้แล้ว ถ้าไปไม่ได้จริง ๆ กรุณาแจ้งแอดมินโดยตรงครับ", true), statusCardMessage(task, "already_acked")];
      await setPendingReason(ctx.admin, userId, task.assignmentId);
      return [unavailableReasonPrompt(task.assignmentId, task.event.title)];
    }
    case "reason": {
      await clearPending(ctx.admin, userId);
      const reason = UNAVAILABLE_PRESETS[Number(p.r)] ?? "ไม่ระบุเหตุผล";
      return finishUnavailable(ctx, person, p.id, reason);
    }
    case "cancelreason":
      await clearPending(ctx.admin, userId);
      return [text("ยกเลิกแล้วครับ งานยังอยู่ในชื่อของคุณตามเดิม", true)];
    case "avok":
    case "avedit": {
      const ok = p.a === "avok";
      await ctx.admin.from("audit_logs").insert({
        entity_type: "person",
        entity_id: person.id,
        action: ok ? "avatar_ok" : "avatar_change_request",
        changed_by: null,
        summary: ok ? "เจ้าตัวยืนยันรูปการ์ตูน (LINE)" : "เจ้าตัวขอแก้รูปการ์ตูน (LINE)",
      });
      return [text(ok ? "ขอบคุณครับ 👍 ใช้รูปนี้ต่อ" : "รับเรื่องแล้วครับ บอกได้เลยว่าอยากแก้ตรงไหน หรือส่งรูปถ่ายใหม่ให้แอดมิน (แอดมินเห็นคำขอนี้แล้ว)")];
    }
    default:
      return [helpMessage()];
  }
}

async function handleText(ctx: Ctx, ev: LineEvent, person: LinePerson | null): Promise<LineMessage[]> {
  const raw = (ev.message?.text ?? "").trim();
  const inGroup = ev.source.type !== "user";
  const cmd = matchCommand(raw);

  if (inGroup) {
    const groupId = ev.source.groupId ?? ev.source.roomId ?? "";
    // An admin turns the bot on for this group once, by typing the phrase in it.
    if (ALLOW_GROUP_PHRASES.has(raw.replace(/\s+/g, "")) && person) {
      const admins = await getAdminRecipientIds(ctx.admin);
      if (!admins.includes(person.id)) return [text("เฉพาะแอดมินของระบบที่อนุญาตกลุ่มได้ครับ")];
      await allowGroup(ctx.admin, groupId, null);
      return [
        text(`อนุญาตกลุ่มนี้แล้วครับ พิมพ์ "${COMMANDS.today}" "${COMMANDS.tomorrow}" "${COMMANDS.pending}" ถามได้เลย`),
        registerCardMessage(),
      ];
    }
    if (matchRegister(raw)) {
      if (!(await getAllowedGroupIds(ctx.admin)).includes(groupId)) return [];
      return [registerCardMessage()];
    }
    const announce = parseAnnounceCommand(raw);
    if (announce !== null) {
      if (!person || !(await getAllowedGroupIds(ctx.admin)).includes(groupId)) return [];
      return [await announceReply(ctx, person, announce)];
    }
    if (isLinkTelegramCommand(raw)) {
      if (!(await getAllowedGroupIds(ctx.admin)).includes(groupId)) return [];
      return [text('พิมพ์ "ผูก Telegram" ในแชทส่วนตัวกับ "ผู้ช่วยงาน ปชส." นะครับ (ลิงก์ผูกเป็นของแต่ละคน ไม่ส่งในกลุ่ม)')];
    }
    // Owner rule: in the group, speak only when spoken to — and only in a
    // group an admin has allowed, so the schedule cannot be read from a group
    // a stranger set up.
    if (!cmd) {
      // A short how-to question ("เพิ่มงาน …", "แนบรูปยังไง") gets the how-to,
      // once per 30 minutes per group (owner, 29 Oct 2026). Free: a reply.
      const faq = matchFaq(raw);
      if (!faq) return [];
      if (!(await getAllowedGroupIds(ctx.admin)).includes(groupId)) return [];
      if (!(await claimRun(ctx.admin, faqCooldownKey(groupId, faq)))) return [];
      return [faqMessage(faq, true)];
    }
    if (!(await getAllowedGroupIds(ctx.admin)).includes(groupId)) return [];
    return runCommand(ctx, cmd, person, true);
  }

  const userId = ev.source.userId!;
  if (person && !cmd) {
    const pendingAssignment = await takePendingReason(ctx.admin, userId);
    if (pendingAssignment) return finishUnavailable(ctx, person, pendingAssignment, raw);
  }
  if (cmd === "help") return [helpMessage()];
  if (!person) return notLinkedReply(ctx, userId);
  if (cmd) return runCommand(ctx, cmd, person, false);
  if (isLinkTelegramCommand(raw)) return [await telegramLinkReply(ctx, person)];
  const announce = parseAnnounceCommand(raw);
  if (announce !== null) return [await announceReply(ctx, person, announce)];
  if (/^(รูปของฉัน|รูปฉัน)$/.test(raw.replace(/\s+/g, ""))) return avatarReply(person);
  const faq = matchFaq(raw);
  if (faq) return [faqMessage(faq, false)];
  return [helpMessage()];
}

/**
 * Handle one webhook event. Errors are caught per event so one bad event
 * cannot stop the others in the same delivery.
 */
export async function handleLineEvent(ctx: Ctx, ev: LineEvent): Promise<void> {
  // LINE retries deliveries; a redelivered "รับทราบ" must not double-alert admins.
  if (ev.webhookEventId) {
    const fresh = await claimRun(ctx.admin, `webhook:${ev.webhookEventId}`);
    if (!fresh) return;
  }

  const userId = ev.source.userId;
  // Instant feedback on a button tap in 1:1 chat, before any database work.
  const loading = ev.type === "postback" && ev.source.type === "user" && userId ? startLoading(userId) : null;
  if (userId && (ev.type === "message" || ev.type === "postback") && !(await withinRateLimit(ctx.admin, userId))) {
    await loading;
    return;
  }
  const person = userId ? await findPersonByLineUserId(ctx.admin, userId) : null;

  switch (ev.type) {
    case "follow":
      if (person) {
        await reply(ev, [text(`สวัสดีครับ คุณ${person.displayName} บัญชีนี้ผูกกับ PR-OS แล้ว จะได้รับแจ้งเตือนงานที่นี่`, true)]);
      } else if (userId && (await isPendingRegistration(ctx.admin, userId))) {
        await reply(ev, [pendingApprovalMessage()]);
      } else {
        await reply(ev, [text("สวัสดีครับ ผู้ช่วยงาน ปชส. จะส่งแจ้งเตือนงานที่คุณได้รับมอบหมายมาที่นี่"), linkPromptMessage()]);
      }
      return;
    case "join":
      await reply(ev, [
        text(
          `สวัสดีครับ ผู้ช่วยงาน ปชส. จะตอบเฉพาะเมื่อมีคนพิมพ์ถาม เช่น "${COMMANDS.today}" "${COMMANDS.tomorrow}"\n` +
            `ก่อนใช้ ให้แอดมินของระบบพิมพ์ "อนุญาตกลุ่มนี้" ในกลุ่มนี้ 1 ครั้ง`,
        ),
      ]);
      return;
    case "message":
      if (ev.message?.type !== "text") return;
      await reply(ev, await handleText(ctx, ev, person));
      return;
    case "postback":
      await reply(ev, await handlePostback(ctx, ev, person));
      return;
    default:
      return; // unfollow, leave, read receipts …: nothing to say
  }
}

// ---- Telegram link, ประกาศบนจอ, รูปของฉัน (owner, 29 Oct 2026) -----------------

export function isLinkTelegramCommand(raw: string): boolean {
  return /^(ผูก|เชื่อม|ย้ายไป)\s*(telegram|เทเลแกรม|เทเลแกม)$/i.test(raw.trim());
}

async function telegramLinkReply(ctx: Ctx, person: LinePerson): Promise<LineMessage> {
  if (!isTelegramConfigured()) return text("ระบบ Telegram ยังไม่เปิดใช้งานครับ รอแอดมินตั้งค่าให้เสร็จก่อน");
  const username = await getBotUsername();
  if (!username) return text("ติดต่อบอท Telegram ไม่ได้ชั่วคราว ลองใหม่อีกครั้งครับ");
  const token = await createLinkToken(ctx.admin, person.id);
  const link = `https://t.me/${username}?start=${token}`;
  return text(
    [
      `ลิงก์ผูก Telegram ของคุณ${person.displayName} (ใช้ได้ครั้งเดียว ภายใน ${LINK_TOKEN_MINUTES} นาที)`,
      "",
      `1. ลงแอป Telegram ก่อน (ถ้ายังไม่มี)`,
      `2. กดลิงก์นี้ 👉 ${link}`,
      `3. กด "Start" (เริ่ม) ในแชทบอท`,
      "",
      "ผูกแล้วแจ้งเตือนงานทั้งหมดจะไปที่ Telegram แทน LINE",
      "ห้ามส่งลิงก์นี้ให้คนอื่น",
    ].join("\n"),
  );
}

async function announceReply(ctx: Ctx, person: LinePerson, message: string): Promise<LineMessage> {
  const res = await createAnnouncement(ctx.admin, { text: message, personId: person.id, authorName: person.displayName, source: "line" });
  return text(res.ok ? announceDoneText(res.message, res.endsAt) : res.error);
}

function avatarReply(person: LinePerson): LineMessage[] {
  if (!hasAvatar(person.id)) return [text(`ยังไม่มีรูปการ์ตูนของคุณ${person.displayName}ครับ ตอนนี้จอใช้รูปมาสคอตแทน รอแอดมินวาดให้`)];
  const url = appUrl(avatarUrl(person.id));
  return [
    {
      type: "image",
      originalContentUrl: url,
      previewImageUrl: url,
      quickReply: {
        items: [
          { type: "action", action: { type: "postback", label: "👍 ใช้รูปนี้", data: "a=avok", displayText: "ใช้รูปนี้" } },
          { type: "action", action: { type: "postback", label: "✏️ ขอแก้", data: "a=avedit", displayText: "ขอแก้รูป" } },
        ],
      },
    },
  ];
}
