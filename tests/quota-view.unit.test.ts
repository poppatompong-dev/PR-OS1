// Quota bar numbers (owner, 26 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/quota-view.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { quotaView } from "@/lib/notifications/quota-view";

const sent = { critical: 44, reminder: 4, low: 12 };

test("LINE's own counter wins; the gap shows as OA Manager sends", () => {
  const q = quotaView({ date: "2026-10-26", sent, settingsLimit: 300, line: { limit: 300, used: 63 } });
  assert.equal(q.used, 63);
  assert.equal(q.remaining, 237);
  assert.equal(q.source, "line");
  assert.equal(q.monthLabel, "ต.ค. 2569");
  assert.deepEqual(q.segments.map((s) => [s.key, s.count]), [["critical", 44], ["reminder", 4], ["low", 12], ["other", 3]]);
  assert.equal(q.forecast, Math.round((63 / 26) * 31));
  assert.equal(q.tone, "ok");
});

test("falls back to our own count when LINE cannot be read", () => {
  const q = quotaView({ date: "2026-10-26", sent, settingsLimit: 300, line: null });
  assert.equal(q.used, 60);
  assert.equal(q.source, "system");
  assert.equal(q.segments.length, 3);
  assert.equal(q.percent, 20);
});

test("tone: warn near 70%, danger at 90% or a forecast over the cap", () => {
  const at = (used: number, date = "2026-10-30") =>
    quotaView({ date, sent: { critical: used, reminder: 0, low: 0 }, settingsLimit: 300, line: null }).tone;
  assert.equal(at(100), "ok");
  assert.equal(at(215), "warn");
  assert.equal(at(275), "danger");
  assert.equal(at(150, "2026-10-10"), "danger"); // pace would pass 300 by the 31st
});

test("no cap (paid plan): no remaining, never alarms", () => {
  const q = quotaView({ date: "2026-10-26", sent, settingsLimit: 300, line: { limit: null, used: 999 } });
  assert.equal(q.limit, null);
  assert.equal(q.remaining, null);
  assert.equal(q.tone, "ok");
});
