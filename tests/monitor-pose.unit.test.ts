// The office TV mascot: which pose plays when (owner-approved, 21 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/monitor-pose.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { MASCOT_POSES, pickPose, poseVideo, type PoseInput } from "@/lib/monitor/mascot-pose";

const base = (over: Partial<PoseInput> = {}): PoseInput => ({
  next: { kind: "upcoming", minutes: 300 },
  ack: { total: 4, done: 4, pending: 0, unavailable: 0 },
  minutes: 13 * 60,
  ...over,
});

test("a job within 1.5 h: the megaphone, even with people still to acknowledge", () => {
  assert.equal(pickPose(base({ next: { kind: "upcoming", minutes: 90 } })), "announce");
  assert.equal(pickPose(base({ next: { kind: "upcoming", minutes: 20 }, ack: { total: 4, done: 2, pending: 2, unavailable: 0 } })), "announce");
  assert.notEqual(pickPose(base({ next: { kind: "upcoming", minutes: 91 } })), "announce");
});

test("good morning 07:00–09:00 when nothing is about to start", () => {
  assert.equal(pickPose(base({ minutes: 7 * 60 })), "wave");
  assert.equal(pickPose(base({ minutes: 8 * 60 + 59, ack: { total: 3, done: 1, pending: 2, unavailable: 0 } })), "wave");
  assert.notEqual(pickPose(base({ minutes: 9 * 60 })), "wave");
});

test("someone still to acknowledge (or ไม่สะดวก): point at the list", () => {
  assert.equal(pickPose(base({ ack: { total: 4, done: 3, pending: 1, unavailable: 0 } })), "point");
  assert.equal(pickPose(base({ ack: { total: 4, done: 3, pending: 0, unavailable: 1 } })), "point");
});

test("everyone in, or the day is done: celebrate; nothing today: idle", () => {
  assert.equal(pickPose(base()), "celebrate");
  assert.equal(pickPose(base({ next: { kind: "done" }, ack: { total: 0, done: 0, pending: 0, unavailable: 0 } })), "celebrate");
  assert.equal(pickPose(base({ next: { kind: "none" }, ack: { total: 0, done: 0, pending: 0, unavailable: 0 } })), "idle");
});

test("reactions: a new acknowledgement waves (celebrates if it was the last); a new job waves", () => {
  assert.equal(pickPose(base({ justAcknowledged: true, ack: { total: 4, done: 3, pending: 1, unavailable: 0 } })), "wave");
  assert.equal(pickPose(base({ justAcknowledged: true })), "celebrate");
  assert.equal(pickPose(base({ justAdded: true, next: { kind: "upcoming", minutes: 10 } })), "wave");
});

test("every pose has its video and poster under /monitor/mascot", () => {
  for (const p of MASCOT_POSES) {
    assert.deepEqual(poseVideo(p), {
      mp4: `/monitor/mascot/${p}.mp4`,
      webm: `/monitor/mascot/${p}.webm`,
      poster: `/monitor/mascot/${p}.jpg`,
    });
  }
});
