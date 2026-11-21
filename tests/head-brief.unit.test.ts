// หัวหน้าฝ่ายรับสรุปงานทาง Telegram (17 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { briefDue, buildHeadBrief, buildHeadIntro, buildNobodyAlert, followUps, hoursLeft, isQuietHour, nobodyYet, type BriefJob } from "@/lib/notifications/head-brief";

const job = (o: Partial<BriefJob> = {}): BriefJob => ({ id: "e1", title: "พิธีเปิดงาน", icon: null, date: "2026-11-17", start: "09:00", place: "หอประชุม", people: [], ...o });
const p = (name: string, ack = false, off = false, reason: string | null = null) => ({ id: name, name, ack, off, reason });

test("briefDue: วันทำการเท่านั้น (20 Nov 2026)", () => {
  assert.equal(briefDue("2026-11-17", 0), true); // อ.
  assert.equal(briefDue("2026-11-21", 0), false); // ส.
  assert.equal(briefDue("2026-11-22", 2), false); // อา. มีงานก็ไม่ส่ง
});

test("isQuietHour: 21:00–07:00", () => {
  assert.equal(isQuietHour(21 * 60), true);
  assert.equal(isQuietHour(6 * 60 + 59), true);
  assert.equal(isQuietHour(7 * 60), false);
  assert.equal(isQuietHour(20 * 60 + 59), false);
});

test("followUps: ไม่มอบหมาย / ไม่สะดวก / ยังไม่มีใครรับทราบ", () => {
  const out = followUps([
    job({ id: "a", title: "ก" }),
    job({ id: "b", title: "ข", people: [p("แข", false, true, "ลาป่วย"), p("นัท")] }),
    job({ id: "c", title: "ค", people: [p("ภัส", true)] }),
  ]);
  assert.equal(out.length, 3);
  assert.match(out[0], /ก — ยังไม่ได้มอบหมาย/);
  assert.match(out[1], /แข ไม่สะดวก: ลาป่วย/);
  assert.match(out[2], /ข — ยังไม่มีใครรับทราบ/);
  assert.equal(nobodyYet(job({ people: [p("ภัส", true)] })), false);
});

test("buildHeadBrief: วันนี้/พรุ่งนี้ ติดตาม ความเคลื่อนไหว และปุ่มรายการงาน", () => {
  const m = buildHeadBrief({
    greet: "คุณสมัชชา",
    today: "2026-11-17",
    jobs: [job({ people: [p("นัท", true), p("แข")] }), job({ id: "e2", date: "2026-11-18", title: "แข่ง ROV", people: [] })],
    changes: [{ kind: "cancel", title: "ประชุม", icon: null, date: "2026-11-19", start: "13:30", reason: "เลื่อนไม่มีกำหนด" }, { kind: "add", title: "แข่ง ROV", icon: null, date: "2026-11-18", start: "09:00" }],
  });
  assert.match(m.text, /สวัสดีตอนเช้าครับ คุณสมัชชา/);
  assert.match(m.text, /วันนี้<\/b> · 1 งาน/);
  assert.match(m.text, /นัท ✅ · แข ⏳/);
  assert.match(m.text, /แข่ง ROV — ยังไม่ได้มอบหมาย/);
  assert.match(m.text, /❌ ยกเลิก .* \(เลื่อนไม่มีกำหนด\)/);
  assert.match(m.text, /➕ เพิ่ม/);
  assert.equal(m.buttons?.[0][0].text, "📋 เปิดรายการงาน");
  assert.ok(m.text.length < 4096);
});

test("buildHeadBrief: ไม่มีงาน ไม่มีบรรทัดติดตาม", () => {
  const m = buildHeadBrief({ greet: "พี่ไป๋", today: "2026-11-17", jobs: [], changes: [] });
  assert.match(m.text, /วันนี้<\/b> · ไม่มีงาน/);
  assert.doesNotMatch(m.text, /ต้องติดตาม/);
});

test("nobody alert + hoursLeft", () => {
  const now = new Date("2026-11-17T01:00:00Z"); // 08:00 BKK
  assert.equal(hoursLeft(job(), now), 1);
  const a = buildNobodyAlert(job({ people: [p("นัท")] }), now);
  assert.match(a.text, /ยังไม่มีผู้รับทราบ/);
  assert.match(a.text, /อีกราว 1 ชม\./);
});

test("intro: สุภาพ มีวิธีใช้", () => {
  const m = buildHeadIntro("คุณสมัชชา");
  assert.match(m.text, /เรียนคุณสมัชชา/);
  assert.match(m.text, /08:00/);
  assert.match(m.text, /ใครยังไม่รับทราบ/);
});
