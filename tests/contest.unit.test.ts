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

test("joke-ad pick: แบบ N in plain words", async () => {
  const { parseAdPick } = await import("@/lib/monitor/contest");
  assert.equal(parseAdPick("แบบ 2"), 2);
  assert.equal(parseAdPick("เลือกแบบ 3 ครับ"), 3);
  assert.equal(parseAdPick("ชอบแบบที่1ครับ"), 1);
  assert.equal(parseAdPick("ขอลุค แบบ 2"), null);
  assert.equal(parseAdPick("แบบ 4"), null);
});

test("judges' report: numbered list, tally, rejected aside, sent once after the close (13 Nov 2026)", async () => {
  const { buildContestReport, contestReportDue } = await import("@/lib/monitor/contest-report");
  const entries = [
    { id: "a", name: "นัท", text: "จุดแข็งของคุณคืออะไร → คอ บ่า ไหล่ แล้วจุดอ่อน | ปัญญา.. อิอิ", at: "2026-11-10T03:54:00Z", no: 1, status: "ok" as const },
    { id: "b", name: "แข", text: "เงินสกุลอะไรน่ากลัวที่สุด | เงินบาด(แก๋ว)", at: "2026-11-12T03:07:00Z", no: 2, status: "ok" as const },
    { id: "c", name: "นัท", text: "ขยันแต่ไม่แสดงออก", at: "2026-11-12T03:06:00Z", no: 3, status: "ok" as const },
    { id: "d", name: "ภัส", text: "มุกที่ถูกตัด <x>", at: "2026-11-12T04:00:00Z", no: null, status: "no" as const },
  ];
  const parts = buildContestReport(entries);
  assert.equal(parts.length, 1);
  const t = parts[0];
  assert.match(t, /รับมา 4 มุก · เข้าประกวด 3 มุก \(ไม่ใช้ 1\) · จาก 2 คน/);
  assert.match(t, /<b>มุกที่ 1<\/b> · นัท · อ\. 10 พ\.ย\. 10:54\nจุดแข็ง.*\n→ ปัญญา/);
  assert.match(t, /<b>มุกที่ 3<\/b> · นัท · .*\nขยันแต่ไม่แสดงออก/);
  assert.match(t, /📊 ส่งต่อคน: นัท 2 · แข 1/);
  assert.match(t, /🚫 ไม่ใช้.*ภัส — มุกที่ถูกตัด &lt;x&gt;/);
  assert.match(t, /ประกาศบนทีวี จ\. 23 พ\.ย\./);
  // long lists split under Telegram's limit
  const many = Array.from({ length: 60 }, (_, i) => ({ id: String(i), name: "นัท", text: `มุกยาว ๆ หมายเลข ${i} `.repeat(6), at: "2026-11-12T03:00:00Z", no: i + 1, status: "ok" as const }));
  const p2 = buildContestReport(many);
  assert.ok(p2.length >= 2 && p2.every((s) => s.length <= 3600));
  assert.equal(contestReportDue(new Date("2026-11-20T15:59:00+07:00"), false), false);
  assert.equal(contestReportDue(new Date("2026-11-20T16:00:00+07:00"), false), true);
  assert.equal(contestReportDue(new Date("2026-11-20T16:30:00+07:00"), true), false);
});
