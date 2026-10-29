// ประกาศบนจอทีวี (owner, 29 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/announcements.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { ANNOUNCE_MAX, bangkokMidnightAfter, cleanAnnouncement, parseAnnounceCommand } from "@/lib/announcements";

test("the chat command", () => {
  assert.equal(parseAnnounceCommand("ประกาศ พรุ่งนี้ประชุม 9 โมง ห้อง 1"), "พรุ่งนี้ประชุม 9 โมง ห้อง 1");
  assert.equal(parseAnnounceCommand("ประกาศ: งดใช้รถตู้บ่ายนี้"), "งดใช้รถตู้บ่ายนี้");
  assert.equal(parseAnnounceCommand("📢 ไฟดับชั้น 2"), "ไฟดับชั้น 2");
  assert.equal(parseAnnounceCommand("ประกาศ"), "");
  assert.equal(parseAnnounceCommand("เพิ่มงาน ประกาศผล"), null);
});

test("length and blanks", () => {
  assert.equal(cleanAnnouncement("  ไฟดับ   ชั้น 2 ").ok, true);
  assert.equal(cleanAnnouncement("").ok, false);
  assert.equal(cleanAnnouncement("ก".repeat(ANNOUNCE_MAX + 1)).ok, false);
});

test("gone at Bangkok midnight", () => {
  // 23:30 Bangkok on 29 Oct = 16:30 UTC
  const late = new Date("2026-10-29T16:30:00Z");
  assert.equal(bangkokMidnightAfter(0, late).toISOString(), "2026-10-29T17:00:00.000Z");
  assert.equal(bangkokMidnightAfter(2, late).toISOString(), "2026-10-31T17:00:00.000Z");
  // 00:30 Bangkok on 30 Oct = 17:30 UTC on the 29th → midnight of the 30th
  assert.equal(bangkokMidnightAfter(0, new Date("2026-10-29T17:30:00Z")).toISOString(), "2026-10-30T17:00:00.000Z");
});
