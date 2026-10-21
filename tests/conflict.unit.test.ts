// "เวลาชน" vs "วันนี้มีงานอื่นด้วย" (owner, 21 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/conflict.unit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { conflictLevel } from "@/lib/assignments/conflict";

test("overlapping times clash", () => {
  assert.equal(conflictLevel({ startTime: "09:00", endTime: "12:00" }, { startTime: "11:00", endTime: "13:00" }), "clash");
});
test("less than 30 minutes apart clashes (no time to travel)", () => {
  assert.equal(conflictLevel({ startTime: "09:00", endTime: "10:00" }, { startTime: "10:20" }), "clash");
  assert.equal(conflictLevel({ startTime: "10:20" }, { startTime: "09:00", endTime: "10:00" }), "clash");
});
test("well apart on the same day is only a note", () => {
  assert.equal(conflictLevel({ startTime: "09:30", endTime: "12:30" }, { startTime: "16:30", endTime: "18:00" }), "sameDay");
  assert.equal(conflictLevel({ startTime: "09:00", endTime: "10:00" }, { startTime: "10:30" }), "sameDay");
});
test("no end time counts as one hour", () => {
  assert.equal(conflictLevel({ startTime: "09:00" }, { startTime: "09:45" }), "clash");
  assert.equal(conflictLevel({ startTime: "09:00" }, { startTime: "10:30" }), "sameDay");
});
