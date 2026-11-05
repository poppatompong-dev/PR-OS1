// "น้อง ๆ ยังเข้าใจว่าใช้ LINE อยู่" (5 Nov 2026): the LINE bot, end to end
// through handleLineEvent with an in-memory database and a fake LINE API.
import "./helpers/test-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { captureFetch, fakeDb } from "./helpers/fake-db";

const PEOPLE = [
  { id: "p-moved", display_name: "นางสาวภัททิรา แย้มเผื่อน", line_user_id: "U-moved", telegram_chat_id: 555, is_active: true },
  { id: "p-line", display_name: "นางสาวภนิตา ชะรัดรัมย์", line_user_id: "U-line", telegram_chat_id: null, is_active: true },
];
const ev = (userId: string, text: string) => ({ type: "message", replyToken: `r-${Math.random()}`, source: { type: "user", userId }, message: { type: "text", text } });
const replyText = (calls: Array<{ url: string; body: any }>) =>
  calls.filter((c) => c.url.includes("/message/reply")).flatMap((c) => c.body.messages.map((m: any) => m.text ?? m.altText ?? "")).join("\n");

test("LINE: someone already on Telegram is pointed there (with the bot link)", async () => {
  const { handleLineEvent } = await import("@/lib/line/webhook");
  const f = captureFetch("pros_test_bot");
  try {
    await handleLineEvent({ admin: fakeDb({ people: PEOPLE }) }, ev("U-moved", "งานวันนี้") as any);
    const out = replyText(f.calls);
    assert.match(out, /ย้ายไปใช้ Telegram แล้ว/);
    assert.match(out, /https:\/\/t\.me\/pros_test_bot/);
  } finally { f.restore(); }
});

test("LINE: \"ผูก Telegram\" still gives a fresh link even after moving", async () => {
  const { handleLineEvent } = await import("@/lib/line/webhook");
  const f = captureFetch("pros_test_bot");
  try {
    await handleLineEvent({ admin: fakeDb({ people: PEOPLE }) }, ev("U-moved", "ผูก Telegram") as any);
    const out = replyText(f.calls);
    assert.match(out, /ลิงก์ผูก Telegram/);
    assert.match(out, /t\.me\/pros_test_bot\?start=/);
  } finally { f.restore(); }
});

test("LINE: someone not on Telegram yet keeps the normal LINE answers", async () => {
  const { handleLineEvent } = await import("@/lib/line/webhook");
  const f = captureFetch();
  try {
    await handleLineEvent({ admin: fakeDb({ people: PEOPLE }) }, ev("U-line", "วิธีใช้") as any);
    const out = replyText(f.calls);
    assert.ok(out.length > 0, "got a reply");
    assert.doesNotMatch(out, /ย้ายไปใช้ Telegram แล้ว/);
  } finally { f.restore(); }
});
