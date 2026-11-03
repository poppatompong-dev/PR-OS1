// TV header stats (owner, 3 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/team-stats.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { ackStats, isTestTitle, median } from "@/lib/monitor/team-stats";

const now = Date.parse("2026-11-03T05:00:00Z");
const ago = (min: number) => new Date(now - min * 60_000).toISOString();

test("ack: share acknowledged and median minutes; notices under an hour old wait", () => {
  const sent = [
    { assignmentId: "a", sentAt: ago(300) },
    { assignmentId: "b", sentAt: ago(200) },
    { assignmentId: "c", sentAt: ago(120) },
    { assignmentId: "d", sentAt: ago(30) }, // too fresh, not counted
  ];
  const acks = [
    { assignmentId: "a", at: ago(296) }, // 4 min
    { assignmentId: "b", at: ago(190) }, // 10 min
    { assignmentId: "b", at: ago(100) }, // later re-ack ignored
  ];
  assert.deepEqual(ackStats(sent, acks, now), { rate: 67, medianMin: 7, sent: 3 });
  assert.deepEqual(ackStats([], [], now), { rate: null, medianMin: null, sent: 0 });
});

test("helpers", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([]), null);
  assert.equal(isTestTitle("[ทดสอบ] ถ่ายภาพ"), true);
  assert.equal(isTestTitle("ประชุมสภา"), false);
});
