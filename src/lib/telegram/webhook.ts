// What the Telegram bot does with each update (owner, 29 Oct 2026). Private
// chats only: everything is a free send, so there is no reply-token race like
// LINE's, but the bot still only speaks when spoken to.

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayInBangkok } from "@/lib/date";
import { alertAdminsUnavailable } from "@/lib/line/alerts";
import { loadChangeInfo } from "@/lib/line/change-diff";
import {
  claimRun,
  clearPending,
  findPersonByTelegramChatId,
  loadTask,
  loadTasks,
  recordAck,
  recordUnavailable,
  setPendingReason,
  takePendingReason,
  withinRateLimit,
  type LinePerson,
  type TaskItem,
} from "@/lib/line/data";
import { matchCommand } from "@/lib/line/webhook";
import { faqText, matchFaq } from "@/lib/line/faq";
import { UNAVAILABLE_PRESETS, pendingListMessage, teamDayMessage, appUrl } from "@/lib/line/messages";
import { announceDoneText, createAnnouncement, parseAnnounceCommand } from "@/lib/announcements";
import { avatarUrl, hasAvatar } from "@/lib/avatars";
import { answerCallback, editTelegram, esc, sendTelegram, type TgMessage } from "@/lib/telegram/api";
import { consumeLinkToken, unlinkTelegram } from "@/lib/telegram/link";
import {
  KEYBOARD,
  STATUS_TOAST,
  cb,
  parseCb,
  tgFromLineText,
  tgHelp,
  tgLinked,
  tgNotLinked,
  tgReasonPrompt,
  tgTask,
} from "@/lib/telegram/messages";

export type TgUpdate = {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; from?: { id: number; first_name?: string }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number; type: string } };
  };
};

type Ctx = { admin: SupabaseClient };

/** Pending-reason rows share LINE's chat-state table under a "tg:" key. */
const stateKey = (chatId: number) => `tg:${chatId}`;

export async function handleTelegramUpdate(ctx: Ctx, u: TgUpdate): Promise<void> {
  // Telegram retries a delivery that was not answered quickly: do each once.
  if (!(await claimRun(ctx.admin, `tgu:${u.update_id}`))) return;
  if (u.callback_query) return handleCallback(ctx, u.callback_query);
  const m = u.message;
  if (!m || m.chat.type !== "private" || typeof m.text !== "string") return;
  const chatId = m.chat.id;
  if (!(await withinRateLimit(ctx.admin, stateKey(chatId)))) return;
  const out = await handleText(ctx, chatId, m.text.trim());
  for (const msg of out) await sendTelegram(chatId, msg);
}

