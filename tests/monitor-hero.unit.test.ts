// TV "แบบ A": which job takes the big card (owner, 28 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/monitor-hero.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { inMinutes, pickHero } from "@/lib/monitor/hero";
import type { MonitorEvent } from "@/lib/monitor/types";

const ev = (id: string, date: string, start: string, end = "", status = "published"): MonitorEvent => ({
  id,
  title: id,
  eventDate: date,
  startTime: start,
  endTime: end,
  shortNote: "",
  locationName: "",
  departmentShort: "",
  roles: [],
  assignees: [],
  assigneeDetail: [],
  allAck: true,
  hasChanges: false,
  status,
  cancellationReason: "",
});
const T = "2026-10-28";
const m = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);

test("next job today, with minutes to go and a two-hour prep bar", () => {
  const h = pickHero([ev("a", T, "06:30", "08:30"), ev("b", T, "13:30", "15:00")], T, m("13:10"));
  assert.equal(h.kind, "upcoming");
  if (h.kind !== "upcoming") return;
  assert.equal(h.event.id, "b");
  assert.equal(h.minutesTo, 20);
  assert.equal(h.sameDay, true);
  assert.ok(Math.abs(h.progress - 20 / 120) < 1e-9);
});

test("a running job takes the card, unless the next starts within 15 minutes", () => {
  const list = [ev("run", T, "13:00", "15:00"), ev("next", T, "14:20", "15:00")];
  const a = pickHero(list, T, m("13:30"));
  assert.equal(a.kind, "running");
  if (a.kind === "running") assert.equal(a.minutesLeft, 90);
  const b = pickHero(list, T, m("14:10"));
  assert.equal(b.kind, "upcoming");
  if (b.kind === "upcoming") assert.equal(b.event.id, "next");
});

test("no end time = two hours; canceled never shows; nothing left today → the next day's first job", () => {
  assert.equal(pickHero([ev("x", T, "12:00")], T, m("13:00")).kind, "running");
  const h = pickHero([ev("gone", T, "16:00", "17:00", "canceled"), ev("tmr", "2026-10-29", "09:30")], T, m("18:00"));
  assert.equal(h.kind, "upcoming");
  if (h.kind === "upcoming") {
    assert.equal(h.event.id, "tmr");
    assert.equal(h.sameDay, false);
    assert.equal(h.minutesTo, 6 * 60 + 9 * 60 + 30);
  }
  assert.equal(pickHero([], T, 0).kind, "none");
});

test("countdown words", () => {
  assert.equal(inMinutes(20), "อีก 20 นาที");
  assert.equal(inMinutes(65), "อีก 1 ชม. 5 นาที");
  assert.equal(inMinutes(120), "อีก 2 ชม.");
  assert.equal(inMinutes(0), "เริ่มแล้ว");
});
