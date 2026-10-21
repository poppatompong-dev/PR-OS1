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
import { addFriendUrl, getBotBasicId, getGroupMemberProfile, replyMessages, type LineMessage } from "@/lib/line/api";
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
import {
  COMMANDS,
  UNAVAILABLE_PRESETS,
  helpMessage,
  linkPromptMessage,
  myTasksTextMessage,
  parsePostback,
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
  await replyMessages(ev.replyToken, messages);
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

async function finishUnavailable(ctx: Ctx, person: LinePerson, assignmentId: string, reason: string): Promise<LineMessage[]> {
  const { outcome, task } = await recordUnavailable(ctx.admin, { assignmentId, personId: person.id, reason });
  if (outcome === "not_found") return [text("ไม่พบงานนี้แล้ว อาจถูกนำชื่อออกหรือลบไปแล้ว", true)];
  if (outcome === "not_yours") return [text("งานนี้ไม่ได้มอบหมายให้คุณครับ", true)];
  if (outcome === "closed") return [text("งานนี้ถูกยกเลิกหรือปิดไปแล้ว ไม่ต้องแจ้งครับ", true)];
  if (outcome === "already") return [text("แจ้งไม่สะดวกงานนี้ไว้แล้ว แอดมินรับทราบแล้วครับ", true)];
  if (outcome === "acknowledged") {
    return [text("งานนี้คุณกดรับทราบไว้แล้ว ถ้าไปไม่ได้จริง ๆ กรุณาแจ้งแอดมินโดยตรงครับ", true)];
  }
  await alertAdminsUnavailable(ctx.admin, task!);
  return [text(`รับเรื่องแล้วครับ แจ้งแอดมินให้หาคนแทนงาน "${task!.event.title}" แล้ว\nถ้าเปลี่ยนใจไปได้ กดรับทราบงานนี้ได้ตามเดิม`, true)];
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
      if (outcome === "ok") return [text(`✅ รับทราบงาน "${task!.event.title}" แล้วครับ`, true)];
      if (outcome === "already") return [text("รับทราบงานนี้ไปแล้วครับ", true)];
      if (outcome === "stale") return [text("งานนี้มีการแก้ไขหลังจากส่งข้อความนี้ กรุณาดูรายละเอียดใหม่แล้วกดรับทราบอีกครั้ง"), taskMessage(task!, "change")];
      if (outcome === "closed") return [text("งานนี้ถูกยกเลิกหรือปิดไปแล้วครับ", true)];
      if (outcome === "not_yours") return [text("งานนี้ไม่ได้มอบหมายให้คุณครับ", true)];
      return [text("ไม่พบงานนี้แล้ว อาจถูกนำชื่อออกหรือลบไปแล้ว", true)];
    }
    case "unav": {
      const task = await loadTask(ctx.admin, p.id);
      if (!task || task.personId !== person.id) return [text("ไม่พบงานนี้ หรืองานนี้ไม่ได้มอบหมายให้คุณแล้ว", true)];
      if (task.event.status !== "published") return [text("งานนี้ถูกยกเลิกหรือปิดไปแล้ว ไม่ต้องแจ้งครับ", true)];
      if (task.unavailable) return [text("แจ้งไม่สะดวกงานนี้ไว้แล้วครับ", true)];
      if (task.acknowledged) return [text("งานนี้คุณกดรับทราบไว้แล้ว ถ้าไปไม่ได้จริง ๆ กรุณาแจ้งแอดมินโดยตรงครับ", true)];
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
    // Owner rule: in the group, speak only when spoken to — and only in a
    // group an admin has allowed, so the schedule cannot be read from a group
    // a stranger set up.
    if (!cmd) return [];
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
  if (userId && (ev.type === "message" || ev.type === "postback") && !(await withinRateLimit(ctx.admin, userId))) return;
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
