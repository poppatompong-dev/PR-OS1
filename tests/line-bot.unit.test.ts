// Unit tests for the LINE bot pieces that do not need a network or a database.
//   npx -y tsx@4.19.2 --test tests/line-bot.unit.test.ts
//
// They pin down the rules the owner set (19 Oct 2026) and the hard limits of
// the LINE API, which fail silently in production if broken: an over-long
// altText or button label makes LINE reject the whole message with a 400.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifySignature } from "@/lib/line/api";
import {
  adminReportMessage,
  dailySummaryMessage,
  parsePostback,
  postback,
  taskBubble,
  taskCarousel,
  taskMessage,
  teamDayMessage,
  unavailableReasonPrompt,
} from "@/lib/line/messages";
import { matchCommand } from "@/lib/line/webhook";
import { richMenuDefinition, RICH_MENU_BUTTONS } from "@/lib/line/rich-menu";
import { bangkokClock, messageForRow, WINDOWS } from "@/lib/notifications/queue";
import { safeNextPath } from "@/lib/auth/next-path";
import type { TaskItem } from "@/lib/line/data";

function task(over: Partial<TaskItem> = {}, ev: Partial<TaskItem["event"]> = {}): TaskItem {
  return {
    assignmentId: "11111111-2222-3333-4444-555555555555",
    assignmentVersion: 2,
    personId: "p1",
    personName: "ทดสอบ ระบบ",
    lineUserId: "U123",
    roleName: "ถ่ายภาพ",
    acknowledged: false,
    unavailable: false,
    unavailableReason: null,
    ...over,
    event: {
      id: "e1",
      title: "พิธีเปิดงานประจำปีของเทศบาลนครนครสวรรค์ ณ บริเวณลานหน้าอาคารสำนักงาน",
      eventDate: "2026-10-20",
      startTime: "09:00",
      endTime: "12:00",
      locationName: "ลานหน้าสำนักงานเทศบาล",
      shortNote: "แต่งกายชุดสุภาพ",
      status: "published",
      cancellationReason: null,
      ...ev,
    },
  };
}

/** Walk any flex JSON and collect every action object. */
function actions(node: unknown, out: Array<Record<string, string>> = []) {
  if (Array.isArray(node)) node.forEach((n) => actions(n, out));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.action && typeof o.action === "object") out.push(o.action as Record<string, string>);
    Object.values(o).forEach((v) => actions(v, out));
  }
  return out;
}

test("webhook signature: accepts LINE's HMAC, rejects anything else", () => {
  const body = JSON.stringify({ events: [] });
  const sig = createHmac("sha256", "s3cret").update(body).digest("base64");
  assert.equal(verifySignature(body, sig, "s3cret"), true);
  assert.equal(verifySignature(body + " ", sig, "s3cret"), false);
  assert.equal(verifySignature(body, sig, "other"), false);
  assert.equal(verifySignature(body, null, "s3cret"), false);
  assert.equal(verifySignature(body, "not-base64!!", "s3cret"), false);
  assert.equal(verifySignature(body, sig, ""), false, "no secret configured must never verify");
});

test("commands: tolerant of spacing and a question mark, nothing else matches", () => {
  assert.equal(matchCommand("งานของฉัน"), "mine");
  assert.equal(matchCommand("ทีมวันนี้"), "today");
  assert.equal(matchCommand("ทีมพรุ่งนี้"), "tomorrow");
  assert.equal(matchCommand("ยังไม่รับทราบ"), "pending");
  assert.equal(matchCommand(" งาน วันนี้ "), "today");
  assert.equal(matchCommand("งานพรุ่งนี้?"), "tomorrow");
  assert.equal(matchCommand("ใครยังไม่รับทราบ"), "pending");
  assert.equal(matchCommand("HELP"), "help");
  // ordinary group chatter must not wake the bot
  assert.equal(matchCommand("วันนี้ใครว่างบ้าง"), null);
  assert.equal(matchCommand("ส่งรูปงานวันนี้ให้หน่อย"), null);
});

