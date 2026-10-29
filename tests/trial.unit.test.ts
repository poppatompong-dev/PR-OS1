// ภารกิจทดสอบ (owner, 29 Oct 2026): four steps each person tries in Telegram.
//   npx -y tsx@4.19.2 --test tests/trial.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { TRIAL_STEPS, trialDone } from "@/lib/trial";
import { tgTrial } from "@/lib/telegram/messages";

test("progress reads people.metadata.trial and ignores junk", () => {
  assert.equal(trialDone(null).size, 0);
  assert.equal(trialDone({ avatar: "off" }).size, 0);
  assert.deepEqual([...trialDone({ trial: { tour: "2026-10-30T02:00:00Z", demo: null, nope: "x" } })], ["tour"]);
});

test("the checklist ticks what is done and drops the button when complete", () => {
  const some = tgTrial(new Set(["tour"]), TRIAL_STEPS);
  assert.match(some.text, /1\/4/);
  assert.match(some.text, /✅ <b>ดูทัวร์/);
  assert.equal(some.buttons?.length, 1);
  const all = tgTrial(new Set(TRIAL_STEPS.map((s) => s.key)), TRIAL_STEPS);
  assert.match(all.text, /ครบแล้ว/);
  assert.equal(all.buttons?.length, 0);
});
