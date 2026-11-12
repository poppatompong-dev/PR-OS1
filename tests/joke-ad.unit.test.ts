// ช่วงโฆษณามุกเต็มจอ (12 Nov 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { adHead, adOrder, jobSoon } from "@/app/monitor/TvJokeAd";

test("ad order: contest numbers first, later jokes by time", () => {
  const out = adOrder([
    { id: "late", personId: "", name: "", setup: "", punch: "x", at: "2026-11-21T01:00:00Z" },
    { id: "n2", personId: "", name: "", setup: "", punch: "x", no: 2 },
    { id: "n1", personId: "", name: "", setup: "", punch: "x", no: 1 },
  ]);
  assert.deepEqual(out.map((j) => j.id), ["n1", "n2", "late"]);
  assert.equal(adHead({ no: 5 }), "มุกประกวดที่ 5");
  assert.equal(adHead({}), "มุกจากทีม");
});

test("no ad when a job starts within 30 min (Bangkok)", () => {
  const now = Date.parse("2026-11-12T10:00:00+07:00");
  const ev = (startTime: string, status = "scheduled") => ({ eventDate: "2026-11-12", startTime, status });
  assert.equal(jobSoon([ev("10:20")], now), true);
  assert.equal(jobSoon([ev("10:45")], now), false);
  assert.equal(jobSoon([ev("09:30")], now), false);
  assert.equal(jobSoon([ev("10:10", "canceled")], now), false);
});

test("กองเชียร์: 4 fans, never the teller, rotate; the slow one is never a senior", async () => {
  const { pickCrowd, fanPose } = await import("@/app/monitor/TvJokeAd");
  const PAI = "00000000-0000-0000-0000-000000000501", HEAD = "774174ff-e0cc-4bc5-922e-13fd1b05750d";
  const pool = [PAI, HEAD, "a", "b", "c", "d", "teller"];
  const seen = new Set<string>();
  for (let n = 0; n < 6; n++) {
    const { ids, late } = pickCrowd(pool, "teller", n);
    assert.equal(ids.length, 4);
    assert.ok(!ids.includes("teller"));
    assert.ok(late >= 0 && ![PAI, HEAD].includes(ids[late]));
    ids.forEach((id) => seen.add(id));
  }
  assert.equal(seen.size, 6); // everyone gets a turn
  assert.deepEqual(pickCrowd([PAI, HEAD], "x", 0).late, -1);
  assert.equal(fanPose("rush", 0, 0, 1).pose, "off");
  assert.equal(fanPose("rush", 1, 0, 1).pose, "run");
  assert.deepEqual(fanPose("late", 2, 1, 1), { pose: "shock", say: "?" });
  assert.deepEqual(fanPose("late", 3, 1, 1), { pose: "up", say: "อ๋อ!" });
  assert.equal(fanPose("audience", 0, 2, 1).pose, "sit");
});
