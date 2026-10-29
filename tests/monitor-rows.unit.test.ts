// TV "แบบแถว" (Kook's layout, 29 Oct 2026): which jobs get a row and which one is framed.
//   npx -y tsx@4.19.2 --test tests/monitor-rows.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRows, shortName } from "@/lib/monitor/rows";
import type { MonitorEvent } from "@/lib/monitor/types";

const ev = (id: string, date: string, start: string, end = "", status = "published", hasChanges = false): MonitorEvent => ({
  id, title: id, eventDate: date, startTime: start, endTime: end, shortNote: "", locationName: "", departmentShort: "",
  roles: [], assignees: [], assigneeDetail: [], allAck: true, hasChanges, status, cancellationReason: "",
});
const T = "2026-10-29";
const m = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);

test("finished jobs today drop off, canceled never shows, nearest first, at most 8", () => {
  const list = [
    ev("done", T, "06:30", "08:00"),
    ev("gone", T, "16:00", "17:00", "canceled"),
    ev("next", T, "15:30", "18:00"),
    ev("tmr", "2026-10-30", "09:00"),
    ...Array.from({ length: 10 }, (_, i) => ev(`later${i}`, "2026-11-02", `1${i}:00`)),
  ];
  const rows = pickRows(list, T, m("08:40"));
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.event.id), ["next", "tmr", "later0"]);
  assert.equal(rows[0].day, "today");
  assert.equal(rows[1].day, "tomorrow");
  assert.equal(rows[2].day, "later");
});

test("the next job gets the gold frame and the countdown", () => {
  const rows = pickRows([ev("next", T, "15:30", "18:00"), ev("tmr", "2026-10-30", "09:00", "", "published", true)], T, m("08:40"));
  assert.equal(rows[0].state, "next");
  assert.equal(rows[0].chip, "งานถัดไป · อีก 6 ชม. 50 นาที");
  assert.equal(rows[1].state, null);
  assert.equal(rows[1].chip, "มีการเปลี่ยนแปลง");
});

test("a running job is framed green with the time left", () => {
  const rows = pickRows([ev("run", T, "08:00", "10:00"), ev("after", T, "13:00", "14:00")], T, m("08:40"));
  assert.equal(rows[0].state, "running");
  assert.equal(rows[0].chip, "กำลังดำเนินการ · เหลือ 1 ชม. 20 นาที");
  assert.equal(rows[1].state, null);
});

test("nothing left this week shows nothing", () => {
  assert.deepEqual(pickRows([ev("done", T, "06:30", "08:00")], T, m("09:00")), []);
});

test("first names only on a row", () => {
  assert.equal(shortName("นางสาวณัฏฐ์ จิรจีรังชัย"), "ณัฏฐ์");
  assert.equal(shortName("นายประชารักษ์ ประทุมโทน"), "ประชารักษ์");
  assert.equal(shortName("นางวิภัสรา แสงรอด"), "วิภัสรา");
  assert.equal(shortName("ป๊อปปี้"), "ป๊อปปี้");
});
