// TV "ผังคุณกุ๊ก" (29 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/monitor-board.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoard, isDone, screenTitle, thaiTime, titleSize } from "@/lib/monitor/board";
import type { MonitorEvent } from "@/lib/monitor/types";

const ev = (id: string, date: string, start: string, end = "", extra: Partial<MonitorEvent> = {}): MonitorEvent => ({
  id, title: id, eventDate: date, startTime: start, endTime: end, shortNote: "", locationName: "", departmentShort: "",
  roles: [], assignees: [], assigneeDetail: [], allAck: true, hasChanges: false, status: "published", cancellationReason: "", ...extra,
});
const T = "2026-10-29";
const m = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3);

test("today card keeps finished jobs at the bottom; numbers count the whole day", () => {
  const b = buildBoard(
    [
      ev("done", T, "06:30", "08:00", { assigneeDetail: [{ name: "a", role: "", ack: false, unavailable: false }] }),
      ev("next", T, "15:30", "18:00", { assigneeDetail: [{ name: "b", role: "", ack: true, unavailable: false }] }),
      ev("gone", T, "10:00", "", { status: "canceled" }),
    ],
    T,
    m("09:00"),
  );
  assert.deepEqual(b.todayJobs.map((e) => e.id), ["next", "done"]);
  assert.equal(isDone(b.todayJobs[1], m("09:00")), true);
  assert.equal(isDone(b.todayJobs[0], m("09:00")), false);
  assert.equal(b.stats.today, 2);
  assert.equal(b.stats.pending, 1);
});

test("right side: next 4 days with work, empty days skipped; bottom: the next days with work", () => {
  const b = buildBoard(
    [ev("a", "2026-10-30", "09:00"), ev("b", "2026-10-31", "09:00"), ev("c1", "2026-11-01", "09:00"), ev("c2", "2026-11-01", "14:00"), ev("d", "2026-11-04", "09:00"), ev("e", "2026-11-06", "09:00")],
    T,
    m("09:00"),
  );
  assert.deepEqual(b.dayRows.map((d) => d.iso), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-04"]);
  assert.equal(b.dayRows[2].events.length, 2);
  assert.deepEqual(b.cells.map((c) => c.iso), ["2026-11-06"]); // no empty cards (พี่เอิร์ธ, 6 Nov 2026)
  assert.deepEqual(b.cells[0].events.map((e) => e.id), ["e"]);
  assert.equal(b.stats.week, 5); // 6 Nov is day 8
});

test("bottom: at most 6 days, each with work, in date order", () => {
  const days = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-05", "2026-11-09", "2026-11-10", "2026-11-12", "2026-11-20", "2026-11-21", "2026-11-25"];
  const b = buildBoard(days.map((d, i) => ev(`x${i}`, d, "09:00")), T, m("09:00"), { horizonDays: 60 });
  assert.deepEqual(b.cells.map((c) => c.iso), ["2026-11-05", "2026-11-09", "2026-11-10", "2026-11-12", "2026-11-20", "2026-11-21"]);
  assert.ok(b.cells.every((c) => c.events.length > 0));
  assert.deepEqual(buildBoard([ev("a", "2026-10-30", "09:00")], T, m("09:00")).cells, []);
});

test("Thai time, short titles, long titles", () => {
  assert.equal(thaiTime("09:30", "11:30"), "09.30 น. - 11.30 น.");
  assert.equal(thaiTime("09:00"), "09.00 น.");
  assert.equal(screenTitle(ev("x", T, "09:00", "", { title: "โครงการฝึกอบรมดับเพลิงและซ้อมแผนอพยพหนีไฟ", screenTitle: "ซ้อมดับเพลิง" })), "ซ้อมดับเพลิง");
  assert.equal(titleSize("ประชุมสภา"), "");
  assert.equal(titleSize("โครงการฝึกอบรมดับเพลิงและซ้อมแผนอพยพหนีไฟในสถานศึกษา"), "is-xlong");
});
