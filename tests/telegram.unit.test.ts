// Telegram notifications (owner, 29 Oct 2026): free, LINE stays as the fallback.
//   npx -y tsx@4.19.2 --test tests/telegram.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaskItem } from "@/lib/line/data";
import { cb, parseCb, tgReasonPrompt, tgTask, tgCancellation, tgLinked, tgTeamDay, tgPendingTeam } from "@/lib/telegram/messages";
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

test("Mini App initData: right signature in, wrong or old out", async () => {
  const { createHmac } = await import("node:crypto");
  const { verifyTelegramInitData } = await import("@/lib/liff/auth");
  const token = "123:ABC";
  const now = Date.UTC(2026, 9, 29, 8, 0) ;
  const fields: Record<string, string> = { auth_date: String(Math.floor(now / 1000) - 60), query_id: "q1", user: JSON.stringify({ id: 4242, first_name: "Kook" }) };
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  const initData = new URLSearchParams({ ...fields, hash }).toString();
  assert.equal(verifyTelegramInitData(initData, token, now), 4242);
  assert.equal(verifyTelegramInitData(initData, "999:WRONG", now), null);
  assert.equal(verifyTelegramInitData(initData.replace("4242", "4243"), token, now), null);
  assert.equal(verifyTelegramInitData(initData, token, now + 2 * 86400 * 1000), null);
});

test("messages call people by first name and stay inside Telegram's 4096 characters", () => {
  assert.match(tgLinked("นายปฐมพงษ์ หล้ามหศักดิ์").text, /คุณปฐมพงษ์(?! หล้า)/);
  const many = Array.from({ length: 300 }, (_, i) => task({ assignmentId: `a${i}`, personName: `นางสาวคน${i} นามสกุล` , event: { ...task().event, id: `e${i}` } }));
  const day = tgTeamDay("งานวันนี้", "2026-10-30", many);
  assert.ok(day.text.length <= 4096);
  assert.ok(!day.text.includes("นามสกุล"));
  assert.ok(tgPendingTeam(many).text.length <= 4096);
  assert.match(tgTeamDay("งานวันนี้", "2026-10-30", []).text, /ยังไม่มีงาน/);
});
