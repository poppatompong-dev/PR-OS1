// หน่วยงานเจ้าของงาน guessed from the title (6 Nov 2026) — the team's real job titles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { guessDepartment } from "@/lib/events/department-guess";

test("guess: real titles from the board land on the expected department", () => {
  const cases: Array<[string, string | null]> = [
    ["ประชุม สปสช", "สธ."],
    ["ผู้บริหาร สท พบ อสม", "สธ."],
    ["ถ่ายภาพมอบถุงยังชีพผู้ประสบอุทกภัย", "พส."],
    ["พิธีเปิดโครงการยุติความรุนแรงต่อเด็ก สตรี คนชรา", "พส."],
    ["ประชุมกรรมการชุมชน", "พส."],
    ["ประชุมสภา", "สภาฯ"],
    ["ประธานสภาร่วมเสวนา ThaiPbs", "สภาฯ"],
    ["ลอยกระทง", "กศ."],
    ["งานแข่งเรือ", "กศ."],
    ["นักยกน้ำหนักพบนายกฯ", "กศ."],
    ["มอบเสื้อกีฬา นางฟ้าสีส้ม", "กศ."],
    ["รับ ผอ กองยุทธ", "ยก."],
    ["เสวนาประเทศไทย", "ปชส."],
    ["พิธีวางดอกไม้จันทน์", "สป."],
    ["ต้อนรับผู้โอน(ย้าย) สายงานผู้บริหาร", "สป."],
    ["ถ่ายรูป เลขา", "สป."],
    ["xyz", null],
    ["", null],
  ];
  for (const [title, want] of cases) assert.equal(guessDepartment(title), want, title);
});

test("phone form input: departmentId is optional, checked, and 'not sent' stays undefined", async () => {
  const { parseLiffEventInput } = await import("@/lib/liff/create-event");
  const base = { title: "ประชุมสภา", eventDate: "2026-11-13", startTime: "10:00" };
  const id = "11111111-2222-3333-4444-555555555555";
  const a = parseLiffEventInput({ ...base, departmentId: id });
  assert.ok(a.ok && a.input.departmentId === id);
  const b = parseLiffEventInput({ ...base, departmentId: "" });
  assert.ok(b.ok && b.input.departmentId === null);
  const c = parseLiffEventInput(base);
  assert.ok(c.ok && c.input.departmentId === undefined);
  assert.equal(parseLiffEventInput({ ...base, departmentId: "x" }).ok, false);
});
