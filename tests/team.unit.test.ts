// Rules behind the "ทีมงาน" table on /settings.
//   npx -y tsx@4.19.2 --test tests/team.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTeam, initialPassword, normalizeUsername, type TeamAccountInput } from "@/lib/settings/team";
import { linkPromptMessage } from "@/lib/line/messages";
import { ROLE_LABELS_TH, UI_ROLES } from "@/lib/auth/roles";

const acct = (over: Partial<TeamAccountInput>): TeamAccountInput => ({
  id: "a1", email: "x@internal.pr-os.local", username: "x", role: "supervisor", personId: null,
  displayName: null, lastSignInAt: null, suspended: false, lineLinked: false, lineLinkedAt: null, ...over,
});

test("initial password: the username, padded with 123 under 6 characters", () => {
  assert.equal(initialPassword("test01"), "test01");
  assert.equal(initialPassword("kai"), "kai123");
  assert.equal(initialPassword("earth"), "earth123");
  assert.equal(normalizeUsername("ab"), null, "3+ characters, so username + 123 always reaches 6");
});

test("usernames: lowercased, spaces removed, odd characters refused", () => {
  assert.equal(normalizeUsername(" Som Jai "), "somjai");
  assert.equal(normalizeUsername("test.01"), "test.01");
  assert.equal(normalizeUsername("สมใจ"), null);
  assert.equal(normalizeUsername("a"), null);
  assert.equal(normalizeUsername(""), null);
});

test("team rows: people joined to their accounts, orphans last, watchers flagged", () => {
  const people = [
    { id: "p2", displayName: "นายข", position: "", isActive: true, lineLinked: false },
    { id: "p1", displayName: "นายก", position: "ผู้ดูแล", isActive: true, lineLinked: true },
    { id: "p3", displayName: "นางค", position: "", isActive: false, lineLinked: false },
  ];
  const accounts = [
    acct({ id: "a1", username: "kai", role: "admin", personId: "p1", lastSignInAt: "2026-10-20T01:00:00Z" }),
    acct({ id: "tv", username: "tv", role: "display", personId: null }),
    acct({ id: "a3", username: "khom", personId: "p3", suspended: true }),
  ];
  const team = buildTeam(people, accounts, ["p1"]);
  assert.deepEqual(team.map((m) => m.key), ["p1", "p2", "p3", "acct:tv"]);
  assert.equal(team[0].watcher, true);
  assert.equal(team[0].accounts[0].username, "kai");
  assert.equal(team[0].lastSignInAt, "2026-10-20T01:00:00Z");
  assert.equal(team[1].accounts.length, 0, "a person with no sign-in still gets a row");
  assert.equal(team[2].suspended, true);
  assert.equal(team[3].personId, null);
});

test("three roles in the UI; supervisor is the full-rights เจ้าหน้าที่", () => {
  assert.deepEqual(UI_ROLES, ["admin", "supervisor", "display"]);
  assert.equal(ROLE_LABELS_TH.supervisor, "เจ้าหน้าที่");
});

test("the bot's ผูกบัญชี button opens the confirm page, not LINE Login directly", () => {
  const json = JSON.stringify(linkPromptMessage());
  assert.match(json, /\/link-line"/);
  assert.doesNotMatch(json, /api\/auth\/line\/start/);
});
