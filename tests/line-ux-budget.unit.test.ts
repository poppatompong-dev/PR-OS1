// Menu A, the new change card and the automatic quota budget (owner, 21 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/line-ux-budget.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { budgetAllows, budgetLabel, budgetPlan, plannedPerMonth, priorityOf, type BudgetState } from "@/lib/notifications/budget";
import { ackLabelFor, diffEvent } from "@/lib/line/change-diff";
import { COMMANDS, LATEST_HINT, taskBubble, taskMessage } from "@/lib/line/messages";
import { richMenuDefinition, RICH_MENU_BUTTONS } from "@/lib/line/rich-menu";
import type { TaskItem } from "@/lib/line/data";

function task(ev: Partial<TaskItem["event"]> = {}): TaskItem {
  return {
    assignmentId: "a1",
    assignmentVersion: 2,
    personId: "p1",
    personName: "แป้ง",
    lineUserId: "U1",
    roleName: "ช่างภาพนิ่ง",
    acknowledged: false,
    unavailable: false,
    unavailableReason: null,
    event: {
      id: "e1",
      title: "ประชุมสภาเทศบาล",
      eventDate: "2026-10-21",
      startTime: "11:15",
      endTime: "12:00",
      locationName: "ห้องประชุมสภา",
      shortNote: null,
      status: "published",
      cancellationReason: null,
      ...ev,
    },
  };
}

const json = (v: unknown) => JSON.stringify(v);

// ---- budget ---------------------------------------------------------------

const state = (over: Partial<BudgetState> = {}): BudgetState => ({
  used: 0,
  limit: 300,
  date: "2026-11-10",
  sent: { critical: 0, reminder: 0, low: 0 },
  ...over,
});

test("budget: message types map to priorities", () => {
  for (const t of ["assignment", "change", "cancellation", "unavailable", "quota_warning"]) assert.equal(priorityOf(t), "critical");
  assert.equal(priorityOf("reminder"), "reminder");
  assert.equal(priorityOf("daily_summary"), "low");
  assert.equal(priorityOf("admin_report"), "low");
});

test("budget: the plan for 40 jobs × 1–2 people fits inside 300 with room for summaries", () => {
  const p = plannedPerMonth();
  assert.ok(p.critical + p.reminder < 150, JSON.stringify(p));
  assert.ok(300 - p.critical - p.reminder >= 150);
});

test("budget: job cards always go out while anything is left", () => {
  assert.deepEqual(budgetAllows("critical", state({ used: 299, date: "2026-11-02" })), { ok: true });
  assert.equal(budgetAllows("critical", state({ used: 300 })).ok, false);
  assert.equal(budgetAllows("critical", state({ used: 0, limit: Number.POSITIVE_INFINITY })).ok, true);
});

test("budget: a quiet month sends everything", () => {
  const s = state({ used: 40, sent: { critical: 20, reminder: 4, low: 16 } });
  assert.equal(budgetAllows("reminder", s).ok, true);
  assert.equal(budgetAllows("low", s).ok, true);
  assert.equal(budgetLabel(s).mode, "normal");
});

test("budget: summaries stop at their daily share, job cards and reminders do not", () => {
  const p = budgetPlan(state());
  const s = state({ used: 60, sent: { critical: 30, reminder: 3, low: p.lowAllowedSoFar } });
  assert.equal(budgetAllows("low", s).ok, false);
  assert.equal(budgetAllows("reminder", s).ok, true);
  assert.equal(budgetAllows("critical", s).ok, true);
  assert.equal(budgetLabel(s).mode, "saving");
});

test("budget: when the reserve for job cards is at risk, reminders stop too", () => {
  // 10 Nov, 250 used: 50 left, but ~20 days of job cards still to come
  const s = state({ used: 250, sent: { critical: 120, reminder: 30, low: 100 } });
  assert.equal(budgetAllows("reminder", s).ok, false);
  assert.equal(budgetAllows("low", s).ok, false);
  assert.equal(budgetAllows("critical", s).ok, true);
  assert.equal(budgetLabel(s).mode, "critical-only");
});

test("budget: a busy month raises the reserve by itself", () => {
  const quiet = budgetPlan(state({ sent: { critical: 10, reminder: 0, low: 0 } }));
  const busy = budgetPlan(state({ sent: { critical: 60, reminder: 0, low: 0 } }));
  assert.ok(busy.criticalReserve > quiet.criticalReserve);
});

test("budget: last day of the month only keeps today's buffer back", () => {
  const p = budgetPlan(state({ date: "2026-11-30" }));
  assert.equal(p.criticalReserve, 5);
  assert.equal(p.daysInMonth, 30);
});

