// Avatars + the team-wide pending list (owner decisions, 20 Oct 2026).
//   npx -y tsx@4.19.2 --test tests/avatars.unit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { avatarUrl, DEFAULT_AVATAR, hasAvatar } from "@/lib/avatars";
import { AVATAR_FILES } from "@/lib/avatars-manifest";
import { pendingListMessage } from "@/lib/line/messages";
import type { TaskItem } from "@/lib/line/data";

test("every manifest entry points at a real, small file; unknown people get the mascot", () => {
  for (const file of new Set(Object.values(AVATAR_FILES))) {
    const p = join(process.cwd(), "public/avatars", file);
    assert.ok(existsSync(p), file);
    assert.ok(statSync(p).size < 40_000, `${file} is too big for a list of faces`);
  }
  assert.ok(existsSync(join(process.cwd(), "public", DEFAULT_AVATAR)));
  assert.equal(avatarUrl("not-a-person"), DEFAULT_AVATAR);
  assert.equal(avatarUrl(null), DEFAULT_AVATAR);
  assert.equal(hasAvatar("00000000-0000-0000-0000-000000000505"), true);
  assert.equal(avatarUrl("00000000-0000-0000-0000-000000000505"), "/avatars/00000000-0000-0000-0000-000000000505.png");
});

function task(personName: string, id: string): TaskItem {
  return {
    assignmentId: id, assignmentVersion: 1, personId: id, personName, lineUserId: null, roleName: "ถ่ายภาพ",
    acknowledged: false, unavailable: false, unavailableReason: null,
    event: { id: `e-${id}`, title: "งานทดสอบ", eventDate: "2026-10-21", startTime: "09:00", endTime: null,
      locationName: "ห้องประชุม 1", shortNote: null, status: "published", cancellationReason: null },
  };
}

test("team-scope pending list names everyone still to acknowledge", () => {
  const m = pendingListMessage([task("คน ก", "a"), task("คน ข", "b")], "team");
  const text = JSON.stringify(m);
  assert.ok(text.includes("คน ก") && text.includes("คน ข"));
});
