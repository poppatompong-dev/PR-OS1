// Reports: people the system never reached are not "didn't acknowledge" (owner, 4 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/reports.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { byPerson } from "@/lib/reports/breakdowns";
import type { PrEvent } from "@/types/domain";

const asg = (id: string, name: string, ack: "acknowledged" | "pending", notified?: boolean) =>
  ({ id, person: { id: name, displayName: name }, role: { id: "r", name: "พิธีกร" }, ackStatus: ack, notified }) as unknown as PrEvent["assignments"][number];
const ev = (id: string, a: PrEvent["assignments"]): PrEvent =>
  ({ id, title: "งาน", eventDate: "2026-11-04", startTime: "09:00", status: "published", urgency: "normal", hasChanges: false,
     ownerDepartment: { id: "d", name: "กอง", shortName: "กอง" }, location: { id: "l", name: "x" }, eventType: "", intakeChannel: "", assignments: a, updatedAt: "" }) as unknown as PrEvent;

test("never reached is counted apart, and the rate ignores it", () => {
  const rows = byPerson([
    ev("1", [asg("a1", "ไป๋", "pending", false), asg("a2", "ภัส", "acknowledged", true)]),
    ev("2", [asg("a3", "ไป๋", "pending", false), asg("a4", "ภัส", "pending", true)]),
  ]);
  const pai = rows.find((r) => r.personName === "ไป๋")!;
  const pat = rows.find((r) => r.personName === "ภัส")!;
  assert.equal(pai.notReached, 2);
  assert.equal(pai.pending, 0);
  assert.equal(pai.ackRate, null);
  assert.equal(pat.pending, 1);
  assert.equal(pat.ackRate, 0.5);
});

test("unknown reach (no notification data) keeps the old rule", () => {
  const [r] = byPerson([ev("1", [asg("a1", "แป้ง", "pending")])]);
  assert.equal(r.pending, 1);
  assert.equal(r.notReached, 0);
  assert.equal(r.ackRate, 0);
});
