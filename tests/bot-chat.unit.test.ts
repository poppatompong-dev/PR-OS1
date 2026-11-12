// คุยกับบอท Telegram แบบพูดธรรมดา (5 Nov 2026) — intents, then end to end through
// handleTelegramUpdate with an in-memory database and a fake Telegram API.
import "./helpers/test-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { captureFetch, fakeDb } from "./helpers/fake-db";
import { matchIntent, roleKey, rolesIn, titleFor, PANG_ID } from "@/lib/telegram/chat";
import { addDays, todayInBangkok } from "@/lib/date";

test("intents: everyday phrasing lands on the right answer", () => {
  const cases: Array<[string, string | null]> = [
    ["พรุ่งนี้มีงานไหม", "my_tomorrow"],
    ["พรุ่งนี้มีไร", "my_tomorrow"],
    ["วันนี้มีงานไหมคะ", "my_today"],
    ["งานถัดไปกี่โมง", "my_next"],
    ["ต้องไปที่ไหน", "my_next"],
    ["ใครไปด้วย", "who_with"],
    ["สัปดาห์นี้ว่างวันไหน", "my_week"],
    ["ทิปพิธีกร", "tip"],
    ["ต้องเตรียมอะไรบ้าง", "tip"],
    ["แนบไฟล์ยังไง", "how_attach"],
    ["แนบไฟล์ที่ไหน", "how_attach"],
    ["อยากเปลี่ยนรูปทำยังไง", "how_avatar"],
    ["ไปไม่ได้ทำไง", "how_unavailable"],
    ["ส่งมุกยังไง", "how_joke"],
    ["บอททำอะไรได้บ้าง", "what_can"],
    ["ขอลุค เจ้าหญิง", "look"],
    ["ไอเดีย แข กับ แป้ง แย่งขนม", "idea"],
    ["สวัสดีค่ะ", "hello"],
    ["ขอบคุณค่ะ", "thanks"],
    ["เหนื่อยจัง", "tired"],
    ["หิวแล้ว", "hungry"],
    ["เบื่อ", "bored"],
    ["asdfgh", null],
  ];
  for (const [said, want] of cases) assert.equal(matchIntent(said), want, said);
});

test("roles and titles", () => {
  assert.equal(roleKey("ภาพนิ่ง"), "photo");
  assert.equal(roleKey("ภาพวิดีโอ"), "video");
  assert.equal(roleKey("พิธีกร"), "mc");
  assert.equal(roleKey("ถ่ายทอดสด"), "live");
  assert.deepEqual(rolesIn("ทิปถ่ายรูปกับพิธีกร"), ["photo", "mc"]);
  assert.equal(titleFor(PANG_ID, "นางสาวภัททิรา แย้มเผื่อน"), "พรินเซสแป้ง 👑");
  assert.equal(titleFor("00000000-0000-0000-0000-000000000506", "นางสาวเทียมแข กิจกล้า"), "แข");
  assert.equal(titleFor("x", "นายสมชาย ใจดี"), "คุณสมชาย");
});

// ---- end to end -------------------------------------------------------------------
const today = todayInBangkok();
const tomorrow = addDays(today, 1);
const ADMIN = "p-admin";
const KAE = "00000000-0000-0000-0000-000000000506";
const people = [
  { id: PANG_ID, display_name: "นางสาวภัททิรา แย้มเผื่อน", line_user_id: null, telegram_chat_id: 505, is_active: true },
  { id: KAE, display_name: "นางสาวเทียมแข กิจกล้า", line_user_id: null, telegram_chat_id: 506, is_active: true },
  { id: ADMIN, display_name: "นายปฐมพงษ์ หล้ามหศักดิ์", line_user_id: null, telegram_chat_id: 999, is_active: true },
];
const ev1 = { id: "e1", title: "ถ่ายภาพพิธีเปิดงานกาชาด", event_date: tomorrow, start_time: "09:00:00", end_time: "11:00:00", status: "published", deleted_at: null, location: { name: "อุทยานสวรรค์" }, attachments: [], metadata: {} };
const asg = (id: string, personId: string, role: string) => ({
  id, assignment_version: 1, person_id: personId, assignment_status: "assigned", role_names: role, unavailable_at: null,
  person: people.find((p) => p.id === personId), acknowledgements: [], event: ev1,
});
const seed = () =>
  fakeDb({
    people,
    settings: [{ key: "line_admin_person_ids", value: [ADMIN] }],
    assignments: [asg("a1", PANG_ID, "ภาพนิ่ง"), asg("a2", KAE, "ภาพวิดีโอ")],
  });
