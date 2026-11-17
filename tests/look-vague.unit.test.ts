// ขอลุคแบบไม่บอกรายละเอียด → บอทถามเจ้าตัวเอง (17 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lookAskMore, matchIntent, vagueLook } from "@/lib/telegram/chat";

test("vagueLook: ไม่มีรายละเอียด = ถามต่อ", () => {
  for (const t of ["ลุคของฉัน", "ลุค", "ลุคใหม่ค่ะ", "ขอลุคหน่อย", "อยากได้ลุคใหม่ 💕", "ลุคแบบไหนก็ได้"]) assert.equal(vagueLook(t), true, t);
  for (const t of ["ชุดไทยสีชมพูถือกระทง", "ลุคนักบินอวกาศ เรียกว่ากัปตันกุ๊ก", "นางฟ้า"]) assert.equal(vagueLook(t), false, t);
});

test("matchIntent: 'ลุค' เดี่ยว ๆ เข้าใจว่าขอลุค", () => {
  assert.equal(matchIntent("ลุค"), "look");
  assert.equal(matchIntent("ลุคของฉัน"), "look");
  assert.equal(matchIntent("ขอลุค ชุดไทย"), "look");
});

test("lookAskMore: ถามกลับพร้อมตัวอย่าง", () => {
  assert.match(lookAskMore("ลูกนัท", true), /บอกแม่หน่อย/);
  assert.match(lookAskMore("คุณสมัชชา", false), /แบบไหนครับคุณสมัชชา/);
});