test("task card: buttons follow the person's state", () => {
  const labels = (t: TaskItem) => actions(taskBubble(t, "assignment")).map((a) => a.label);
  assert.deepEqual(labels(task()), ["รับทราบ", "ไม่สะดวก", "งานของฉัน (ล่าสุด)"]);
  assert.deepEqual(labels(task({ unavailable: true, unavailableReason: "ลา" })), ["รับทราบ", "งานของฉัน (ล่าสุด)"]);
  assert.deepEqual(labels(task({ acknowledged: true })), ["งานของฉัน (ล่าสุด)"]);
  // the list from "งานของฉัน" itself keeps the web link instead
  assert.deepEqual(actions(taskBubble(task(), "list")).map((a) => a.label), ["รับทราบ", "ไม่สะดวก", "ดูรายละเอียด"]);
});

test("postback data round-trips and carries the version being acknowledged", () => {
  const t = task();
  const p = parsePostback(postback.ack(t));
  assert.deepEqual(p, { a: "ack", id: t.assignmentId, v: "2" });
  assert.ok(postback.ack(t).length <= 300);
});

test("LINE limits: altText ≤ 400, labels ≤ 20, carousel ≤ 12, text ≤ 5000", () => {
  const long = task({}, { title: "ก".repeat(600) });
  const m = taskMessage(long, "change", [{ field: "start", label: "เวลาเริ่ม", from: "09:00", to: "10:00" }]);
  assert.equal(m.type, "flex");
  assert.ok(m.type === "flex" && m.altText.length <= 400);

  const many = Array.from({ length: 30 }, (_, i) => task({ assignmentId: `a${i}` }));
  const c = taskCarousel(many, "x".repeat(500));
  assert.ok(c.type === "flex" && (c.contents.contents as unknown[]).length === 12);
  assert.ok(c.type === "flex" && c.altText.length <= 400);

  for (const a of actions(taskBubble(task(), "reminder"))) assert.ok(a.label.length <= 20, a.label);
  for (const f of ["title", "date", "start", "end", "location"] as const) {
    const c = [{ field: f, label: "x", from: "a", to: "b" }];
    for (const a of actions(taskBubble(task(), "change", c))) assert.ok(a.label.length <= 20, a.label);
  }
  const prompt = unavailableReasonPrompt("a1", "งาน");
  for (const item of prompt.quickReply!.items) assert.ok(item.action.label.length <= 20, item.action.label);

  const day = teamDayMessage("งานวันนี้", "2026-10-20", Array.from({ length: 200 }, (_, i) => task({ assignmentId: `b${i}`, personName: `คน${i}` }, { id: `e${i}` })));
  assert.ok(day.type === "text" && day.text.length <= 5000);
});

test("07:00 summary counts only work still waiting for a tap", () => {
  const m = dailySummaryMessage("แป้ง", [task({ acknowledged: true })], [task(), task({ unavailable: true })]);
  assert.ok(m.type === "text" && m.text.includes("ยังไม่รับทราบ 1 งาน"));
  const done = dailySummaryMessage("แป้ง", [task({ acknowledged: true })], []);
  assert.ok(done.type === "text" && done.text.includes("รับทราบครบ"));
});

test("17:00 admin report flags people with no LINE linked", () => {
  const m = adminReportMessage("2026-10-21", [task({ lineUserId: null })], [task({ unavailable: true, unavailableReason: "ลา" })]);
  assert.ok(m.type === "text");
  assert.ok(m.text.includes("ยังไม่ผูก LINE"));
  assert.ok(m.text.includes("ต้องหาคนแทน") || m.text.includes("ยังไม่ได้หาคนแทน"));
});

test("queue rules: reminder only for people who have not acknowledged", () => {
  const early = { now: new Date("2026-10-19T00:00:00Z") }; // the day before the sample event
  assert.equal(messageForRow("reminder", task(), undefined, early).message !== null, true);
  assert.equal(messageForRow("reminder", task({ acknowledged: true }), undefined, early).skipReason, "รับทราบแล้ว ไม่ต้องเตือน");
  assert.equal(messageForRow("reminder", task({ unavailable: true }), undefined, early).skipReason, "แจ้งไม่สะดวกแล้ว");
  assert.equal(messageForRow("assignment", task({}, { status: "draft" })).message, null);
  assert.ok(messageForRow("cancellation", task({}, { status: "canceled", cancellationReason: "ฝนตก" })).message);
  assert.equal(messageForRow("assignment", null).message, null);
});

