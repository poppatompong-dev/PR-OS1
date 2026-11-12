// ทีวีเปิด 08:30–16:30 วันราชการ (12 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntilBack, edgeNow, jobsBeforeBack, jobsToday } from "@/lib/monitor/tv-hours";

const ev = (id: string, eventDate: string, startTime: string, status = "published") => ({ id, eventDate, startTime, status }) as any;

test("morning and closing windows", () => {
  assert.equal(edgeNow(8 * 60 + 30), "am");
  assert.equal(edgeNow(9 * 60), null);
  assert.equal(edgeNow(12 * 60), null);
  assert.equal(edgeNow(16 * 60), "pm");
  assert.equal(edgeNow(16 * 60 + 44), "pm");
  assert.equal(edgeNow(17 * 60), null);
});

test("days until people are back: Thu → Fri; Fri → Sat, Sun, Mon", () => {
  assert.deepEqual(daysUntilBack("2026-11-12"), ["2026-11-13"]); // Thu
  assert.deepEqual(daysUntilBack("2026-11-13"), ["2026-11-14", "2026-11-15", "2026-11-16"]); // Fri
});

test("before-you-go list: tonight after 16:30, then the days until back; cancelled left out", () => {
  const events = [ev("a", "2026-11-13", "09:00"), ev("b", "2026-11-13", "18:00"), ev("c", "2026-11-14", "07:00"), ev("d", "2026-11-16", "09:00"), ev("x", "2026-11-15", "10:00", "canceled"), ev("far", "2026-11-17", "09:00")];
  assert.deepEqual(jobsToday(events, "2026-11-13").map((e) => e.id), ["a", "b"]);
  const r = jobsBeforeBack(events, "2026-11-13");
  assert.deepEqual(r.tonight.map((e) => e.id), ["b"]);
  assert.deepEqual(r.next.map((e) => e.id), ["c", "d"]);
});
