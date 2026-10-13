// Send-time rules for the notification queue (src/lib/notifications/rules.ts)
// and the message text the supervisors and assignees receive.
// Run: node --experimental-strip-types --import ./tests/unit/register.mjs --test tests/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideDelivery, digestWindow, bangkokDate } from "@/lib/notifications/rules";
import { buildDigestText, buildNotificationText } from "@/lib/notifications/templates";

const NOW = new Date("2026-10-14T03:00:00Z"); // 10:00 Bangkok
const event = (over = {}) => ({
  status: "published",
  deletedAt: null,
  eventDate: "2026-10-14",
  startTime: "14:00:00",
  ...over,
});
const assignment = (over = {}) => ({
  status: "assigned",
  version: 2,
  acknowledgedVersions: [],
  declinedVersion: null,
  ...over,
});
const base = { scheduledFor: "2026-10-14T05:30:00Z", now: NOW }; // 12:30 Bangkok = start - 90 min

test("same-day reminder: unacknowledged goes out as queued (LINE)", () => {
  assert.deepEqual(
    decideDelivery({ ...base, type: "reminder", event: event(), assignment: assignment() }),
    { send: true, channel: "as_queued" },
  );
});

test("same-day reminder: acknowledged goes by email only, saving LINE quota", () => {
  const d = decideDelivery({
    ...base,
    type: "reminder",
    event: event(),
    assignment: assignment({ acknowledgedVersions: [2] }),
  });
  assert.deepEqual(d, { send: true, channel: "email_only" });
});

test("an acknowledgement of an older version does not count", () => {
  const d = decideDelivery({
    ...base,
    type: "reminder",
    event: event(),
    assignment: assignment({ acknowledgedVersions: [1] }),
  });
  assert.deepEqual(d, { send: true, channel: "as_queued" });
});

test("advance reminder a day out is not treated as same-day", () => {
  const d = decideDelivery({
    type: "reminder",
    scheduledFor: "2026-10-13T07:00:00Z",
    now: NOW,
    event: event(),
    assignment: assignment({ acknowledgedVersions: [2] }),
  });
  assert.deepEqual(d, { send: true, channel: "as_queued" });
});

test("reminder is skipped for someone who said ไม่สะดวก on this version", () => {
  const d = decideDelivery({ ...base, type: "reminder", event: event(), assignment: assignment({ declinedVersion: 2 }) });
  assert.equal(d.send, false);
  assert.match(d.reason, /ไม่สะดวก/);
});

test("a ไม่สะดวก given before a significant edit no longer applies", () => {
  const d = decideDelivery({ ...base, type: "reminder", event: event(), assignment: assignment({ declinedVersion: 1 }) });
  assert.equal(d.send, true);
});

test("removed, cancelled, deleted and past work is skipped with a reason", () => {
  const cases = [
    [{ type: "reminder", event: event(), assignment: assignment({ status: "removed" }) }, /นำออก/],
    [{ type: "reminder", event: event({ status: "canceled" }), assignment: assignment() }, /เผยแพร่/],
    [{ type: "assignment", event: event({ deletedAt: "2026-10-13T00:00:00Z" }), assignment: assignment() }, /ลบ/],
    [{ type: "reminder", event: event({ startTime: "09:00" }), assignment: assignment() }, /เลยเวลา/],
    [{ type: "escalation", event: event({ startTime: "09:00" }), openCounts: { pending: 1, declined: 0 } }, /เลยเวลา/],
  ];
  for (const [input, reason] of cases) {
    const d = decideDelivery({ ...base, ...input });
    assert.equal(d.send, false, JSON.stringify(input));
    assert.match(d.reason, reason);
  }
});

test("cancellation notices still go out for a cancelled event", () => {
  const d = decideDelivery({ ...base, type: "cancellation", event: event({ status: "canceled" }), assignment: assignment() });
  assert.equal(d.send, true);
});

test("escalation only when someone is still open", () => {
  const none = decideDelivery({ ...base, type: "escalation", event: event(), openCounts: { pending: 0, declined: 0 } });
  assert.equal(none.send, false);
  assert.match(none.reason, /ทุกคนรับทราบ/);
  const some = decideDelivery({ ...base, type: "escalation", event: event(), openCounts: { pending: 0, declined: 1 } });
  assert.equal(some.send, true);
});

