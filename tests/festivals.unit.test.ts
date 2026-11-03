// TV festival themes (owner, 3 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/festivals.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { childrensDay, festivalFor, isFestivalKey, previewFestival } from "@/lib/monitor/festivals";

test("windows by date", () => {
  assert.equal(festivalFor("2026-11-03"), null);
  assert.equal(festivalFor("2026-11-17")?.key, "loy");
  assert.equal(festivalFor("2026-11-24")?.key, "loy");
  assert.equal(festivalFor("2026-11-25"), null);
  assert.equal(festivalFor("2026-12-05")?.key, "father");
  assert.equal(festivalFor("2026-12-31")?.chip, "🎆 สวัสดีปีใหม่ 2570");
  assert.equal(festivalFor("2027-01-02")?.chip, "🎆 สวัสดีปีใหม่ 2570");
  assert.equal(festivalFor("2027-01-09")?.key, "child");
  assert.equal(festivalFor("2027-01-04")?.key, "child");
  assert.equal(festivalFor("2027-02-08")?.key, "cny");
  assert.equal(festivalFor("2027-04-13")?.key, "songkran");
  assert.equal(festivalFor("2027-08-12")?.key, "mother");
  assert.equal(festivalFor("bad"), null);
});

test("children's day = second Saturday of January", () => {
  assert.equal(childrensDay(2027), "2027-01-09");
  assert.equal(childrensDay(2028), "2028-01-08");
});

test("preview keys", () => {
  assert.equal(isFestivalKey("loy"), true);
  assert.equal(isFestivalKey("x"), false);
  assert.equal(previewFestival("cny").key, "cny");
});
