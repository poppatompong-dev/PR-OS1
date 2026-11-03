// TV header stats (owner, 3 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/team-stats.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { ackStats, isTestTitle, median } from "@/lib/monitor/team-stats";

const now = Date.parse("2026-11-03T05:00:00Z");
const ago = (min: number) => new Date(now - min * 60_000).toISOString();

test("ack: share acknowledged and median minutes; notices under an hour old wait", () => {
  const sent = [
    { assignmentId: "a", sentAt: ago(300), personId: "p1" },
    { assignmentId: "b", sentAt: ago(200), personId: "p2" },
    { assignmentId: "c", sentAt: ago(120) },
    { assignmentId: "d", sentAt: ago(30) }, // too fresh, not counted
  ];
  const acks = [
    { assignmentId: "a", at: ago(296) }, // 4 min
    { assignmentId: "b", at: ago(190) }, // 10 min
    { assignmentId: "b", at: ago(100) }, // later re-ack ignored
  ];
  assert.deepEqual(ackStats(sent, acks, now), { rate: 67, medianMin: 7, sent: 3, fastest: { personId: "p1", minutes: 4 } });
  assert.deepEqual(ackStats([], [], now), { rate: null, medianMin: null, sent: 0, fastest: null });
});

test("fastest = quickest over the week, not one lucky tap", () => {
  const sent = [
    { assignmentId: "a1", sentAt: ago(600), personId: "aeh" }, // 22 s once, then slow
    { assignmentId: "a2", sentAt: ago(500), personId: "aeh" },
    { assignmentId: "b1", sentAt: ago(400), personId: "pang" },
    { assignmentId: "b2", sentAt: ago(300), personId: "pang" },
    { assignmentId: "b3", sentAt: ago(200), personId: "pang" },
    { assignmentId: "c1", sentAt: ago(100), personId: "solo" }, // only one tap: not enough
  ];
  const acks = [
    { assignmentId: "a1", at: ago(600 - 22 / 60) },
    { assignmentId: "a2", at: ago(500 - 60) },
    { assignmentId: "b1", at: ago(399) },
    { assignmentId: "b2", at: ago(299.5) },
    { assignmentId: "b3", at: ago(185) },
    { assignmentId: "c1", at: ago(100 - 0.1) },
  ];
  assert.deepEqual(ackStats(sent, acks, now).fastest, { personId: "pang", minutes: 1 });
});

test("helpers", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([]), null);
  assert.equal(isTestTitle("[ทดสอบ] ถ่ายภาพ"), true);
  assert.equal(isTestTitle("ประชุมสภา"), false);
});
