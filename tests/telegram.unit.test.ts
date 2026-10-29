// Telegram notifications (owner, 29 Oct 2026): free, LINE stays as the fallback.
//   npx -y tsx@4.19.2 --test tests/telegram.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaskItem } from "@/lib/line/data";
import { cb, parseCb, tgReasonPrompt, tgTask, tgCancellation } from "@/lib/telegram/messages";
import { esc } from "@/lib/telegram/api";
import { isWellFormedToken, newLinkToken } from "@/lib/telegram/link";
import { isLinkTelegramCommand } from "@/lib/line/webhook";
import { planForRow, renderLine, renderTelegram } from "@/lib/notifications/queue";

const task = (over: Partial<TaskItem> = {}): TaskItem => ({
  assignmentId: "11111111-2222-3333-4444-555555555555",
  assignmentVersion: 3,
  personId: "p1",
  personName: "คุณกุ๊ก",
  lineUserId: "U1",
  telegramChatId: 123,
  roleName: "ถ่ายภาพนิ่ง",
  acknowledged: false,
  unavailable: false,
  unavailableReason: null,
  event: {
    id: "e1", title: "ประชุม <สภา> & แถลงข่าว", eventDate: "2026-10-30", startTime: "09:00", endTime: "11:00",
    locationName: "ห้อง 1", shortNote: null, status: "published", cancellationReason: null, attachmentCount: 0,
  },
  ...over,
});

test("button data fits Telegram's 64 bytes and round-trips", () => {
  const t = task();
  for (const d of [cb.ack(t), cb.unavailable(t), cb.reason(t.assignmentId, 2), cb.typeReason(t.assignmentId), cb.cancelReason(t.assignmentId)]) {
    assert.ok(Buffer.byteLength(d) <= 64, d);
  }
  assert.deepEqual(parseCb(cb.ack(t)), { a: "a", id: t.assignmentId, v: "3" });
  assert.deepEqual(parseCb(cb.reason(t.assignmentId, 2)), { a: "r", id: t.assignmentId, v: "2" });
});

test("job titles are escaped for Telegram HTML", () => {
  assert.equal(esc("a<b>&c"), "a&lt;b&gt;&amp;c");
  const m = tgTask(task(), "assignment");
  assert.match(m.text, /ประชุม &lt;สภา&gt; &amp; แถลงข่าว/);
  assert.doesNotMatch(m.text, /<สภา>/);
});

test("open card has รับทราบ + ไม่สะดวก; acknowledged card has no buttons", () => {
  assert.equal(tgTask(task(), "assignment").buttons?.[0].length, 2);
  const done = tgTask(task({ acknowledged: true }), "list", [], null, new Date("2026-10-29T04:00:00Z"));
  assert.equal(done.buttons?.length ?? 0, 0);
  assert.match(done.text, /รับทราบแล้ว.*11:00 น\./);
  assert.equal(tgReasonPrompt(task()).buttons?.length, 5);
  assert.match(tgCancellation(task({ event: { ...task().event, status: "canceled", cancellationReason: "ฝนตก" } })).text, /ฝนตก/);
});

test("LINE and Telegram say the same thing for the same queue row", () => {
  const t = task();
  const { plan } = planForRow("assignment", t);
  assert.ok(plan);
  assert.equal(renderLine(plan!, t).type, "flex");
  assert.match(renderTelegram(plan!, t).text, /มอบหมายงานใหม่/);
  assert.equal(planForRow("assignment", task({ acknowledged: true })).plan, null);
  const c = planForRow("cancellation", task({ event: { ...t.event, status: "canceled", cancellationReason: "x" } }));
  assert.equal(c.plan?.kind, "cancel");
});

test("link tokens and the LINE command", () => {
  const tok = newLinkToken();
  assert.ok(isWellFormedToken(tok), tok);
  assert.equal(isWellFormedToken("bad token!"), false);
  assert.ok(isLinkTelegramCommand("ผูก Telegram"));
  assert.ok(isLinkTelegramCommand("ผูกเทเลแกรม"));
  assert.ok(isLinkTelegramCommand("ย้ายไป telegram"));
  assert.equal(isLinkTelegramCommand("telegram คืออะไร"), false);
});
