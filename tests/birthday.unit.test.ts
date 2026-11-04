// TV birthday celebration (owner + กุ๊ก, 4 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/birthday.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { birthdayToday, isBirthdayJob } from "@/lib/monitor/birthday";
import type { MonitorEvent } from "@/lib/monitor/types";

const job = (o: Partial<MonitorEvent>): MonitorEvent => ({
  id: "1", title: "", eventDate: "2026-11-04", startTime: "08:45", endTime: "09:00", shortNote: "",
  locationName: "", departmentShort: "", roles: [], assignees: [], assigneeDetail: [], allAck: true,
  hasChanges: false, status: "published", cancellationReason: "", ...o,
});
const who = (name: string, personId?: string) => ({ name, role: "อื่นๆ", ack: true, unavailable: false, personId });

test("title words", () => {
  assert.equal(isBirthdayJob(job({ title: "🎉สุขสันต์วันเกิด🎊" })), true);
  assert.equal(isBirthdayJob(job({ title: "Happy Birthday" })), true);
  assert.equal(isBirthdayJob(job({ title: "x", screenTitle: "HBD พี่" })), true);
  assert.equal(isBirthdayJob(job({ title: "ประชุมสภา" })), false);
  assert.equal(isBirthdayJob(job({ title: "วันเกิด", status: "canceled" })), false);
});

test("today's birthday people, deduped, with the wish", () => {
  const ev = [
    job({ title: "🎉สุขสันต์วันเกิด🎊", shortNote: "  ขอให้มีความสุข\nสุขภาพแข็งแรง ", assigneeDetail: [who("นางวิภัสรา แสงรอด", "p1")] }),
    job({ id: "2", title: "HBD", assigneeDetail: [who("นางวิภัสรา แสงรอด"), who("นายณัฏฐ์ ใจดี")] }),
    job({ id: "3", title: "วันเกิด", eventDate: "2026-11-05", assigneeDetail: [who("นายอื่น")] }),
    job({ id: "4", title: "ประชุม", assigneeDetail: [who("นางสาวภัททิรา")] }),
  ];
  const b = birthdayToday(ev, "2026-11-04", (n) => (n.startsWith("นางวิภัสรา") ? "p1" : undefined));
  assert.ok(b);
  assert.deepEqual(b.people.map((p) => [p.short, p.personId]), [["วิภัสรา", "p1"], ["ณัฏฐ์", undefined]]);
  assert.equal(b.names, "วิภัสรา · ณัฏฐ์");
  assert.equal(b.wish, "ขอให้มีความสุข สุขภาพแข็งแรง");
});

test("no job or nobody on it = no celebration", () => {
  assert.equal(birthdayToday([], "2026-11-04"), null);
  assert.equal(birthdayToday([job({ title: "วันเกิด" })], "2026-11-04"), null);
});
