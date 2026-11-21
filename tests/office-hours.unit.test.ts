// บอทส่งในเวลาราชการ (20 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { jobStartMs, mayNotifyJob, nextOfficeOpen, officeOpen } from "@/lib/notifications/office-hours";
import { isJobEditor, JOB_OWNER_ID } from "@/lib/auth/job-editor";

const bkk = (s: string) => new Date(`${s}+07:00`);

test("officeOpen: จ–ศ 08:00–16:30", () => {
  assert.equal(officeOpen(bkk("2026-11-20T08:00:00")), true); // ศ.
  assert.equal(officeOpen(bkk("2026-11-20T16:29:00")), true);
  assert.equal(officeOpen(bkk("2026-11-20T16:30:00")), false);
  assert.equal(officeOpen(bkk("2026-11-20T07:59:00")), false);
  assert.equal(officeOpen(bkk("2026-11-21T10:00:00")), false); // ส.
});

test("nextOfficeOpen: ศุกร์เย็น → จันทร์ 08:00", () => {
  assert.equal(nextOfficeOpen(bkk("2026-11-20T18:00:00")).toISOString(), bkk("2026-11-23T08:00:00").toISOString());
  assert.equal(nextOfficeOpen(bkk("2026-11-19T06:00:00")).toISOString(), bkk("2026-11-19T08:00:00").toISOString());
});

test("mayNotifyJob: นอกเวลา ส่งเฉพาะงานก่อนเปิดทำการถัดไป +90 นาที", () => {
  const sat = bkk("2026-11-21T09:00:00");
  assert.equal(mayNotifyJob(jobStartMs("2026-11-21", "13:00"), sat), true); // งานวันนี้
  assert.equal(mayNotifyJob(jobStartMs("2026-11-22", "08:00"), sat), true); // งานพรุ่งนี้ (อา.)
  assert.equal(mayNotifyJob(jobStartMs("2026-11-23", "09:00"), sat), true); // จ. 09:00 < 08:00+90
  assert.equal(mayNotifyJob(jobStartMs("2026-11-23", "10:00"), sat), false); // รอ 08:00 จ.
  assert.equal(mayNotifyJob(jobStartMs("2026-12-01", "10:00"), bkk("2026-11-20T10:00:00")), true); // ในเวลา
});

test("isJobEditor: พี่เอิร์ธ + คนแทนที่ยังไม่หมดเวลา", () => {
  const now = bkk("2026-11-20T10:00:00");
  assert.equal(isJobEditor(JOB_OWNER_ID, null, now), true);
  assert.equal(isJobEditor("x", null, now), false);
  assert.equal(isJobEditor("x", { personId: "x", until: bkk("2026-11-20T23:59:59").toISOString() }, now), true);
  assert.equal(isJobEditor("x", { personId: "x", until: bkk("2026-11-19T23:59:59").toISOString() }, now), false);
  assert.equal(isJobEditor(null, null, now), false);
});