let uid = 1;
const say = async (db: any, chatId: number, text: string) => {
  const { handleTelegramUpdate } = await import("@/lib/telegram/webhook");
  const f = captureFetch();
  try {
    await handleTelegramUpdate({ admin: db }, { update_id: uid++, message: { message_id: uid, chat: { id: chatId, type: "private" }, text } } as any);
    return f.calls.filter((c) => c.url.endsWith("/sendMessage") || c.url.endsWith("/sendPhoto"));
  } finally { f.restore(); }
};
const textTo = (sent: any[], chatId: number) => sent.filter((c) => c.body.chat_id === chatId).map((c) => c.body.text ?? c.body.caption ?? "").join("\n");

test("พรินเซสแป้ง asks about tomorrow: her job, her title, a photo tip", async () => {
  const sent = await say(seed(), 505, "พรุ่งนี้มีงานไหม");
  const out = textTo(sent, 505);
  assert.match(out, /พรินเซสแป้ง/);
  assert.match(out, /ถ่ายภาพพิธีเปิดงานกาชาด/);
  assert.match(out, /อุทยานสวรรค์/);
  assert.match(out, /💡/);
});

test("ใครไปด้วย lists the teammates on the next job", async () => {
  const out = textTo(await say(seed(), 505, "ใครไปด้วย"), 505);
  assert.match(out, /เทียมแข|แข/);
  assert.match(out, /ภาพวิดีโอ/);
});

test("ขอลุค: prompt, then the wish reaches the admin and is logged", async () => {
  const db = seed();
  assert.match(textTo(await say(db, 505, "ขอลุค"), 505), /ขอลุคพิเศษ/);
  const sent = await say(db, 505, "อยากเป็นเจ้าหญิง ชุดชมพู");
  assert.match(textTo(sent, 505), /ส่งคำขอลุคถึงแอดมินแล้ว/);
  assert.match(textTo(sent, 999), /ขอลุคพิเศษ[\s\S]*พรินเซสแป้ง[\s\S]*เจ้าหญิง ชุดชมพู/);
  assert.ok(db.tables.audit_logs.some((r: any) => r.action === "look_request" && r.entity_id === PANG_ID));
});

test("ไอเดีย inline goes straight to the admin with the author", async () => {
  const db = seed();
  const sent = await say(db, 506, "ไอเดีย แข กับ แป้ง แย่งขนมชิ้นสุดท้าย");
  assert.match(textTo(sent, 506), /ได้ไอเดียแล้ว/);
  assert.match(textTo(sent, 999), /ไอเดียแก็ก[\s\S]*แข[\s\S]*แย่งขนม/);
});

test("how-to and the don't-understand reply", async () => {
  assert.match(textTo(await say(seed(), 506, "แนบไฟล์ยังไง"), 506), /แนบไฟล์/);
  assert.match(textTo(await say(seed(), 506, "บอททำอะไรได้บ้าง"), 506), /ไอเดีย/);
  assert.match(textTo(await say(seed(), 506, "qwerty zz"), 506), /แม่งงนิดนึง/);
});

test("the old commands still work as before", async () => {
  assert.match(textTo(await say(seed(), 505, "งานของฉัน"), 505), /งานของฉัน/);
  assert.match(textTo(await say(seed(), 505, "มุก"), 505), /ส่งมุกขึ้นจอทีวี/);
});

