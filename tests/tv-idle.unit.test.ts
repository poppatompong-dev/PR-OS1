// กล่อง "วันนี้" ตอนไม่มีงาน (12 Nov 2026): the countdown to the next job.
import { test } from "node:test";
import assert from "node:assert/strict";
import { untilText } from "@/app/monitor/TvIdle";

const at = (s: string) => Date.parse(s);
test("hours, tomorrow, days", () => {
  assert.equal(untilText("2026-11-13", "10:00", at("2026-11-12T11:40:00+07:00")), "อีก 22 ชม.");
  assert.equal(untilText("2026-11-12", "12:10", at("2026-11-12T11:40:00+07:00")), "อีก 30 นาที");
  assert.equal(untilText("2026-11-16", "09:00", at("2026-11-12T11:40:00+07:00")), "อีก 4 วัน");
  assert.equal(untilText("2026-11-13", "20:00", at("2026-11-12T08:00:00+07:00")), "พรุ่งนี้");
  assert.equal(untilText("2026-11-14", "09:00", at("2026-11-12T23:00:00+07:00")), "อีก 2 วัน");
  assert.equal(untilText("2026-11-01", "09:00", at("2026-11-12T11:40:00+07:00")), "เร็ว ๆ นี้");
});
