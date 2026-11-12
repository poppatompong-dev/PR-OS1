// ประกวดมุก chip (10 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { contestChip, contestState } from "@/lib/monitor/contest";

test("open → days left, last day, judging, then gone", () => {
  assert.equal(contestState(new Date("2026-11-09T12:00:00+07:00"), 0), null);
  assert.deepEqual(contestState(new Date("2026-11-10T13:00:00+07:00"), 3), { phase: "open", daysLeft: 10, submitted: 3 });
  assert.match(contestChip(contestState(new Date("2026-11-10T13:00:00+07:00"), 3))!, /เหลือ 10 วัน · ส่งแล้ว 3 มุก/);
  assert.match(contestChip(contestState(new Date("2026-11-20T09:00:00+07:00"), 9))!, /วันสุดท้าย/);
  assert.match(contestChip(contestState(new Date("2026-11-20T17:00:00+07:00"), 9))!, /ปิดรับมุกแล้ว 9 มุก/);
  assert.equal(contestState(new Date("2026-11-24T09:00:00+07:00"), 9), null);
});

test("ticker: only approved jokes sent during the contest", async () => {
  const { contestTickerLines } = await import("@/lib/monitor/contest");
  const lines = contestTickerLines([
    { name: "นัท", setup: "จุดแข็งของคุณคืออะไร → คอ บ่า ไหล่ แล้วจุดอ่อน", punch: "ปัญญา.. อิอิ", at: "2026-11-10T03:54:00Z" },
    { name: "นัท", setup: "", punch: "ก่อนประกวด", at: "2026-11-09T09:32:00Z" },
    { name: "แข", setup: "", punch: "ไม่มีเวลา" },
  ]);
  assert.deepEqual(lines, ["😂 มุกประกวดจาก นัท: จุดแข็งของคุณคืออะไร → คอ บ่า ไหล่ แล้วจุดอ่อน → ปัญญา.. อิอิ"]);
});

test("มุกที่ N: order sent, rejected skipped, outside the window skipped", async () => {
  const { contestNumbers, contestTickerLines } = await import("@/lib/monitor/contest");
  const nums = contestNumbers(
    [
      { id: "c", at: "2026-11-11T05:00:00Z" },
      { id: "a", at: "2026-11-10T01:00:00Z" },
      { id: "x", at: "2026-11-10T02:00:00Z" },
      { id: "b", at: "2026-11-10T03:00:00Z" },
      { id: "old", at: "2026-11-09T09:00:00Z" },
      { id: "late", at: "2026-11-20T10:00:00Z" },
    ],
    new Set(["x"]),
  );
  assert.deepEqual([...nums.entries()], [["a", 1], ["b", 2], ["c", 3]]);
  assert.match(contestTickerLines([{ name: "แข", setup: "", punch: "ฮา", at: "2026-11-10T03:00:00Z", no: 2 }])[0], /^😂 มุกประกวดที่ 2 จาก แข: ฮา$/);
});
