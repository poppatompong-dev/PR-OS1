// Owner, 22 Oct 2026: jobs move often — earlier, later, on hold, people swapped.
// These pin down what each assignee is told in every one of those cases.
//   npx -y tsx@4.19.2 --test tests/flexible-jobs.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { messageForRow } from "@/lib/notifications/queue";
import { taskMessage } from "@/lib/line/messages";
import { shiftDate, shiftTime } from "@/app/events/[id]/edit/ShiftButtons";
import type { TaskItem } from "@/lib/line/data";

function task(over: Partial<TaskItem> = {}, ev: Partial<TaskItem["event"]> = {}): TaskItem {
  return {
    assignmentId: "a1",
    assignmentVersion: 3,
    personId: "p1",
    personName: "ป๊อปปี้",
    lineUserId: "U1",
    roleName: "ทำข่าว",
    acknowledged: false,
    unavailable: false,
    unavailableReason: null,
    ...over,
    event: {
      id: "e1",
      title: "ประชุมสภาเทศบาล สมัยสามัญ",
      eventDate: "2026-10-28",
      startTime: "09:30",
      endTime: "12:00",
      locationName: "ห้องประชุมสภาเทศบาลนครนครสวรรค์",
      shortNote: null,
      status: "published",
      cancellationReason: null,
      ...ev,
    },
  };
}

const json = (m: unknown) => JSON.stringify(m);
const postbacks = (m: unknown) => (json(m).match(/"postback"/g) ?? []).length;

test("change card carries the editor's reason next to old → new", () => {
  const m = taskMessage(task(), "change", [{ field: "start", label: "เวลาเริ่ม", from: "09:30", to: "13:30" }], "ผู้บริหารติดภารกิจช่วงเช้า");
  assert.ok(json(m).includes("เหตุผล: ผู้บริหารติดภารกิจช่วงเช้า"));
  assert.ok(json(m).includes('"decoration":"line-through"'));
  // no reason → no reason line, card unchanged
  assert.ok(!json(taskMessage(task(), "change", [{ field: "start", label: "เวลาเริ่ม", from: "09:30", to: "13:30" }])).includes("เหตุผล"));
});

test("queue: change rows pass the reason through", () => {
  const { message } = messageForRow("change", task(), [{ field: "date", label: "วันที่", from: "พ. 28 ต.ค.", to: "ศ. 30 ต.ค." }], { reason: "ฝนตกหนัก" });
  assert.ok(json(message).includes("เหตุผล: ฝนตกหนัก"));
});

test("queue: a job put on hold tells the team why, with no buttons to acknowledge", () => {
  const { message, skipReason } = messageForRow("cancellation", task({}, { status: "draft" }), [], { reason: "รอกำหนดวันใหม่จากผู้บริหาร" });
  assert.equal(skipReason, undefined);
  assert.ok(json(message).includes("งานเลื่อนออกไปก่อน"));
  assert.ok(json(message).includes("เหตุผล: รอกำหนดวันใหม่จากผู้บริหาร"));
  assert.equal(postbacks(message), 0);
});

test("queue: someone taken off a job that still goes ahead is told so", () => {
  const { message } = messageForRow("cancellation", task({ removed: true }));
  assert.ok(json(message).includes("ถอนชื่อคุณออกจากงานนี้แล้ว"));
  assert.equal(postbacks(message), 0);
});

test("queue: a canceled job still reads as canceled (removed or not)", () => {
  const a = messageForRow("cancellation", task({}, { status: "canceled", cancellationReason: "เจ้าของเรื่องยกเลิก" }));
  assert.ok(json(a.message).includes("ยกเลิกงาน"));
  const b = messageForRow("cancellation", task({ removed: true }, { status: "canceled" }));
  assert.ok(json(b.message).includes("ยกเลิกงาน"));
});

test("queue: a hold notice that arrives after the job was published again is dropped", () => {
  const { message, skipReason } = messageForRow("cancellation", task());
  assert.equal(message, null);
  assert.ok(skipReason);
});

test("queue: a removed person gets no reminder or change card", () => {
  for (const type of ["reminder", "change", "assignment"]) {
    const { message } = messageForRow(type, task({ removed: true }), [], { now: new Date("2026-10-28T00:00:00Z") });
    assert.equal(message, null, type);
  }
});

test("quick moves: time shifts carry across midnight into the date", () => {
  assert.deepEqual(shiftTime("09:30", 30), { value: "10:00", dayCarry: 0 });
  assert.deepEqual(shiftTime("09:00", -15), { value: "08:45", dayCarry: 0 });
  assert.deepEqual(shiftTime("23:30", 60), { value: "00:30", dayCarry: 1 });
  assert.deepEqual(shiftTime("00:15", -30), { value: "23:45", dayCarry: -1 });
  assert.deepEqual(shiftTime("", 30), { value: "", dayCarry: 0 });
  assert.equal(shiftDate("2026-10-31", 1), "2026-11-01");
  assert.equal(shiftDate("2026-11-01", -1), "2026-10-31");
});