async function handleText(ctx: Ctx, chatId: number, raw: string): Promise<TgMessage[]> {
  const start = raw.match(/^\/start(?:\s+(\S+))?$/);
  if (start) {
    const token = start[1];
    if (!token) {
      const p = await findPersonByTelegramChatId(ctx.admin, chatId);
      return [p ? tgHelp() : tgNotLinked()];
    }
    const res = await consumeLinkToken(ctx.admin, token, chatId);
    if (res.ok) return [tgLinked(res.displayName)];
    const why = {
      invalid: "ลิงก์นี้ใช้ไม่ได้",
      expired: "ลิงก์หมดอายุแล้ว (30 นาที)",
      used: "ลิงก์นี้ถูกใช้ไปแล้ว",
      inactive: "บัญชีนี้ถูกระงับอยู่ ติดต่อแอดมิน",
      taken: "ผูกไม่สำเร็จ ลองใหม่อีกครั้ง",
    }[res.reason];
    return [{ text: `⚠️ ${why}\n\nขอลิงก์ใหม่: ในแชท LINE "ผู้ช่วยงาน ปชส." พิมพ์ <b>ผูก Telegram</b>` }];
  }
  if (raw === "/stop") {
    const name = await unlinkTelegram(ctx.admin, chatId);
    return [{ text: name ? `เลิกรับแจ้งทาง Telegram แล้วครับ คุณ${esc(name)}\nจากนี้แจ้งเตือนจะกลับไปทาง LINE ผูกใหม่ได้ทุกเมื่อ` : "Telegram นี้ไม่ได้ผูกกับใครอยู่ครับ" }];
  }

  const person = await findPersonByTelegramChatId(ctx.admin, chatId);
  if (!person) return [tgNotLinked()];

  const pendingAssignment = await takePendingReason(ctx.admin, stateKey(chatId));
  if (pendingAssignment && !raw.startsWith("/")) return finishUnavailable(ctx, person, pendingAssignment, raw);

  const text = raw.replace(/^\/(help|menu)$/, "วิธีใช้").replace(/^\/my$/, "งานของฉัน").replace(/^\/today$/, "งานวันนี้");
  const announce = parseAnnounceCommand(text);
  if (announce !== null) {
    const res = await createAnnouncement(ctx.admin, { text: announce, personId: person.id, authorName: person.displayName, source: "telegram" });
    return [{ text: esc(res.ok ? announceDoneText(res.message, res.endsAt) : res.error) }];
  }
  if (/^(รูปของฉัน|รูปฉัน|avatar)$/i.test(text.replace(/\s+/g, ""))) return [avatarMessage(person)];

  const cmd = matchCommand(text);
  const today = todayInBangkok();
  switch (cmd) {
    case "help":
      return [tgHelp()];
    case "today":
      return [lineTextToTg(teamDayMessage("งานของทีมวันนี้", today, await loadTasks(ctx.admin, { from: today, to: today })))];
    case "tomorrow": {
      const d = addDays(today, 1);
      return [lineTextToTg(teamDayMessage("งานของทีมพรุ่งนี้", d, await loadTasks(ctx.admin, { from: d, to: d })))];
    }
    case "pending": {
      const tasks = (await loadTasks(ctx.admin, { from: today, to: addDays(today, 7) })).filter((t) => !t.acknowledged);
      return [lineTextToTg(pendingListMessage(tasks, "team"))];
    }
    case "mine": {
      const tasks = await loadTasks(ctx.admin, { from: today, to: addDays(today, 7), personId: person.id });
      if (tasks.length === 0) return [{ text: `คุณ${esc(person.displayName)} ไม่มีงานใน 7 วันข้างหน้าครับ`, keyboard: KEYBOARD }];
      return [{ text: `📋 งานของคุณ ${tasks.length} งาน (7 วันข้างหน้า)`, keyboard: KEYBOARD }, ...tasks.slice(0, 10).map((t) => tgTask(t, "list"))];
    }
  }
  const faq = matchFaq(text);
  if (faq) return [{ text: esc(faqText(faq, false).replace("ที่เมนูด้านล่าง", "ในแชท LINE หรือที่เว็บ")) }];
  return [tgHelp()];
}

function lineTextToTg(m: { type: string; text?: string }): TgMessage {
  return tgFromLineText(m.type === "text" && m.text ? m.text : "");
}

function avatarMessage(person: LinePerson): TgMessage {
  if (!hasAvatar(person.id)) {
    return { text: `ยังไม่มีรูปการ์ตูนของคุณ${esc(person.displayName)}ครับ\nตอนนี้จอใช้รูปมาสคอตแทน รอแอดมินวาดให้` };
  }
  return {
    photo: appUrl(avatarUrl(person.id)),
    text: `รูปการ์ตูนของคุณ${esc(person.displayName)} ที่ใช้บนจอทีวีและในระบบ`,
    buttons: [[{ text: "👍 ใช้รูปนี้", callback_data: cb.avatarOk }, { text: "✏️ ขอแก้", callback_data: cb.avatarEdit }]],
  };
}

async function finishUnavailable(ctx: Ctx, person: LinePerson, assignmentId: string, reason: string): Promise<TgMessage[]> {
  const { outcome, task } = await recordUnavailable(ctx.admin, { assignmentId, personId: person.id, reason });
  if (outcome === "ok" && task) {
    await alertAdminsUnavailable(ctx.admin, task);
    return [tgTask(task, "list", [], null, new Date())];
  }
  return [{ text: outcomeText(outcome) }];
}

function outcomeText(outcome: string): string {
  return (
    {
      not_found: "ไม่พบงานนี้แล้ว อาจถูกนำชื่อออกหรือลบไปแล้ว",
      not_yours: "งานนี้ไม่ได้มอบหมายให้คุณครับ",
      closed: "งานนี้ถูกยกเลิก เลื่อน หรือปิดไปแล้ว ไม่ต้องดำเนินการ",
      already: "งานนี้แจ้งไม่สะดวกไว้แล้ว",
      acknowledged: "งานนี้คุณกดรับทราบไว้แล้ว ถ้าไปไม่ได้จริง ๆ กรุณาแจ้งแอดมินโดยตรงครับ",
    } as Record<string, string>
  )[outcome] ?? "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง";
}

