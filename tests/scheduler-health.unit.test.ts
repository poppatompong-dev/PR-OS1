import { test } from "node:test";
import assert from "node:assert/strict";
import { isTransientFailure, schedulerHealth } from "@/lib/notifications/health";
import { adminReportMessage } from "@/lib/line/messages";
import { WINDOWS } from "@/lib/notifications/queue";

// Bangkok = UTC+7. 10:00 Bangkok = 03:00Z.
const at = (iso: string) => new Date(iso);

test("fresh run inside the window is ok", () => {
  const h = schedulerHealth({ at: "2026-10-21T02:57:00Z" }, at("2026-10-21T03:00:00Z"));
  assert.equal(h.state, "ok");
  assert.equal(h.ageMinutes, 3);
});

test("no run for 15 minutes inside the window is stale", () => {
  assert.equal(schedulerHealth({ at: "2026-10-21T02:45:00Z" }, at("2026-10-21T03:00:00Z")).state, "stale");
});

test("night is sleeping, and just after 06:00 last night's run is not stale yet", () => {
  assert.equal(schedulerHealth({ at: "2026-10-20T13:55:00Z" }, at("2026-10-20T20:00:00Z")).state, "sleeping"); // 03:00 Bangkok
  assert.equal(schedulerHealth({ at: "2026-10-20T13:55:00Z" }, at("2026-10-20T23:05:00Z")).state, "ok"); // 06:05 Bangkok
  assert.equal(schedulerHealth({ at: "2026-10-20T13:55:00Z" }, at("2026-10-20T23:20:00Z")).state, "stale"); // 06:20 Bangkok
});

test("never ran", () => {
  assert.equal(schedulerHealth(null).state, "never");
});

test("only network errors, 429 and 5xx are retried", () => {
  for (const s of [undefined, 0, 429, 500, 503]) assert.equal(isTransientFailure(s), true, String(s));
  for (const s of [400, 401, 403, 404]) assert.equal(isTransientFailure(s), false, String(s));
});

test("17:00 report mentions failed pushes", () => {
  const m = adminReportMessage("2026-10-22", [], [], 2) as { text: string };
  assert.match(m.text, /ไม่สำเร็จ 2 ข้อความ/);
  const none = adminReportMessage("2026-10-22", [], []) as { text: string };
  assert.doesNotMatch(none.text, /ไม่สำเร็จ/);
});

test("the 07:00 summary window closes by 07:30 (no late 'good morning' pushes)", () => {
  assert.equal(WINDOWS.daily.from, 7 * 60);
  assert.ok(WINDOWS.daily.to <= 7 * 60 + 30);
});
