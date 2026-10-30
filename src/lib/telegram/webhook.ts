// What the Telegram bot does with each update (owner, 29 Oct 2026). Private
// chats only: everything is a free send, so there is no reply-token race like
// LINE's, but the bot still only speaks when spoken to.

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayInBangkok } from "@/lib/date";
import { alertAdminsUnavailable, tellAdminsByTelegram } from "@/lib/line/alerts";
import { getAvatarChoice, saveAvatarSource, setAvatarChoice } from "@/lib/avatar-choice";
import { PHOTO_PROMPT } from "@/lib/line/webhook";
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
  setPendingAction,
  takePendingAction,
  takePendingReason,
  withinRateLimit,
  type LinePerson,
  type TaskItem,
} from "@/lib/line/data";
import { matchCommand } from "@/lib/line/webhook";
import { faqText, matchFaq } from "@/lib/line/faq";
import { UNAVAILABLE_PRESETS, appUrl } from "@/lib/line/messages";
import { announceDoneText, createAnnouncement, parseAnnounceCommand } from "@/lib/announcements";
import { avatarUrl, hasAvatar } from "@/lib/avatars";
import { answerCallback, downloadTelegramFile, editTelegram, esc, sendTelegram, type TgMessage } from "@/lib/telegram/api";
import { consumeLinkToken, unlinkTelegram } from "@/lib/telegram/link";
import { TRIAL_STEPS, markTrial, trialDone } from "@/lib/trial";
import {
  KEYBOARD,
  STATUS_TOAST,
  cb,
  parseCb,
  tgPendingTeam,
  tgTeamDay,
  tgHelp,
  tgLinked,
  tgTour,
  tgTourDone,
  tgTrial,
  tgTrialComplete,
  tgNotLinked,
  tgReasonPrompt,
  tgTask,
  tgAddEvent,
  tgJobs,
} from "@/lib/telegram/messages";

export type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string };
    text?: string;
    photo?: Array<{ file_id: string; file_size?: number; width: number; height: number }>;
    document?: { file_id: string; mime_type?: string; file_size?: number };
  };
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
  if (!m || m.chat.type !== "private") return;
  const chatId = m.chat.id;
  if (!(await withinRateLimit(ctx.admin, stateKey(chatId)))) return;
  if (m.photo?.length || (m.document && (m.document.mime_type ?? "").startsWith("image/"))) {
    const fileId = m.photo?.length ? m.photo[m.photo.length - 1].file_id : m.document!.file_id;
    const out = await handlePhoto(ctx, chatId, fileId);
    for (const msg of out) await sendTelegram(chatId, msg);
    return;
  }
  if (typeof m.text !== "string") return;
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
    if (res.ok) return [tgLinked(res.displayName), tgTour(0)];
    const why = {
      invalid: "ลิงก์นี้ใช้ไม่ได้",
      expired: "ลิงก์หมดอายุแล้ว (30 นาที)",
      used: "ลิงก์นี้ใช้ไปแล้ว",
      inactive: "บัญชีนี้ถูกระงับ · ติดต่อแอดมิน",
      taken: "ผูกไม่สำเร็จ ลองใหม่อีกครั้ง",
    }[res.reason];
    return [{ text: `⚠️ <b>${why}</b>\n\n🔁 ขอลิงก์ใหม่: ใน LINE "ผู้ช่วยงาน ปชส." พิมพ์ <b>ผูก Telegram</b>` }];
  }
  if (raw === "/stop") {
    const name = await unlinkTelegram(ctx.admin, chatId);
    return [{ text: name ? `🔕 <b>เลิกรับแจ้งทาง Telegram แล้ว</b>\nแจ้งเตือนกลับไปทาง LINE · ผูกใหม่ได้ทุกเมื่อ` : "ℹ️ Telegram นี้ยังไม่ได้ผูกกับใคร" }];
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
  if (/^(รูปของฉัน|รูปฉัน|avatar)$/i.test(text.replace(/\s+/g, ""))) {
    const r = await markTrial(ctx.admin, person.id, "avatar").catch(() => null);
    const out = [await avatarMessage(ctx, person)];
    if (r?.first && r.done >= TRIAL_STEPS.length) out.push(tgTrialComplete());
    return out;
  }
  if (/^(ภารกิจ|ภารกิจทดสอบ|\/test)$/i.test(text.replace(/\s+/g, ""))) {
    const { data } = await ctx.admin.from("people").select("metadata").eq("id", person.id).maybeSingle();
    return [tgTrial(trialDone(data?.metadata), TRIAL_STEPS)];
  }
  if (/^(ทัวร์|ทัวร|tour|\/tour)$/i.test(text.replace(/\s+/g, ""))) return [tgTour(0)];

  const cmd = matchCommand(text);
  const today = todayInBangkok();
  switch (cmd) {
    case "help":
      return [tgHelp()];
    case "today":
      return [tgTeamDay("งานวันนี้", today, await loadTasks(ctx.admin, { from: today, to: today }))];
    case "tomorrow": {
      const d = addDays(today, 1);
      return [tgTeamDay("งานพรุ่งนี้", d, await loadTasks(ctx.admin, { from: d, to: d }))];
    }
    case "pending": {
      const tasks = (await loadTasks(ctx.admin, { from: today, to: addDays(today, 7) })).filter((t) => !t.acknowledged);
      return [tgPendingTeam(tasks)];
    }
    case "mine": {
      const tasks = await loadTasks(ctx.admin, { from: today, to: addDays(today, 7), personId: person.id });
      if (tasks.length === 0) return [{ text: "🎉 ไม่มีงานใน 7 วันข้างหน้า", keyboard: KEYBOARD }];
      return [{ text: `📋 <b>งานของฉัน</b> · 7 วันข้างหน้า · ${tasks.length} งาน`, keyboard: KEYBOARD }, ...tasks.slice(0, 10).map((t) => tgTask(t, "list"))];
    }
  }
  if (/^(📋)?(รายการงาน|แก้งาน|แก้ไขงาน|จัดการงาน|ยกเลิกงาน|เลื่อนงาน|ลบงาน|\/jobs)$/.test(text.replace(/\s+/g, ""))) return [tgJobs()];
  if (/^(เพิ่มงาน|สร้างงาน|\/add)/.test(text.replace(/\s+/g, ""))) return [tgAddEvent()];
  const faq = matchFaq(text);
  if (faq === "start" || faq === "telegram") return [tgHelp()];
  if (faq) return [{ text: esc(faqText(faq, false).replace("ที่เมนูด้านล่าง", "ในแชท LINE หรือที่เว็บ")) }];
  return [tgHelp()];
}


