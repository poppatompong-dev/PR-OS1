// One person, several duties; typed place; photo previews (owner, 26 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/multi-role.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeAssignees, normalizeRoleIds, roleColumns, sameRoles } from "@/lib/assignments/roles";
import { parseLiffEventInput } from "@/lib/liff/create-event";
import { cleanPlace } from "@/lib/locations/resolve";
import { ackLabelFor, diffRoles } from "@/lib/line/change-diff";
import { fileKind, parseStagedList, thumbPathFor } from "@/lib/attachments/rules";
import { taskBubble } from "@/lib/line/messages";
import type { TaskItem } from "@/lib/line/data";

const id = (n: number) => `0000000${n}-aaaa-4bbb-8ccc-${String(n).padStart(12, "0")}`;
const [R1, R2, R3, P1, P2] = [1, 2, 3, 4, 5].map(id);

test("duty ids: valid, first-picked order, no repeats", () => {
  assert.deepEqual(normalizeRoleIds([R2, "x", R1, R2, null]), [R2, R1]);
  assert.deepEqual(normalizeRoleIds(R1), [R1]);
  assert.deepEqual(normalizeRoleIds(undefined), []);
  assert.deepEqual(roleColumns([R2, R1, R3]), { role_id: R2, extra_role_ids: [R1, R3] });
  assert.ok(sameRoles([R1, R2], [R2, R1]));
  assert.ok(!sameRoles([R1], [R1, R2]));
});

test("same person picked twice → one row with both duties (one card)", () => {
  assert.deepEqual(
    mergeAssignees([
      { personId: P1, roleIds: [R1] },
      { personId: P2, roleIds: [R3] },
      { personId: P1, roleIds: [R2, R1] },
    ]),
    [
      { personId: P1, roleIds: [R1, R2] },
      { personId: P2, roleIds: [R3] },
    ],
  );
});

const base = { title: "งาน", eventDate: "2026-10-28", startTime: "09:00" };

test("LINE form: roleIds per person, old roleId still accepted, place typed", () => {
  const r = parseLiffEventInput({
    ...base,
    locationText: "  วัด   คีรีวงศ์ ",
    assignees: [
      { personId: P1, roleIds: [R1, R2] },
      { personId: P1, roleId: R3 },
      { personId: P2, roleId: R1 },
    ],
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.input.locationText, "วัด คีรีวงศ์");
  assert.deepEqual(r.input.assignees, [
    { personId: P1, roleIds: [R1, R2, R3] },
    { personId: P2, roleIds: [R1] },
  ]);
  const none = parseLiffEventInput({ ...base, assignees: [{ personId: P1, roleIds: [] }] });
  assert.equal(none.ok, false);
});

test("typed place is trimmed and capped; empty means no place", () => {
  assert.equal(cleanPlace("   "), null);
  assert.equal(cleanPlace("x".repeat(200))?.length, 120);
});

function task(roleName: string): TaskItem {
  return {
    assignmentId: id(9),
    assignmentVersion: 2,
    personId: P1,
    personName: "คุณกุ๊ก",
    lineUserId: "U1",
    roleName,
    acknowledged: false,
    unavailable: false,
    unavailableReason: null,
    event: {
      id: id(8),
      title: "ตักบาตร",
      eventDate: "2026-10-28",
      startTime: "06:30",
      endTime: null,
      locationName: "ริมเขื่อน",
      shortNote: null,
      status: "published",
      cancellationReason: null,
    },
  };
}

test("duty change card: old → new duties, its own acknowledge label, no repeated row", () => {
  const t = task("ช่างภาพนิ่ง · ทำข่าว / ข้อมูล");
  const changes = diffRoles({ role_names: "ช่างภาพนิ่ง" }, t);
  assert.deepEqual(changes, [{ field: "role", label: "หน้าที่", from: "ช่างภาพนิ่ง", to: "ช่างภาพนิ่ง · ทำข่าว / ข้อมูล" }]);
  assert.equal(ackLabelFor(changes), "รับทราบหน้าที่ใหม่");
  assert.deepEqual(diffRoles({ role_names: "ช่างภาพนิ่ง · ทำข่าว / ข้อมูล" }, t), []);
  const json = JSON.stringify(taskBubble(t, "change", changes));
  assert.equal(json.split("ช่างภาพนิ่ง · ทำข่าว / ข้อมูล").length - 1, 1, "new duties shown once (in the change line)");
  assert.ok(json.includes("รับทราบหน้าที่ใหม่"));
});

test("card for several duties lists them all", () => {
  const json = JSON.stringify(taskBubble(task("ช่างภาพนิ่ง · ทำข่าว / ข้อมูล"), "assignment"));
  assert.ok(json.includes("ช่างภาพนิ่ง · ทำข่าว / ข้อมูล"));
});

test("photo preview path and tile kinds", () => {
  assert.equal(thumbPathFor(`${id(8)}/${id(7)}.png`), `${id(8)}/${id(7)}.thumb.jpg`);
  assert.equal(fileKind("application/pdf", "a.pdf").label, "PDF");
  assert.equal(fileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx").label, "Word");
  assert.equal(fileKind("application/vnd.ms-excel", "a.xls").label, "Excel");
  assert.equal(fileKind("image/jpeg", "a.jpg").tone, "img");
});

test("staged photo keeps its preview; a PDF or a bad path never gets one", () => {
  const photo = { path: `staging/${id(1)}.jpg`, fileName: "ป้าย.jpg", mimeType: "image/jpeg", sizeBytes: 1000, thumbPath: `staging/${id(2)}.jpg` };
  const pdf = { path: `staging/${id(3)}.pdf`, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1000, thumbPath: `staging/${id(4)}.jpg` };
  const bad = { ...photo, path: `staging/${id(5)}.jpg`, thumbPath: "../x.jpg" };
  const out = parseStagedList([photo, pdf, bad]);
  assert.equal(out[0].thumbPath, photo.thumbPath);
  assert.equal("thumbPath" in out[1], false);
  assert.equal("thumbPath" in out[2], false);
});
