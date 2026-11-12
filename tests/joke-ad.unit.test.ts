// ช่วงโฆษณามุกเต็มจอ (12 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { adHead, adOrder, jobSoon } from "@/app/monitor/TvJokeAd";

test("ad order: contest numbers first, later jokes by time", () => {
  const out = adOrder([
    { id: "late", personId: "", name: "", setup: "", punch: "x", at: "2026-11-21T01:00:00Z" },
    { id: "n2", personId: "", name: "", setup: "", punch: "x", no: 2 },
    { id: "n1", personId: "", name: "", setup: "", punch: "x", no: 1 },
  ]);
  assert.deepEqual(out.map((j) => j.id), ["n1", "n2", "late"]);
  assert.equal(adHead({ no: 5 }), "มุกประกวดที่ 5");
  assert.equal(adHead({}), "มุกจากทีม");
});

test("no ad when a job starts within 30 min (Bangkok)", () => {
  const now = Date.parse("2026-11-12T10:00:00+07:00");
  const ev = (startTime: string, status = "scheduled") => ({ eventDate: "2026-11-12", startTime, status });
  assert.equal(jobSoon([ev("10:20")], now), true);
  assert.equal(jobSoon([ev("10:45")], now), false);
  assert.equal(jobSoon([ev("09:30")], now), false);
  assert.equal(jobSoon([ev("10:10", "canceled")], now), false);
});