test("07:00 summary: greets by title and carries one tip line for the first job's role", async () => {
  const { tgDailySummary } = await import("@/lib/telegram/messages");
  const t: any = {
    assignmentId: "a", assignmentVersion: 1, personId: PANG_ID, personName: "นางสาวภัททิรา แย้มเผื่อน", lineUserId: null, telegramChatId: 505,
    roleName: "พิธีกร", acknowledged: true, unavailable: false, unavailableReason: null, removed: false,
    event: { id: "e", title: "งาน", icon: null, eventDate: today, startTime: "09:00", endTime: null, locationName: "ห้อง 1", shortNote: null, status: "published", cancellationReason: null, attachmentCount: 0, mapPoints: [] },
  };
  const m = tgDailySummary(t.personName, [t], []);
  assert.match(m.text, /อรุณสวัสดิ์ครับ พรินเซสแป้ง/);
  assert.equal((m.text.match(/💡/g) ?? []).length, 1);
});

// ---- โหมดแม่ ------------------------------------------------------------------------
const PAI = "00000000-0000-0000-0000-000000000501";
const withPai = () => {
  const db = seed();
  db.tables.people.push({ id: PAI, display_name: "นางสาวภนิตา ชะรัดรัมย์", line_user_id: null, telegram_chat_id: 501, is_active: true });
  return db;
};

test("โหมดแม่: on by default — แม่ calls you ลูก, work facts unchanged", async () => {
  const out = textTo(await say(seed(), 505, "พรุ่งนี้มีงานไหม"), 505);
  assert.match(out, /พรินเซสแป้งของแม่/);
  assert.match(out, /แม่จดไว้ให้แล้ว/);
  assert.match(out, /ถ่ายภาพพิธีเปิดงานกาชาด[\s\S]*อุทยานสวรรค์/);
  assert.match(textTo(await say(seed(), 506, "เหนื่อยจัง"), 506), /แม่|ลูก/);
});

test("โหมดแม่: พี่ไป๋ always gets the polite voice, even if asked", async () => {
  const db = withPai();
  const hi = textTo(await say(db, 501, "สวัสดีค่ะ"), 501);
  assert.doesNotMatch(hi, /แม่|ลูก/);
  assert.match(textTo(await say(db, 501, "เปิดโหมดแม่"), 501), /แบบปกติ/);
  assert.doesNotMatch(textTo(await say(db, 501, "สวัสดีค่ะ"), 501), /แม่|ลูก/);
});

test("โหมดแม่: \"ปิดโหมดแม่\" sticks (saved on the person), \"เปิดโหมดแม่\" brings it back", async () => {
  const db = seed();
  assert.match(textTo(await say(db, 506, "ปิดโหมดแม่"), 506), /ปิดโหมดแม่แล้ว/);
  assert.equal(db.tables.people.find((p: any) => p.id === KAE).metadata.mom, "off");
  assert.doesNotMatch(textTo(await say(db, 506, "เหนื่อยจัง"), 506), /แม่|ลูก/);
  assert.match(textTo(await say(db, 506, "เปิดโหมดแม่"), 506), /เปิดโหมดแม่แล้วค่ะลูกแข/);
  assert.match(textTo(await say(db, 506, "ขอบคุณค่ะ"), 506), /ลูก/);
});

test("โหมดแม่ never touches the 07:00 summary", async () => {
  const { tgDailySummary } = await import("@/lib/telegram/messages");
  const t: any = { personId: KAE, personName: "x", roleName: "ภาพนิ่ง", acknowledged: true, unavailable: false, event: { title: "ง", icon: null, eventDate: today, startTime: "09:00", endTime: null, locationName: "ห้อง", status: "published" } };
  assert.doesNotMatch(tgDailySummary("x", [t], []).text, /แม่/);
});

test("โหมดแม่: women on the team only — the men and anyone unlisted get the plain voice", async () => {
  const db = seed();
  db.tables.people.push(
    { id: "00000000-0000-0000-0000-000000000502", display_name: "นายธนันธร พันธุ์รอด", line_user_id: null, telegram_chat_id: 502, is_active: true },
    { id: "00000000-0000-0000-0000-000000000503", display_name: "นายประชารักษ์ ประทุมโทน", line_user_id: null, telegram_chat_id: 503, is_active: true },
  );
  for (const [chat, text] of [[502, "สวัสดีครับ"], [503, "เหนื่อยจัง"], [999, "ขอบคุณครับ"]] as const) {
    assert.doesNotMatch(textTo(await say(db, chat, text), chat), /แม่|ลูก/, `${chat} ${text}`);
  }
  assert.match(textTo(await say(db, 502, "เปิดโหมดแม่"), 502), /แบบปกติ/);
  assert.doesNotMatch(textTo(await say(db, 502, "สวัสดีครับ"), 502), /แม่|ลูก/);
  assert.match(textTo(await say(db, 506, "สวัสดีค่ะ"), 506), /แม่|ลูก/);
});