test("declined notice is dropped once the person acknowledges or is replaced", () => {
  const acked = decideDelivery({
    ...base,
    type: "declined",
    event: event(),
    assignment: assignment({ declinedVersion: 2, acknowledgedVersions: [2] }),
  });
  assert.equal(acked.send, false);
  const replaced = decideDelivery({ ...base, type: "declined", event: event(), assignment: assignment({ status: "removed", declinedVersion: 2 }) });
  assert.equal(replaced.send, false);
  const open = decideDelivery({ ...base, type: "declined", event: event(), assignment: assignment({ declinedVersion: 2 }) });
  assert.equal(open.send, true);
});

test("digest window: only on the same Bangkok day, after the hour", () => {
  assert.equal(digestWindow(new Date("2026-10-14T09:59:00Z"), 17), null); // 16:59
  const w = digestWindow(new Date("2026-10-14T10:05:00Z"), 17); // 17:05
  assert.deepEqual(w, { dueAt: "2026-10-14T10:00:00.000Z", forDate: "2026-10-15", today: "2026-10-14" });
  // 23:30 Bangkok is 16:30 UTC the same day; 00:30 Bangkok is already the next day
  assert.equal(digestWindow(new Date("2026-10-14T16:30:00Z"), 17)?.forDate, "2026-10-15");
  assert.equal(bangkokDate(new Date("2026-10-14T17:30:00Z")), "2026-10-15");
  // the scheduler was down all evening: by 00:30 "tomorrow" is today — send nothing
  assert.equal(digestWindow(new Date("2026-10-14T17:30:00Z"), 17), null);
  // month and year roll-over
  assert.equal(digestWindow(new Date("2026-12-31T11:00:00Z"), 17)?.forDate, "2027-01-01");
  assert.equal(digestWindow(new Date("2026-10-14T10:05:00Z"), 24), null);
});

test("digest text lists tomorrow's work in time order with each answer", () => {
  const { subject, body } = buildDigestText(
    "2026-10-15",
    [
      { startTime: "09:00", title: "พิธีเปิด", locationName: "ศาลาว่าการ", roleName: "ช่างภาพ", answer: "pending" },
      { startTime: "13:30", title: "ประชุมสภา", locationName: "ห้องประชุมสภา", roleName: "ผู้เขียนข่าว", answer: "acknowledged" },
      { startTime: "16:00", title: "ตลาดนัด", locationName: "พาสาน", roleName: "พิธีกร", answer: "declined" },
    ],
    "https://pr-os1.vercel.app/mobile/my-tasks",
  );
  assert.match(subject, /3 งาน/);
  const lines = body.split("\n");
  assert.match(lines[1], /^• 09:00 พิธีเปิด @ ศาลาว่าการ \(ช่างภาพ\) — ยังไม่รับทราบ$/);
  assert.match(lines[2], /^• 13:30 ประชุมสภา @ ห้องประชุมสภา \(ผู้เขียนข่าว\)$/);
  assert.match(lines[3], /แจ้งไม่สะดวกแล้ว$/);
  assert.match(lines[4], /กดรับทราบได้ที่: https:\/\/pr-os1\.vercel\.app\/mobile\/my-tasks/);
});

test("supervisor notices name the people and the reason, and link to the job", () => {
  const ctx = {
    eventTitle: "พิธีเปิด",
    eventDate: "2026-10-15",
    startTime: "09:00",
    locationName: "ศาลาว่าการ",
    roleName: "ช่างภาพ",
    ackUrl: "https://x/mobile/my-tasks",
    eventUrl: "https://x/events/e1",
    personName: "นาย ก",
    declineReason: "ติดประชุม",
    pendingPeople: ["นาย ข (พิธีกร)"],
    declinedPeople: ["นาย ก (ช่างภาพ)"],
  };
  const declined = buildNotificationText("declined", ctx).body;
  assert.match(declined, /ผู้รับงาน: นาย ก \(ช่างภาพ\)/);
  assert.match(declined, /เหตุผล: ติดประชุม/);
  assert.match(declined, /https:\/\/x\/events\/e1/);
  const escalation = buildNotificationText("escalation", ctx).body;
  assert.match(escalation, /ยังไม่รับทราบ: นาย ข \(พิธีกร\)/);
  assert.match(escalation, /แจ้งไม่สะดวก: นาย ก \(ช่างภาพ\)/);
});