test("budget: simulated month of 40 jobs never drops a job card and lasts to the end", () => {
  // 40 jobs spread over 30 days, 1–2 people each, 4 changes, 2 cancels, 5 alerts,
  // a morning summary for 3 people every day and an admin report most days.
  let s = state({ date: "2026-11-01" });
  let droppedCritical = 0;
  let lowSent = 0;
  const send = (type: string) => {
    const ok = budgetAllows(priorityOf(type), s).ok;
    if (ok) s = { ...s, used: s.used + 1, sent: { ...s.sent, [priorityOf(type)]: s.sent[priorityOf(type)] + 1 } };
    else if (priorityOf(type) === "critical") droppedCritical += 1;
    if (ok && priorityOf(type) === "low") lowSent += 1;
  };
  for (let day = 1; day <= 30; day++) {
    s = { ...s, date: `2026-11-${String(day).padStart(2, "0")}` };
    for (let i = 0; i < 3; i++) send("daily_summary");
    const jobsToday = day % 3 === 0 ? 2 : 1; // 40 jobs over 30 days
    for (let j = 0; j < jobsToday; j++) {
      send("assignment");
      if ((day + j) % 2 === 0) send("assignment");
      if (day % 3 === 1) send("reminder");
    }
    if (day % 7 === 0) send("change");
    if (day % 15 === 0) send("cancellation");
    if (day % 6 === 0) send("unavailable");
    if (day % 2 === 0) send("admin_report");
  }
  assert.equal(droppedCritical, 0);
  assert.ok(s.used <= 300, String(s.used));
  assert.ok(lowSent >= 60, `summaries sent: ${lowSent}`);
});

// ---- change card -------------------------------------------------------------

test("change diff: only fields that really changed, old → new", () => {
  const t = task();
  const d = diffEvent({ title: "ประชุมสภาเทศบาล", event_date: "2026-10-21", start_time: "11:05:00", end_time: "12:00:00", location_id: "x", location_name: "ห้องประชุมสภา" }, t);
  assert.deepEqual(d, [{ field: "start", label: "เวลาเริ่ม", from: "11:05", to: "11:15" }]);
  assert.equal(ackLabelFor(d), "รับทราบเวลาใหม่");
});

test("change diff: place and date, empty place reads ไม่ระบุ", () => {
  const t = task({ locationName: "—" });
  const d = diffEvent({ event_date: "2026-10-20", location_id: "x", location_name: "ลานหน้าเทศบาล" }, t);
  assert.equal(d.length, 2);
  assert.equal(d[1].to, "ไม่ระบุ");
  assert.equal(ackLabelFor(d), "รับทราบวันใหม่");
  assert.equal(ackLabelFor(diffEvent({ location_id: "x", location_name: "ลาน" }, task())), "รับทราบสถานที่ใหม่");
  assert.equal(ackLabelFor([]), "รับทราบงานที่แก้");
  assert.deepEqual(diffEvent(null, t), []);
});

test("change card: says it replaces the earlier card, strikes the old value", () => {
  const changes = [{ field: "start" as const, label: "เวลาเริ่ม", from: "11:05", to: "11:15" }];
  const b = json(taskBubble(task(), "change", changes));
  assert.ok(b.includes("ใบนี้แทนใบก่อนหน้า"));
  assert.ok(b.includes('"decoration":"line-through"'));
  assert.ok(b.includes("ใบเก่าของงานนี้ใช้ไม่ได้แล้ว"));
  assert.ok(b.includes("รับทราบเวลาใหม่"));
  // the time row is not repeated under the change box; the date still shows
  assert.ok(!b.includes('"text":"วันเวลา"'));
  assert.ok(b.includes('"text":"วันที่"'));
  const alt = taskMessage(task(), "change", changes);
  assert.ok(alt.type === "flex" && alt.altText.includes("เวลาเริ่ม 11:15"));
});

test("every pushed card points to งานของฉัน; the list itself does not", () => {
  for (const kind of ["assignment", "reminder", "change"] as const) {
    const b = json(taskBubble(task(), kind));
    assert.ok(b.includes(JSON.stringify(LATEST_HINT).slice(1, -1)), kind);
    assert.ok(b.includes(`"text":"${COMMANDS.mine}"`), kind);
  }
  assert.ok(!json(taskBubble(task(), "list")).includes(JSON.stringify(LATEST_HINT).slice(1, -1)));
});

// ---- Menu A ---------------------------------------------------------------------

test("menu A: left column is ของฉัน, the rest is ของทีม", () => {
  const def = richMenuDefinition() as { areas: Array<{ bounds: { x: number; y: number; height: number }; action: { label: string } }> };
  const left = def.areas.filter((a) => a.bounds.x === 0).map((a) => a.action.label);
  assert.deepEqual(left, ["งานของฉัน", "เพิ่มงาน"]);
  assert.deepEqual(
    RICH_MENU_BUTTONS.map((b) => b.label),
    ["งานของฉัน", "ทีมวันนี้", "ทีมพรุ่งนี้", "เพิ่มงาน", "ใครยังไม่รับทราบ", "วิธีใช้"],
  );
  // top row includes the 110 px zone strip
  assert.equal(def.areas[0].bounds.height, 476);
  assert.equal(def.areas[3].bounds.y, 476);
});
