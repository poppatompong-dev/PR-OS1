// Registration from the team group (owner, 20 Oct 2026): staff tap one button
// in the existing LINE group and an admin confirms who they are.
//   npx -y tsx@4.19.2 --test tests/line-registration.unit.test.ts
//
// Names below are made up; never copy real staff names into tests.

import { test } from "node:test";
import assert from "node:assert/strict";

import { parsePostback, postback, registerCardMessage, registerReceivedMessage } from "@/lib/line/messages";
import { matchCommand, matchRegister } from "@/lib/line/webhook";
import { addFriendUrl } from "@/lib/line/api";
import {
  mergePendingRegistration,
  parsePendingRegistrations,
  removePendingRegistration,
  type PendingRegistration,
} from "@/lib/line/registrations";
import { lineCandidates, normalizeName, suggestPerson, type MatchCandidate, type TeamMember } from "@/lib/settings/team";

/** Walk any flex JSON and collect every action object. */
function actions(node: unknown, out: Array<Record<string, string>> = []) {
  if (Array.isArray(node)) node.forEach((n) => actions(n, out));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.action && typeof o.action === "object") out.push(o.action as Record<string, string>);
    Object.values(o).forEach((v) => actions(v, out));
  }
  return out;
}

const people: MatchCandidate[] = [
  { id: "p1", displayName: "นางสาวสมใจ ใจดี", usernames: ["somjai"] },
  { id: "p2", displayName: "นายมานะ ขยันยิ่ง", usernames: ["mana"] },
  { id: "p3", displayName: "นางปิติ ชื่นบาน", usernames: ["piti"] },
];

test("suggestPerson: English nickname matches the username", () => {
  assert.equal(suggestPerson("Somjai ✿", people), "p1");
  assert.equal(suggestPerson("MANA", people), "p2");
});

test("suggestPerson: Thai first name, with or without a title", () => {
  assert.equal(suggestPerson("สมใจ", people), "p1");
  assert.equal(suggestPerson("นายมานะ", people), "p2");
  assert.equal(suggestPerson("ปิติ ช.", people), "p3");
  assert.equal(suggestPerson("นางปิติ ชื่นบาน", people), "p3");
});

test("suggestPerson: no match or a tie gives null", () => {
  assert.equal(suggestPerson("Nong Meow 🐱", people), null);
  assert.equal(suggestPerson("x", people), null);
  const twins: MatchCandidate[] = [
    { id: "a", displayName: "นายสมชาย หนึ่ง", usernames: [] },
    { id: "b", displayName: "นายสมชาย สอง", usernames: [] },
  ];
  assert.equal(suggestPerson("สมชาย", twins), null);
});

test("normalizeName strips titles, spaces and emoji but keeps Thai vowels", () => {
  assert.equal(normalizeName("นางสาว สมใจ  ใจดี"), "สมใจใจดี");
  assert.equal(normalizeName("[ทดสอบ] นายมานะ"), "มานะ");
  assert.equal(normalizeName("Somjai ✿"), "somjai");
});

test("lineCandidates: only active people without LINE", () => {
  const base = { position: "", email: null, lineLinkedAt: null, watcher: false, lastSignInAt: null };
  const team: TeamMember[] = [
    { ...base, key: "1", personId: "1", displayName: "ก", personActive: true, lineLinked: false, accounts: [], suspended: false },
    { ...base, key: "2", personId: "2", displayName: "ข", personActive: true, lineLinked: true, accounts: [], suspended: false },
    { ...base, key: "3", personId: "3", displayName: "ค", personActive: false, lineLinked: false, accounts: [], suspended: true },
    { ...base, key: "acct:x", personId: null, displayName: "TV", personActive: true, lineLinked: false, accounts: [], suspended: false },
  ];
  assert.deepEqual(lineCandidates(team).map((c) => c.id), ["1"]);
});

test("registration card fits LINE's limits and its tap is not itself a command", () => {
  const m = registerCardMessage();
  assert.ok(m.type === "flex" && m.altText.length <= 400);
  const [a] = actions(m);
  assert.equal(a.type, "postback");
  assert.ok(a.label.length <= 20, a.label);
  assert.ok(a.data.length <= 300);
  assert.deepEqual(parsePostback(a.data), { a: "reg" });
  assert.equal(a.data, postback.register);
  // displayText is posted in the group as the person — it must not re-trigger the bot
  assert.equal(matchRegister(a.displayText), false);
  assert.equal(matchCommand(a.displayText), null);
});

test("registration reply: add-friend button when the bot ID is known", () => {
  const url = addFriendUrl("@749bsqwt");
  assert.equal(url, "https://line.me/R/ti/p/%40749bsqwt");
  assert.equal(addFriendUrl("749bsqwt"), url);
  const withButton = registerReceivedMessage("สมใจ", url);
  assert.ok(withButton.type === "flex" && withButton.altText.length <= 400);
  const [btn] = actions(withButton);
  assert.equal(btn.uri, url);
  assert.ok(btn.label.length <= 20);
  const plain = registerReceivedMessage("สมใจ", null);
  assert.ok(plain.type === "text" && plain.text.includes("สมใจ"));
});

test("matchRegister: the word on its own, not ordinary chatter", () => {
  assert.equal(matchRegister("ลงทะเบียน"), true);
  assert.equal(matchRegister(" ลง ทะเบียน "), true);
  assert.equal(matchRegister("ลงทะเบียน?"), true);
  assert.equal(matchRegister("ลงทะเบียนรับแจ้งงาน"), true);
  assert.equal(matchRegister("ลงทะเบียนเรียนต่อ"), false);
  assert.equal(matchRegister("ใครลงทะเบียนแล้วบ้าง"), false);
  assert.equal(matchCommand("ลงทะเบียน"), null);
});

test("pending list: one entry per LINE account, newest first, capped", () => {
  const e = (id: string, at: string): PendingRegistration => ({
    lineUserId: id, displayName: id, pictureUrl: null, groupId: "g", at,
  });
  let list = mergePendingRegistration([], e("U1", "2026-10-20T01:00:00Z"));
  list = mergePendingRegistration(list, e("U2", "2026-10-20T02:00:00Z"));
  list = mergePendingRegistration(list, e("U1", "2026-10-20T03:00:00Z")); // tapped again
  assert.deepEqual(list.map((r) => r.lineUserId), ["U1", "U2"]);
  assert.equal(list[0].at, "2026-10-20T03:00:00Z");
  assert.deepEqual(removePendingRegistration(list, "U1").map((r) => r.lineUserId), ["U2"]);

  let many: PendingRegistration[] = [];
  for (let i = 0; i < 60; i++) many = mergePendingRegistration(many, e(`U${i}`, new Date(Date.UTC(2026, 9, 20, 0, i)).toISOString()));
  assert.equal(many.length, 50);
  assert.equal(many[0].lineUserId, "U59");

  // whatever junk is in settings never breaks the page
  assert.deepEqual(parsePendingRegistrations(null), []);
  assert.deepEqual(parsePendingRegistrations([{ nope: 1 }, "x"]), []);
  assert.equal(parsePendingRegistrations([{ lineUserId: "U9" }])[0].displayName, "ผู้ใช้ LINE");
});
