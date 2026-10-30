// รายการงาน on the phone (owner, 30 Oct 2026: "ต้อง crud รายการงานได้ เห็นชัด ใช้ง่าย").
//   npx -y tsx@4.19.2 --test tests/liff-manage.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { canManage, planAssignees, significantFields } from "@/lib/liff/manage-event";
import { isJobsCommand } from "@/lib/line/webhook";
import { KEYBOARD, tgJobs, tgTrial } from "@/lib/telegram/messages";
import { TRIAL_STEPS } from "@/lib/trial";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const R2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("people: added, taken off, duties changed — order of duties does not count", () => {
  const cur = [
    { id: "x", personId: A, roleIds: [R1, R2] },
    { id: "y", personId: B, roleIds: [R1] },
  ];
  const plan = planAssignees(cur, [
    { personId: A, roleIds: [R2, R1] },
    { personId: C, roleIds: [R1] },
  ]);
  assert.deepEqual(plan.added.map((a) => a.personId), [C]);
  assert.deepEqual(plan.removed.map((r) => r.id), ["y"]);
  assert.equal(plan.changed.length, 0);
  const again = planAssignees(cur, [{ personId: B, roleIds: [R2] }, { personId: A, roleIds: [R1, R2] }]);
  assert.deepEqual(again.changed.map((c) => [c.id, c.newRoleIds]), [["y", [R2]]]);
});

test("only title / date / time / place reset acknowledgement", () => {
  const before = { title: "ถ่ายภาพ", event_date: "2026-11-02", start_time: "09:00:00", end_time: null, location_id: null };
  const same = { title: "ถ่ายภาพ", eventDate: "2026-11-02", startTime: "09:00", endTime: null, locationId: null };
  assert.deepEqual(significantFields(before, same), []);
  assert.deepEqual(significantFields(before, { ...same, startTime: "10:30", locationId: A }), ["เวลาเริ่ม", "สถานที่"]);
});

test("team web roles manage any job; a LINE-only person only the jobs they gave out", () => {
  const ev = { created_by: null, metadata: { created_by_person_id: A } };
  assert.equal(canManage("supervisor", { personId: B, userId: "u" }, ev), true);
  assert.equal(canManage(null, { personId: A, userId: null }, ev), true);
  assert.equal(canManage(null, { personId: B, userId: null }, ev), false);
  assert.equal(canManage("display", { personId: B, userId: "u" }, ev), false);
  assert.equal(canManage("assignee", { personId: B, userId: "u2" }, { created_by: "u2", metadata: {} }), true);
});

test("the way in: LINE words, Telegram keyboard and buttons", () => {
  assert.equal(isJobsCommand("รายการงาน"), true);
  assert.equal(isJobsCommand(" แก้ งาน "), true);
  assert.equal(isJobsCommand("แก้งานเลื่อนพรุ่งนี้"), false);
  assert.ok(KEYBOARD.flat().includes("📋 รายการงาน"));
  const m = tgJobs();
  const btn = m.buttons?.[0]?.[0] as { web_app?: { url: string } };
  assert.match(btn.web_app?.url ?? "", /\/liff\/add-event\/jobs\?tg=1$/);
});

test("the test mission greets the person by name when sent by the admin button", () => {
  const m = tgTrial(new Set(["avatar"]), TRIAL_STEPS, "นางสาวเทียมแข กิจกล้า");
  assert.match(m.text, /คุณเทียมแข/);
  assert.match(m.text, /1\/4/);
  assert.doesNotMatch(tgTrial(new Set(), TRIAL_STEPS).text, /👋/);
});
