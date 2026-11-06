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
