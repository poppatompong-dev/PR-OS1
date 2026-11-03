// TV team bench badges (owner, 3 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/badges.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { isFast, jobBadge, nickname, shownMonth } from "@/lib/monitor/badges";
import { badgeMessage } from "@/lib/monitor/badge-awards";

test("month on show: last month during days 1–7", () => {
  assert.deepEqual(shownMonth("2026-11-03"), { start: "2026-10-01", end: "2026-10-31", key: "2026-10", label: "ต.ค. 69" });
  assert.deepEqual(shownMonth("2026-11-08"), { start: "2026-11-01", end: "2026-11-08", key: "2026-11", label: "พ.ย. 69" });
  assert.equal(shownMonth("2027-01-05").key, "2026-12");
});

test("job tiers and ⚡", () => {
  assert.equal(jobBadge(4), null);
  assert.equal(jobBadge(5), "job5");
  assert.equal(jobBadge(12), "job10");
  assert.equal(jobBadge(15), "job15");
  const now = Date.parse("2026-11-20T10:00:00Z");
  const h = (x: number) => now - x * 3600_000;
  assert.equal(isFast([{ sentAt: h(5), ackAt: h(5) + 5 * 60_000 }, { sentAt: h(3), ackAt: h(3) + 20 * 60_000 }], now), true);
  assert.equal(isFast([{ sentAt: h(5), ackAt: h(5) + 5 * 60_000 }], now), false);
  assert.equal(isFast([{ sentAt: h(5), ackAt: h(5) + 5 * 60_000 }, { sentAt: h(3), ackAt: h(3) + 40 * 60_000 }], now), false);
  assert.equal(isFast([{ sentAt: h(5), ackAt: h(5) + 60_000 }, { sentAt: h(3), ackAt: null }], now), false);
});

test("names and the message", () => {
  assert.equal(nickname("00000000-0000-0000-0000-000000000503", "นายประชารักษ์ ประทุมโทน"), "กุ๊ก");
  assert.equal(nickname("x", "นางสาวสมใจ ดี"), "สมใจ");
  assert.ok(badgeMessage("แป้ง", ["fast"], "พ.ย. 69").includes("⚡ ไวทันใจ"));
});
