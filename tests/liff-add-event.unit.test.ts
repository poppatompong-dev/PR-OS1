import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLiffEventInput, sameDayReminderAt } from "@/lib/liff/create-event";
import { richMenuDefinition } from "@/lib/line/rich-menu";
import { LIFF_ADD_EVENT_URL } from "@/lib/liff/config";

const P = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";
const base = { title: " ถ่ายภาพ ", eventDate: "2026-10-21", startTime: "10:00" };

test("valid input is trimmed; draft unless publish === true", () => {
  const r = parseLiffEventInput({ ...base, assignees: [{ personId: P, roleId: R }] });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.input.title, "ถ่ายภาพ");
  assert.equal(r.input.publish, false);
  assert.equal(r.input.assignees.length, 1);
  const p = parseLiffEventInput({ ...base, publish: "true" });
  assert.ok(p.ok && p.input.publish === false, "only boolean true publishes");
});

test("rejects missing title, bad date/time, end before start", () => {
  assert.equal(parseLiffEventInput({ ...base, title: "  " }).ok, false);
  assert.equal(parseLiffEventInput({ ...base, eventDate: "21/10/2026" }).ok, false);
  assert.equal(parseLiffEventInput({ ...base, startTime: "25:00" }).ok, false);
  assert.equal(parseLiffEventInput({ ...base, endTime: "09:30" }).ok, false);
  assert.equal(parseLiffEventInput({ ...base, endTime: "11:00" }).ok, true);
});

test("assignees: half-filled rows rejected, empty rows and duplicates dropped", () => {
  assert.equal(parseLiffEventInput({ ...base, assignees: [{ personId: P, roleId: "" }] }).ok, false);
  const r = parseLiffEventInput({
    ...base,
    assignees: [{ personId: "", roleId: "" }, { personId: P, roleId: R }, { personId: P, roleId: R }],
  });
  assert.ok(r.ok && r.input.assignees.length === 1);
});

test("1.5-hour reminder only when still ahead", () => {
  const now = new Date("2026-10-21T01:00:00Z"); // 08:00 Bangkok
  assert.equal(sameDayReminderAt("2026-10-21", "10:00", now)?.toISOString(), "2026-10-21T01:30:00.000Z");
  assert.equal(sameDayReminderAt("2026-10-21", "09:00", now), null);
});

test("rich menu: เพิ่มงาน (left column, bottom) opens the LIFF form", () => {
  const def = richMenuDefinition() as { areas: Array<{ bounds: { x: number }; action: { type: string; uri?: string; label: string } }> };
  const add = def.areas[3];
  assert.equal(add.bounds.x, 0);
  assert.equal(add.action.type, "uri");
  assert.equal(add.action.uri, LIFF_ADD_EVENT_URL);
  assert.equal(add.action.label, "เพิ่มงาน");
});