async function handleCallback(ctx: Ctx, q: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  const chatId = q.message?.chat.id ?? q.from.id;
  const messageId = q.message?.message_id;
  const person = await findPersonByTelegramChatId(ctx.admin, q.from.id);
  if (!person) {
    await answerCallback(q.id, "ยังไม่ได้ผูก Telegram นี้กับ PR-OS");
    return;
  }
  const p = parseCb(q.data ?? "");
  const edit = async (m: TgMessage) => {
    if (messageId) await editTelegram(chatId, messageId, m);
    else await sendTelegram(chatId, m);
  };

  if (p.a === "a" && p.id) {
    const { outcome, task } = await recordAck(ctx.admin, { assignmentId: p.id, version: Number(p.v), personId: person.id, channel: "telegram" });
    if (outcome === "ok" || outcome === "already") {
      await answerCallback(q.id, STATUS_TOAST[outcome === "ok" ? "acked" : "already_acked"]);
      await edit(tgTask({ ...task!, acknowledged: true }, "list", [], null, outcome === "ok" ? new Date() : undefined));
      return;
    }
    if (outcome === "stale" && task) {
      await answerCallback(q.id, "งานนี้ถูกแก้หลังส่งข้อความนี้ ใช้ข้อความใหม่ด้านล่าง");
      const { changes, reason } = await loadChangeInfo(ctx.admin, task.event.id, task);
      await sendTelegram(chatId, tgTask(task, "change", changes, reason));
      return;
    }
    await answerCallback(q.id, outcomeText(outcome));
    if (outcome === "closed" && messageId) await editTelegram(chatId, messageId, { text: `ℹ️ ${esc(outcomeText(outcome))}` });
    return;
  }

  if (p.a === "u" && p.id) {
    const task = await loadTask(ctx.admin, p.id);
    if (!task || task.personId !== person.id) return void (await answerCallback(q.id, "ไม่พบงานนี้ หรืองานนี้ไม่ได้มอบหมายให้คุณแล้ว"));
    if (task.event.status !== "published") return void (await answerCallback(q.id, outcomeText("closed")));
    if (task.unavailable) return void (await answerCallback(q.id, STATUS_TOAST.already_unavailable));
    if (task.acknowledged) return void (await answerCallback(q.id, outcomeText("acknowledged")));
    await answerCallback(q.id);
    await edit(tgReasonPrompt(task));
    return;
  }

  if (p.a === "r" && p.id) {
    await clearPending(ctx.admin, stateKey(chatId));
    const reason = UNAVAILABLE_PRESETS[Number(p.v)] ?? "ไม่ระบุเหตุผล";
    const { outcome, task } = await recordUnavailable(ctx.admin, { assignmentId: p.id, personId: person.id, reason });
    if (outcome === "ok" && task) {
      await answerCallback(q.id, STATUS_TOAST.unavailable);
      await edit(tgTask(task, "list", [], null, new Date()));
      await alertAdminsUnavailable(ctx.admin, task);
      return;
    }
    await answerCallback(q.id, outcomeText(outcome));
    return;
  }

  if (p.a === "rt" && p.id) {
    await setPendingReason(ctx.admin, stateKey(chatId), p.id);
    await answerCallback(q.id);
    await sendTelegram(chatId, { text: "✏️ พิมพ์เหตุผลสั้น ๆ แล้วส่งมาได้เลยครับ (ภายใน 10 นาที)" });
    return;
  }

  if (p.a === "rc" && p.id) {
    await clearPending(ctx.admin, stateKey(chatId));
    const task: TaskItem | null = await loadTask(ctx.admin, p.id);
    await answerCallback(q.id, "ยกเลิกแล้ว งานยังอยู่ในชื่อของคุณตามเดิม");
    if (task) await edit(tgTask(task, "list"));
    return;
  }

  if (p.a === "av") {
    const ok = p.id === "ok";
    await ctx.admin.from("audit_logs").insert({
      entity_type: "person",
      entity_id: person.id,
      action: ok ? "avatar_ok" : "avatar_change_request",
      changed_by: null,
      summary: ok ? "เจ้าตัวยืนยันรูปการ์ตูน (Telegram)" : "เจ้าตัวขอแก้รูปการ์ตูน (Telegram)",
    });
    await answerCallback(q.id, ok ? "ขอบคุณครับ 👍" : "รับเรื่องแล้ว");
    if (!ok) await sendTelegram(chatId, { text: "บอกได้เลยว่าอยากแก้ตรงไหน หรือส่งรูปถ่ายใหม่ให้แอดมินทาง LINE ครับ\n(แอดมินเห็นคำขอนี้ในประวัติของคุณแล้ว)" });
    return;
  }
  await answerCallback(q.id);
}