test("reminders never arrive after the start, nor at a superseded time", () => {
  const t = task({}, { eventDate: "2026-10-20", startTime: "21:30" });
  // cron's first run next morning
  assert.equal(messageForRow("reminder", t, undefined, { now: new Date("2026-10-20T23:00:00Z") }).skipReason, "เลยเวลาเริ่มงานแล้ว");
  // queued for 09:00 start, event since moved to 21:30
  const r = messageForRow("reminder", t, undefined, { now: new Date("2026-10-20T00:00:00Z"), scheduledFor: "2026-10-20T00:30:00Z" });
  assert.match(r.skipReason ?? "", /เวลางานเปลี่ยน/);
  // on time: 21:30 − 1.5 h = 20:00 Bangkok = 13:00 UTC
  assert.ok(messageForRow("reminder", t, undefined, { now: new Date("2026-10-20T13:00:00Z"), scheduledFor: "2026-10-20T13:00:00Z" }).message);
});

test("Bangkok clock and the send windows", () => {
  // 2026-10-20 00:05 UTC = 07:05 Bangkok
  const c = bangkokClock(new Date("2026-10-20T00:05:00Z"));
  assert.deepEqual(c, { date: "2026-10-20", month: "2026-10", minutes: 7 * 60 + 5 });
  assert.ok(c.minutes >= WINDOWS.daily.from && c.minutes < WINDOWS.daily.to);
  // 2026-10-31 17:30 UTC is already 1 Nov in Bangkok — month rolls with Thai time
  assert.equal(bangkokClock(new Date("2026-10-31T17:30:00Z")).month, "2026-11");
  const evening = bangkokClock(new Date("2026-10-20T10:00:00Z")); // 17:00
  assert.ok(evening.minutes >= WINDOWS.adminReport.from && evening.minutes < WINDOWS.adminReport.to);
});

test("rich menu: six areas tile the whole 2500×843 image without gaps", () => {
  const def = richMenuDefinition() as { areas: Array<{ bounds: { x: number; y: number; width: number; height: number }; action: Record<string, string> }> };
  assert.equal(def.areas.length, RICH_MENU_BUTTONS.length);
  const area = def.areas.reduce((s, a) => s + a.bounds.width * a.bounds.height, 0);
  assert.equal(area, 2500 * 843);
  for (const a of def.areas) {
    assert.ok(a.bounds.x + a.bounds.width <= 2500 && a.bounds.y + a.bounds.height <= 843);
    assert.ok(a.action.label.length <= 20);
  }
});

test("after-login redirect stays on this site", () => {
  assert.equal(safeNextPath("/mobile/my-tasks"), "/mobile/my-tasks");
  assert.equal(safeNextPath("/api/auth/line/start"), "/api/auth/line/start");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("/\\evil.example"), "/");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath(undefined), "/");
  // browsers strip tab/newline, which would turn these into //evil.example
  assert.equal(safeNextPath("/\t/evil.example"), "/");
  assert.equal(safeNextPath("/\n/evil.example"), "/");
  assert.equal(safeNextPath("/schedule?view=week"), "/schedule?view=week");
});

// Owner, 22 Oct 2026: a tap on รับทราบ / ไม่สะดวก must visibly answer with the new status.
test("status card after a tap: coloured status header, saved time, no action buttons", async () => {
  const { statusCardMessage, bangkokHhmm } = await import("@/lib/line/messages");
  const at = new Date("2026-10-22T11:23:00Z"); // 18:23 Bangkok
  assert.equal(bangkokHhmm(at), "18:23");
  const kinds = ["acked", "already_acked", "unavailable", "already_unavailable"] as const;
  for (const k of kinds) {
    const t = k.includes("unavailable") ? task({ unavailable: true, unavailableReason: "เวลาชนกับงานอื่น" }) : task({ acknowledged: true });
    const m = statusCardMessage(t, k, at);
    assert.equal(m.type, "flex");
    if (m.type !== "flex") continue;
    assert.ok(m.altText.length <= 400);
    const json = JSON.stringify(m.contents);
    assert.ok(!json.includes('"postback"'), `${k}: no รับทราบ/ไม่สะดวก buttons on a done card`);
    assert.ok(json.includes(t.event.title));
    if (k === "acked" || k === "unavailable") assert.ok(json.includes("บันทึกเมื่อ 18:23 น."));
    assert.ok(json.includes(k.includes("unavailable") ? "⛔" : "✅"));
    assert.ok((m.quickReply?.items.length ?? 0) > 0);
    for (const it of m.quickReply!.items) assert.ok(it.action.label.length <= 20);
  }
});
