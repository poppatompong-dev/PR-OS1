// ใบสรุปรายบุคคล (owner, 4 Nov 2026 · แบบ C) + รอบประเมิน.
//   npx -y tsx@4.19.2 --test tests/person-sheet.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { computePersonSheet, type SheetJob } from "@/lib/reports/person-sheet";
import { appraisalLabel, appraisalRoundOf, resolveRange } from "@/lib/date";

const job = (o: Partial<SheetJob>): SheetJob => ({
  eventId: "e", title: "งาน", date: "2026-11-04", start: "09:00", end: "10:00", urgent: false, dept: "สป.",
  people: 1, roles: ["ภาพนิ่ง"], sentAt: null, ackAt: null, unreached: false, helped: false, attachments: 0, ...o,
});

test("hours, outside hours and weekends", () => {
  const s = computePersonSheet({
    from: "2026-10-01", to: "2027-03-31", selfAdded: 2, teamJobs: [4, 2], badges: [],
    jobs: [
      job({ date: "2026-11-04", start: "09:00", end: "10:30" }),           // weekday, in hours: 1.5 h
      job({ date: "2026-11-04", start: "16:00", end: "18:00" }),           // weekday, 1.5 h outside
      job({ date: "2026-11-07", start: "08:00", end: "10:00" }),           // Saturday: 2 h outside
      job({ date: "2026-11-05", start: "07:30", end: null }),              // untimed, early start
    ],
  });
  assert.equal(s.jobs, 4);
  assert.equal(s.hours, 5.5);
  assert.equal(s.untimed, 1);
  assert.equal(s.afterHours, 2);
  assert.equal(s.weekend, 1);
  assert.equal(s.outsideHours, 3.5);
  assert.equal(s.teamAvgJobs, 3);
  assert.equal(s.teamAvgPerMonth, 0.5);
  assert.equal(s.months.length, 6);
  assert.equal(s.months.find((m) => m.key === "2026-11")?.count, 4);
  assert.equal(s.selfAdded, 2);
});

test("ack rate only over cards that reached them; never-reached apart", () => {
  const s = computePersonSheet({
    from: "2026-11-01", to: "2026-11-30", selfAdded: 0, teamJobs: [], badges: [],
    jobs: [
      job({ sentAt: "2026-11-01T02:00:00Z", ackAt: "2026-11-01T02:04:00Z" }),
      job({ sentAt: "2026-11-01T02:00:00Z", ackAt: "2026-11-01T02:10:00Z" }),
      job({ sentAt: "2026-11-01T02:00:00Z", ackAt: null }),
      job({ sentAt: null, unreached: true }),
    ],
  });
  assert.equal(s.reached, 3);
  assert.equal(s.acked, 2);
  assert.equal(s.ackRate, 2 / 3);
  assert.equal(s.ackMedianMin, 7);
  assert.equal(s.unreached, 1);
  assert.equal(s.teamAvgJobs, null);
});

test("roles split, depts, top 5 urgent first, badges by months", () => {
  const s = computePersonSheet({
    from: "2026-11-01", to: "2026-12-31", selfAdded: 0, teamJobs: [1], badges: [{ month: "2026-11", badges: ["fast", "job5"] }, { month: "2026-12", badges: ["fast"] }],
    jobs: [
      job({ eventId: "a", date: "2026-11-02", roles: ["ภาพนิ่ง", "ทำข่าว / ข้อมูล"], dept: "สป." }),
      job({ eventId: "b", date: "2026-11-03", urgent: true, dept: "กศ." }),
      job({ eventId: "c", date: "2026-11-01", people: 5, dept: "สป." }),
    ],
  });
  assert.deepEqual(s.roles[0], { name: "ภาพนิ่ง", count: 3 });
  assert.deepEqual(s.depts[0], { name: "สป.", count: 2 });
  assert.deepEqual(s.top.map((t) => t.date), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.equal(s.badges.find((b) => b.label.includes("ไวทันใจ"))?.months, 2);
});

test("appraisal round presets", () => {
  assert.deepEqual(resolveRange("appraisal-1", "2026-11-04"), { from: "2026-10-01", to: "2027-03-31" });
  assert.deepEqual(resolveRange("appraisal-2", "2026-11-04"), { from: "2027-04-01", to: "2027-09-30" });
  assert.deepEqual(resolveRange("appraisal-1", "2027-05-10"), { from: "2026-10-01", to: "2027-03-31" });
  assert.equal(appraisalLabel(1, "2026-11-04"), "รอบประเมิน 1/2570");
  assert.equal(appraisalLabel(2, "2026-09-01"), "รอบประเมิน 2/2569");
  assert.equal(appraisalRoundOf("2026-10-01", "2027-03-31")?.label, "รอบที่ 1/2570");
  assert.equal(appraisalRoundOf("2026-04-01", "2026-09-30")?.label, "รอบที่ 2/2569");
  assert.equal(appraisalRoundOf("2026-11-01", "2026-11-30"), null);
});
