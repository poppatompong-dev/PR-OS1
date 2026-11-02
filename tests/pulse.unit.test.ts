// ถามไถ่ทีม (owner, 2 Nov 2026: caring check-ins that reach the admins, never annoying).
//   npx -y tsx@4.19.2 --test tests/pulse.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { isPulseAnswer, pulseAdminText, pulseButtons, pulseCb, pulseNoteAdminText, pulseReply } from "@/lib/telegram/pulse";
import { parseCb } from "@/lib/telegram/messages";

test("pulse: three answer buttons that parse back", () => {
  const flat = pulseButtons().flat();
  assert.deepEqual(flat.map((b) => b.text), ["😊 ใช้ได้ดี", "😕 ยังงงอยู่", "💬 อยากบอกอะไร"]);
  for (const b of flat) {
    const p = parseCb((b as { callback_data: string }).callback_data);
    assert.equal(p.a, "pl");
    assert.ok(isPulseAnswer(p.id));
  }
  assert.equal(isPulseAnswer("x"), false);
  assert.ok(pulseCb("confused").length < 64);
});

test("pulse: only 'confused' pings admins; text is escaped", () => {
  assert.equal(pulseAdminText("ก", "ok"), null);
  assert.equal(pulseAdminText("ก", "talk"), null);
  assert.ok(pulseAdminText("ก<b>", "confused")!.includes("ก&lt;b&gt;"));
  assert.ok(pulseNoteAdminText("ข", "<x>").includes("&lt;x&gt;"));
  assert.ok(pulseReply("talk").text.includes("30 นาที"));
});
