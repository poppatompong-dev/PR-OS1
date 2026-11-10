// คำขอจากทีม (10 Nov 2026): requests + status rows → the TV board and the private notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boardRequests, foldRequests, requestNotice, safeImage, topicOf } from "@/lib/team-requests";
import { buildSlides } from "@/app/monitor/TvShowcase";

const names = new Map([["p1", "นัท"], ["p2", "แข"]]);
const reqs = [
  { id: "r1", entity_id: "p1", action: "look_request", new_values: { text: "อยากได้ลุคนางเงือก สีฟ้าทะเล มีหางยาว ๆ แวววาวด้วยนะคะ ขอบคุณค่ะ" }, changed_at: "2026-11-09T03:00:00Z" },
  { id: "r2", entity_id: "p2", action: "look_request", new_values: { text: "ลุคนักวิ่ง" }, changed_at: "2026-11-10T03:00:00Z" },
  { id: "r3", entity_id: "p1", action: "gag_idea", new_values: { text: "แก็กแมวขโมยไมค์" }, changed_at: "2026-11-01T03:00:00Z" },
  { id: "x", entity_id: "p1", action: "tv_joke", new_values: { text: "no" }, changed_at: "2026-11-01T03:00:00Z" },
];
const statuses = [
  { entity_id: "r1", new_values: { status: "choose", topic: "ลุคนางเงือก", image: "/looks/nat-mermaid.jpg" }, changed_at: "2026-11-10T04:00:00Z" },
  { entity_id: "r1", new_values: { status: "doing" }, changed_at: "2026-11-09T05:00:00Z" },
  { entity_id: "r3", new_values: { status: "done" }, changed_at: "2026-11-02T03:00:00Z" },
];

test("newest status wins; topic and picture stick", () => {
  const all = foldRequests(reqs, statuses, names);
  assert.equal(all.length, 3);
  const r1 = all.find((r) => r.id === "r1")!;
  assert.equal(r1.status, "choose");
  assert.equal(r1.topic, "ลุคนางเงือก");
  assert.equal(r1.image, "/looks/nat-mermaid.jpg");
  assert.equal(r1.name, "นัท");
  assert.equal(all.find((r) => r.id === "r2")!.status, "received");
});

test("board: open first, old เสร็จ and ไม่ทำ hidden", () => {
  const all = foldRequests(reqs, statuses, names);
  const b = boardRequests(all, new Date("2026-11-10T08:00:00Z"));
  assert.deepEqual(b.map((r) => r.id), ["r1", "r2"]);
  const fresh = boardRequests(all, new Date("2026-11-03T08:00:00Z"));
  assert.ok(fresh.some((r) => r.id === "r3"));
});

test("only our own pictures or https", () => {
  assert.equal(safeImage("/looks/kae-runner.jpg"), "/looks/kae-runner.jpg");
  assert.equal(safeImage("/looks/../secret.jpg"), null);
  assert.equal(safeImage("javascript:alert(1)"), null);
  assert.equal(safeImage("/etc/passwd"), null);
  assert.equal(safeImage("https://x.test/a.jpg"), "https://x.test/a.jpg");
});

test("topic is short", () => {
  assert.ok(topicOf("look_request", reqs[0].new_values.text).length <= 40);
  assert.equal(topicOf("gag_idea", "", null), "ไอเดียแก็ก");
});

test("private notice only for รอเลือก / เสร็จ, picture as a full URL", () => {
  const r = { kind: "look_request" as const, topic: "ลุคนักวิ่ง" };
  assert.equal(requestNotice(r, "doing", "", null, "https://pr-os1.vercel.app"), null);
  const m = requestNotice(r, "choose", "มี 3 แบบ", "/looks/kae-runner.jpg", "https://pr-os1.vercel.app/")!;
  assert.equal(m.photo, "https://pr-os1.vercel.app/looks/kae-runner.jpg");
  assert.match(m.text, /เลือก/);
  assert.match(requestNotice(r, "done", "", null, "https://a")!.text, /เสร็จ/);
});

test("slides: a request after every second post", () => {
  assert.deepEqual(buildSlides(4, 1).map((s) => s.t), ["news", "news", "req", "news", "news"]);
  assert.deepEqual(buildSlides(0, 2).map((s) => s.t), ["req", "req"]);
  assert.equal(buildSlides(0, 0).length, 0);
});