async function avatarMessage(ctx: Ctx, person: LinePerson): Promise<TgMessage> {
  const photoBtn = { text: "📷 ส่งรูปให้ทำใหม่", callback_data: cb.avatarPhoto };
  if (!hasAvatar(person.id)) {
    return { text: "🖼 <b>ยังไม่มีรูปการ์ตูนของคุณ</b>\nตอนนี้จอโชว์แค่ชื่อ · อยากได้ กด 📷 แล้วส่งรูปมา", buttons: [[photoBtn]] };
  }
  const off = (await getAvatarChoice(ctx.admin, person.id)) === "off";
  return {
    photo: appUrl(avatarUrl(person.id)),
    text: off
      ? "🖼 <b>รูปการ์ตูนของคุณ</b>\nตอนนี้ตั้งไว้ 🚫 ไม่ใช้รูป (จอโชว์แค่ชื่อ)"
      : "🖼 <b>รูปการ์ตูนของคุณ</b> บนจอทีวี\nชอบไหมครับ? 👇",
    buttons: [
      [{ text: "👍 ใช้รูปนี้", callback_data: cb.avatarOk }, { text: "🚫 ไม่ใช้รูป", callback_data: cb.avatarOff }],
      [photoBtn],
    ],
  };
}

async function handlePhoto(ctx: Ctx, chatId: number, fileId: string): Promise<TgMessage[]> {
  const person = await findPersonByTelegramChatId(ctx.admin, chatId);
  if (!person) return [tgNotLinked()];
  if (!(await takePendingAction(ctx.admin, stateKey(chatId), "avatar_photo"))) {
    return [{ text: '📷 จะส่งรูปให้ทำการ์ตูนใหม่?\nพิมพ์ "รูปของฉัน" → กด "📷 ส่งรูปให้ทำใหม่" ก่อนนะครับ' }];
  }
  const file = await downloadTelegramFile(fileId);
  if (!file || !(await saveAvatarSource(ctx.admin, person.id, file.bytes, file.contentType, "telegram"))) {
    return [{ text: '⚠️ รับรูปไม่สำเร็จ (ไฟล์เกิน 10 MB?)\nพิมพ์ "รูปของฉัน" แล้วลองใหม่ครับ' }];
  }
  await tellAdminsByTelegram(ctx.admin, `📷 ${esc(person.displayName)} ส่งรูปจริงมาให้ทำการ์ตูนใหม่ (ทาง Telegram) · ดูได้ใน Supabase Storage › avatar-sources`);
  return [{ text: "🙏 <b>ได้รับรูปแล้ว</b>\n🎨 วาดเสร็จจะส่ง 2–3 แบบให้เลือกที่นี่\n🔒 รูปจริงลบทิ้งเมื่อวาดเสร็จ" }];
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

  if (p.a === "t") {
    const tick = async (key: "tour" | "demo") => {
      const r = await markTrial(ctx.admin, person.id, key).catch(() => null);
      if (r?.first && r.done >= TRIAL_STEPS.length) await sendTelegram(chatId, tgTrialComplete());
    };
    if (p.id === "demo") {
      await answerCallback(q.id, "👍 แบบนี้แหละ · ของจริงจะบันทึกในระบบทันที");
      return void (await tick("demo"));
    }
    await answerCallback(q.id);
    await edit(p.id === "done" ? tgTourDone() : tgTour(Number(p.id)));
    if (p.id === "done") await tick("tour");
    return;
  }

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
    await sendTelegram(chatId, { text: "✏️ พิมพ์เหตุผลสั้น ๆ ส่งมาได้เลย (ภายใน 10 นาที)" });
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
    if (p.id === "photo") {
      await setPendingAction(ctx.admin, stateKey(chatId), "avatar_photo");
      await answerCallback(q.id);
      await sendTelegram(chatId, { text: esc(PHOTO_PROMPT) });
      return;
    }
    const choice = p.id === "off" ? "off" : "on";
    await setAvatarChoice(ctx.admin, person.id, choice, "telegram");
    await answerCallback(q.id, choice === "on" ? "👍 ใช้รูปนี้ ขอบคุณครับ" : "🚫 ไม่ใช้รูป · จอโชว์แค่ชื่อ");
    if (choice === "off") await sendTelegram(chatId, { text: '🚫 <b>ไม่ใช้รูปแล้ว</b> · จอโชว์แค่ชื่อ\nเปลี่ยนใจ: พิมพ์ "รูปของฉัน" → 👍' });
    return;
  }
  await answerCallback(q.id);
}