// ---- คำถามที่บอทตอบไม่ได้ → แอดมิน → ตอบกลับผ่านบอท (6 Nov 2026) ----------------
import { looksLikeQuestion } from "@/lib/telegram/questions";

const EARTH = "00000000-0000-0000-0000-000000000502";
const seedQ = () =>
  fakeDb({
    people: [...people, { id: EARTH, display_name: "นายธนันธร พันธุ์รอด", line_user_id: null, telegram_chat_id: 502, is_active: true }],
    settings: [{ key: "line_admin_person_ids", value: [ADMIN, EARTH] }],
    assignments: [asg("a1", PANG_ID, "ภาพนิ่ง"), asg("a2", KAE, "ภาพวิดีโอ")],
  });
const replyTo = async (db: any, chatId: number, repliedText: string, text: string) => {
  const { handleTelegramUpdate } = await import("@/lib/telegram/webhook");
  const f = captureFetch();
  try {
    await handleTelegramUpdate({ admin: db }, { update_id: uid++, message: { message_id: uid, chat: { id: chatId, type: "private" }, text, reply_to_message: { message_id: 7, text: repliedText } } } as any);
    return f.calls.filter((c) => c.url.endsWith("/sendMessage"));
  } finally { f.restore(); }
};

test("what counts as a question for the admins", () => {
  for (const q of ["เบิกค่าเดินทางยังไงคะ", "ชุดวันจันทร์ใส่สีอะไร", "upload pdf ได้มั้ย?"]) assert.equal(looksLikeQuestion(q), true, q);
  for (const q of ["5555", "ฮ่าๆๆ", "โอเคค่ะ", "👍👍", "qwerty zz", "ค่ะ"]) assert.equal(looksLikeQuestion(q), false, q);
});

