// Bot answers common how-to questions by itself (owner, 29 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/line-faq.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { FAQ_GROUP_COOLDOWN_MIN, faqCooldownKey, faqText, matchFaq } from "@/lib/line/faq";
import { matchCommand } from "@/lib/line/webhook";

test("Kook's real message and other ways to ask", () => {
  assert.equal(matchFaq("เพิ่มงาน เข้าร่วมประชุม"), "add");
  assert.equal(matchFaq("สร้างงานยังไงครับ"), "add");
  assert.equal(matchFaq("แนบรูปยังไง"), "attach");
  assert.equal(matchFaq("ขอดูไฟล์แนบหน่อย"), "attach");
  assert.equal(matchFaq("เลื่อนงานพรุ่งนี้ได้ไหม"), "edit");
  assert.equal(matchFaq("จอทีวีดูยังไง"), "monitor");
  assert.equal(matchFaq("เริ่มใช้ยังไงครับ"), "start");
  assert.equal(matchFaq("มาใหม่ครับ ต้องทำอะไรบ้าง"), "start");
  assert.equal(matchFaq("Telegram ใช้ยังไง"), "telegram");
});

test("ordinary chat stays quiet", () => {
  assert.equal(matchFaq("วันนี้ฝนตกหนัก"), null);
  assert.equal(matchFaq("รับทราบครับ"), null);
  assert.equal(matchFaq("พี่ช่วยเพิ่มงานให้หน่อย"), null); // the word is not at the start
  assert.equal(matchFaq(""), null);
  // Long messages are conversation, not a question for the bot.
  assert.equal(matchFaq("แนบรูป" + "ก".repeat(70)), null);
});

test("commands still win over the how-to", () => {
  assert.equal(matchCommand("งานวันนี้"), "today");
  assert.equal(matchFaq("งานวันนี้"), null);
});

test("once per 30 minutes per group and topic", () => {
  const t0 = Date.UTC(2026, 9, 29, 2, 0);
  const a = faqCooldownKey("G1", "add", t0);
  assert.equal(faqCooldownKey("G1", "add", t0 + 10 * 60_000), a);
  assert.notEqual(faqCooldownKey("G1", "add", t0 + FAQ_GROUP_COOLDOWN_MIN * 60_000), a);
  assert.notEqual(faqCooldownKey("G1", "attach", t0), a);
  assert.notEqual(faqCooldownKey("G2", "add", t0), a);
});

test("answers carry the form link and say where to tap", () => {
  assert.match(faqText("add", true), /liff\.line\.me\/2012111983-DSltRC7H/);
  assert.match(faqText("add", true), /แชทส่วนตัว/);
  assert.doesNotMatch(faqText("add", false), /แชทส่วนตัว/);
  assert.match(faqText("attach", true), /5 ไฟล์/);
  assert.match(faqText("monitor", true), /\/tv/);
});
