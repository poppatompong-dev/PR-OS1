// Files that go with an order (owner, 26 Oct 2026): up to 5 per job, 10 MB
// each, opened from "📎 ดูไฟล์แนบ" on the LINE card.
//   npx -y tsx@4.19.2 --test tests/attachments.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_ATTACHMENTS_PER_EVENT,
  checkAttachmentMeta,
  parseStagedFormValues,
  parseStagedList,
} from "@/lib/attachments/rules";
import { attachmentsUrl, taskBubble } from "@/lib/line/messages";
import type { TaskItem } from "@/lib/line/data";

const U = (n: number) => `0000000${n}-aaaa-4bbb-8ccc-${String(n).padStart(12, "0")}`;
const pdf = (n: number) => ({ path: `staging/${U(n)}.pdf`, fileName: `คำสั่ง ${n}.pdf`, mimeType: "application/pdf", sizeBytes: 1000 });

test("file checks: type and size", () => {
  assert.equal(checkAttachmentMeta({ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 5_000_000 }), null);
  assert.match(checkAttachmentMeta({ fileName: "a.zip", mimeType: "application/zip", sizeBytes: 10 }) ?? "", /ไม่รองรับ/);
  assert.match(checkAttachmentMeta({ fileName: "big.jpg", mimeType: "image/jpeg", sizeBytes: 11 * 1024 * 1024 }) ?? "", /10\.0 MB/);
  assert.match(checkAttachmentMeta({ fileName: "e.pdf", mimeType: "application/pdf", sizeBytes: 0 }) ?? "", /ว่าง/);
});

test("staged list: only staging paths that match their type, at most 5, no repeats", () => {
  const list = parseStagedList([
    pdf(1),
    pdf(1),
    { ...pdf(2), path: `staging/${U(2)}.jpg` }, // path says jpg, type says pdf
    { ...pdf(3), path: `abc/${U(3)}.pdf` }, // not staging
    { ...pdf(4), path: `staging/../${U(4)}.pdf` },
    pdf(5),
    pdf(6),
    pdf(7),
    pdf(8),
    pdf(9),
  ]);
  assert.deepEqual(list.map((s) => s.path), [1, 5, 6, 7, 8].map((n) => `staging/${U(n)}.pdf`));
  assert.equal(list.length, MAX_ATTACHMENTS_PER_EVENT);
  assert.deepEqual(parseStagedList("nope"), []);
});

test("web form hidden inputs: one JSON per file, junk ignored", () => {
  assert.deepEqual(parseStagedFormValues([JSON.stringify(pdf(1)), "{bad json", JSON.stringify({ path: "x" })]), [pdf(1)]);
});

function task(count: number): TaskItem {
  return {
    assignmentId: "11111111-2222-3333-4444-555555555555",
    assignmentVersion: 1,
    personId: "p1",
    personName: "ทดสอบ",
    lineUserId: "U1",
    roleName: "ช่างภาพนิ่ง",
    acknowledged: false,
    unavailable: false,
    unavailableReason: null,
    event: {
      id: "e1",
      title: "งาน",
      eventDate: "2026-10-28",
      startTime: "09:00",
      endTime: null,
      locationName: "ห้องประชุม 1",
      shortNote: null,
      status: "published",
      cancellationReason: null,
      attachmentCount: count,
    },
  };
}

function buttons(b: unknown): Array<{ label: string; uri?: string }> {
  const footer = (b as { footer: { contents: Array<{ type: string; action?: { label: string; uri?: string } }> } }).footer;
  return footer.contents.filter((c) => c.type === "button").map((c) => c.action!);
}

test("card: 📎 button only when the job has files, opening the LIFF files page", () => {
  assert.ok(!buttons(taskBubble(task(0), "assignment")).some((a) => a.label.includes("ไฟล์แนบ")));
  const btn = buttons(taskBubble(task(2), "assignment")).find((a) => a.label.includes("ไฟล์แนบ"));
  assert.ok(btn);
  assert.equal(btn.label, "📎 ดูไฟล์แนบ (2)");
  assert.equal(btn.uri, attachmentsUrl("e1"));
  assert.match(btn.uri ?? "", /^https:\/\/liff\.line\.me\/[^/]+\/files\?e=e1$/);
  assert.ok(btn.label.length <= 40);
});
