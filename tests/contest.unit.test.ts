// ประกวดมุก chip (10 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { contestChip, contestState } from "@/lib/monitor/contest";

test("open → days left, last day, judging, then gone", () => {
  assert.equal(contestState(new Date("2026-11-09T12:00:00+07:00"), 0), null);
  assert.deepEqual(contestState(new Date("2026-11-10T13:00:00+07:00"), 3), { phase: "open", daysLeft: 10, submitted: 3 });
  assert.match(contestChip(contestState(new Date("2026-11-10T13:00:00+07:00"), 3))!, /เหลือ 10 วัน · ส่งแล้ว 3 มุก/);
  assert.match(contestChip(contestState(new Date("2026-11-20T09:00:00+07:00"), 9))!, /วันสุดท้าย/);
  assert.match(contestChip(contestState(new Date("2026-11-20T17:00:00+07:00"), 9))!, /ปิดรับมุกแล้ว 9 มุก/);
  assert.equal(contestState(new Date("2026-11-24T09:00:00+07:00"), 9), null);
});
