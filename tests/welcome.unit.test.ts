// ธีมต้อนรับคนมาใหม่บนทีวี (owner + พี่เอิร์ธ, 6 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { WELCOME_ROLE, asWelcomeVariant, isWelcomeJob, welcomeToday } from "@/lib/monitor/welcome";
import type { MonitorEvent } from "@/lib/monitor/types";

const job = (o: Partial<MonitorEvent>): MonitorEvent => ({
  id: "1", title: "", eventDate: "2026-11-09", startTime: "09:00", endTime: "10:00", shortNote: "",
  locationName: "", departmentShort: "", roles: [], assignees: [], assigneeDetail: [], allAck: true,
  hasChanges: false, status: "published", cancellationReason: "", ...o,
});

test("turns on for a newcomer, not for visitors", () => {
  assert.equal(isWelcomeJob(job({ title: "ต้อนรับผู้โอน(ย้าย) สายงานผู้บริหาร" })), true); // the real 9 Nov job
  assert.equal(isWelcomeJob(job({ title: "x", screenTitle: "ต้อนรับรองปลัด/ผอ.กจ./ผอ.ส่วน/หน.ฝ่ายบริการฯ ย้ายมาใหม่" })), true);
  assert.equal(isWelcomeJob(job({ title: "ต้อนรับหัวหน้าฝ่ายคนใหม่" })), true);
  assert.equal(isWelcomeJob(job({ title: "ต้อนรับคณะศึกษาดูงาน เทศบาลเมืองย้ายมา" })), false);
  assert.equal(isWelcomeJob(job({ title: "ต้อนรับแขก" })), false);
  assert.equal(isWelcomeJob(job({ title: "รับ ผอ กองยุทธ" })), false);
  assert.equal(isWelcomeJob(job({ title: "ต้อนรับผู้โอน(ย้าย)", status: "canceled" })), false);
});

test("only on the job's day, flower look by default", () => {
  const ev = [job({ title: "ต้อนรับผู้โอน(ย้าย) สายงานผู้บริหาร" })];
  assert.equal(welcomeToday(ev, "2026-11-06"), null);
  const w = welcomeToday(ev, "2026-11-09");
  assert.equal(w?.role, WELCOME_ROLE);
  assert.equal(w?.variant, 3);
  assert.equal(asWelcomeVariant("2"), 2);
  assert.equal(asWelcomeVariant("9"), null);
});