test("a question the bot can't answer reaches both admins, and the answer comes back", async () => {
  const db = seedQ();
  const ask = await say(db, 506, "ชุดวันจันทร์งานต้อนรับใส่สีอะไรคะ");
  assert.match(textTo(ask, 506), /ส่งคำถามนี้ถึงแอดมิน|ส่งคำถามถึงแอดมินแล้ว/);
  const toAdmin = textTo(ask, 999);
  assert.match(toAdmin, /คำถามจาก แข[\s\S]*ชุดวันจันทร์[\s\S]*#Q[A-Z0-9]{5}/);
  assert.match(textTo(ask, 502), /#Q[A-Z0-9]{5}/);
  assert.ok(db.tables.audit_logs.some((r: any) => r.action === "team_question" && r.entity_id === KAE));

  const ans = await replyTo(db, 502, toAdmin, "ชุดผ้าไทยโทนสีชมพูนะ");
  assert.match(textTo(ans, 506), /แอดมินตอบคำถามแล้ว[\s\S]*ชุดผ้าไทยโทนสีชมพู[\s\S]*คำถาม: ชุดวันจันทร์/);
  assert.match(textTo(ans, 502), /ส่งคำตอบถึงแขแล้ว/);
  assert.match(textTo(ans, 999), /ตอบคำถาม #Q[A-Z0-9]{5} ของแขแล้ว/);
  assert.ok(db.tables.audit_logs.some((r: any) => r.action === "team_answer" && r.entity_id === KAE));
});

test("questions: laughs still get the gentle reply, admins' own odd texts are not forwarded, staff can't answer", async () => {
  const db = seedQ();
  const laugh = await say(db, 505, "55555");
  assert.equal(textTo(laugh, 999), "");
  assert.match(textTo(laugh, 505), /งงนิดนึง|ยังไม่เข้าใจ/);
  const own = await say(db, 502, "ช่วยดูให้หน่อยว่าทำไมทีวีไม่ขึ้น");
  assert.equal(textTo(own, 999), "");
  // a staff member replying to a #Q text is just chat, nothing is sent to the asker
  const ask = await say(db, 506, "เบิกค่าเดินทางยังไงคะ");
  const fake = await replyTo(db, 505, textTo(ask, 999), "ไม่รู้เหมือนกัน");
  assert.equal(textTo(fake, 506), "");
});

// ---- คำตอบสำเร็จรูป (owner, 9 Nov 2026) ---------------------------------------------
import { isAnnounceQuestion } from "@/lib/telegram/chat";

test("ready answers: everyday questions land on the right one, old intents unchanged", () => {
  const cases: Array<[string, string | null]> = [
    ["จะแก้เวลางานยังไงคะ", "faq_edit"],
    ["อยากเลื่อนงานวันศุกร์", "faq_edit"],
    ["กดรับทราบตรงไหน", "faq_ack"],
    ["ทำไมไม่มีแจ้งเตือนเลย", "faq_notify"],
    ["ปิดเสียงยังไง", "faq_mute"],
    ["ไปงานนี้ไปยังไง", "faq_nav"],
    ["ขอแผนที่หน่อย", "faq_nav"],
    ["ลิงก์ทีวีคืออะไร", "faq_tv"],
    ["ยังต้องใช้ไลน์ไหม", "faq_line"],
    ["ประชุมออนไลน์กี่โมง", "my_next"],
    ["วันนี้ใครไปงานบ้าง", "team_day"],
    ["ใครไปด้วย", "who_with"],
    ["ต้องไปที่ไหน", "my_next"],
    ["แนบไฟล์ยังไง", "how_attach"],
  ];
  for (const [said, want] of cases) assert.equal(matchIntent(said), want, said);
  assert.equal(isAnnounceQuestion("ประกาศยังไงคะ"), true);
  assert.equal(isAnnounceQuestion("ประกาศ ได้ไหม?"), true);
  assert.equal(isAnnounceQuestion("ประกาศ บ่ายนี้ประชุม 14.00"), false);
});

test("ready answers end to end: no admin is bothered, the announce question posts nothing", async () => {
  const db = seedQ();
  const edit = await say(db, 506, "จะแก้เวลางานยังไงคะ");
  assert.match(textTo(edit, 506), /รายการงาน/);
  assert.equal(textTo(edit, 999), "");
  const ann = await say(db, 506, "ประกาศยังไงคะ");
  assert.match(textTo(ann, 506), /ประกาศ ข้อความ/);
  assert.equal((db.tables.announcements ?? []).length, 0);
  const team = await say(db, 506, "พรุ่งนี้ใครไปงานบ้าง");
  assert.match(textTo(team, 506), /ถ่ายภาพพิธีเปิดงานกาชาด/);
});

// ---- 9 Nov 2026: real chatter reached the admins ------------------------------------
test("real messages from 9 Nov: chatter gets a friendly reply, only questions go to the admins", async () => {
  const db = seedQ();
  for (const said of ["ขอเตือนให้พกสติดีกว่านะคะ เพราะกำหนดการหน้างานเปลี่ยนแปลงเสมอ5555", "อากาศร้อน", "ยินดีกับนักวิ่งอีลีทพี่แขที่ได้รับถ้วยรางวัลค่า"]) {
    const sent = await say(db, 505, said);
    assert.equal(textTo(sent, 999), "", said);
    assert.equal(textTo(sent, 502), "", said);
    assert.match(textTo(sent, 505), /ประกาศ|ดูแลตัวเอง|ดื่มน้ำ/, said);
  }
  const look = await say(db, 505, "อยากเปลี่ยนฉายา");
  assert.match(textTo(look, 505), /ขอลุคพิเศษ/); // the prompt, waiting for details
  assert.equal(textTo(look, 999), "");
  const q = await say(db, 506, "งานกาชาดต้องแต่งชุดอะไรคะ");
  assert.match(textTo(q, 999), /คำถามจาก แข/);
});

test("a joke typed without มุก gets the how-to, not the admins (12 Nov 2026)", async () => {
  const { looksLikeJoke, jokeHintText } = await import("@/lib/telegram/questions");
  assert.equal(looksLikeJoke("ลูกเล่นบาสอยู่แล้วแม่ไปตาม ทำไมลูกถึงปาบอลใส่แม่? .....เพราะแม่เป็นห่วง"), true);
  assert.equal(looksLikeJoke("จะแก้เวลางานยังไง?"), false);
  assert.equal(looksLikeJoke("ทำไมงานพรุ่งนี้ไม่ขึ้น"), false);
  assert.match(jokeHintText("ทำไมลูกถึงปาบอลใส่แม่? .....เพราะแม่เป็นห่วง"), /มุก ทำไมลูกถึงปาบอลใส่แม่\? \| เพราะแม่เป็นห่วง/);
});

test("a non-owner admin's question reaches the other admins (12 Nov 2026)", async () => {
  const db = seedQ();
  const ask = await say(db, 502, "เบิกค่าเดินทางยังไงครับ");
  assert.match(textTo(ask, 999), /คำถามจาก[\s\S]*เบิกค่าเดินทาง/);
  assert.equal(textTo(ask, 502).includes("#Q"), false);
});

test("คู่มือ: admins get the head guide, others don't", async () => {
  const db = seedQ();
  assert.match(textTo(await say(db, 502, "คู่มือ"), 502), /คู่มือสั้น ๆ สำหรับ[\s\S]*รายงาน 17\.00[\s\S]*ตอบกลับ \(Reply\)/);
  assert.doesNotMatch(textTo(await say(db, 506, "คู่มือ"), 506), /คู่มือสั้น ๆ สำหรับ/);
});

test("what the bot didn't understand is kept for the help panel (12 Nov 2026)", async () => {
  const db = seed();
  await say(db, 506, "asdf ghjk");
  assert.ok(db.tables.audit_logs.some((r: any) => r.action === "bot_unknown" && r.entity_id === KAE && r.new_values?.text === "asdf ghjk"));
});

test("พี่เอิร์ธ types แบบ 2 → thanked and passed to the admins, not 'ไม่เข้าใจ' (12 Nov 2026)", async () => {
  const db = seedQ();
  const pick = await say(db, 502, "แบบ 2");
  assert.match(textTo(pick, 502), /รับทราบครับ แบบ 2/);
  assert.match(textTo(pick, 999), /เลือกแบบโฆษณามุกเต็มจอ: แบบ 2/);
  assert.ok(!db.tables.audit_logs.some((r: any) => r.action === "bot_unknown"));
});

test("น้องบอทชวนคุย: opt in/out by words; a reply to today's line goes to the 🆘 panel, not the admins (12 Nov 2026)", async () => {
  const { parseBuddyCommand } = await import("@/lib/telegram/buddy");
  assert.equal(parseBuddyCommand("หยุดชวนคุย ครับ"), "off");
  assert.equal(parseBuddyCommand("ชวนคุย"), "on");
  assert.equal(parseBuddyCommand("ชวนคุยกับใครดี"), null);
  const db = seedQ();
  // not opted in → the usual flow (a question goes to the admins)
  assert.match(textTo(await say(db, 502, "เมื่อคืนบอลใครชนะครับ"), 999), /คำถามจาก/);
  assert.match(textTo(await say(db, 502, "ชวนคุย"), 502), /จัดไปครับ/);
  db.tables.audit_logs.push({ id: "bm1", entity_type: "person", entity_id: EARTH, action: "buddy_msg", new_values: { message: "x" }, changed_at: new Date().toISOString() });
  const r = await say(db, 502, "เมื่อคืนหงส์ชนะครับ ดูไหม");
  assert.match(textTo(r, 502), /น้องบอทมาคุยต่อ/);
  assert.equal(textTo(r, 999), "");
  assert.ok(db.tables.audit_logs.some((x: any) => x.action === "bot_unknown" && x.new_values?.buddy === true));
  assert.match(textTo(await say(db, 502, "หยุดชวนคุย"), 502), /ไม่ชวนคุยแล้ว/);
  assert.match(textTo(await say(db, 502, "เมื่อคืนบอลใครชนะครับ"), 999), /คำถามจาก/);
});
