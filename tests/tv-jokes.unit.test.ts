import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanJoke, parseJokeCommand, splitJoke } from "../src/lib/tv-jokes";

test("มุก command: with text, alone, and not a command", () => {
  assert.equal(parseJokeCommand("มุก ประชุมสั้น ๆ | 2 ชั่วโมง"), "ประชุมสั้น ๆ | 2 ชั่วโมง");
  assert.equal(parseJokeCommand("มุก: ทดสอบ"), "ทดสอบ");
  assert.equal(parseJokeCommand("ส่งมุก"), "");
  assert.equal(parseJokeCommand("/joke"), "");
  assert.equal(parseJokeCommand("มุกดา ไปไหน"), null);
  assert.equal(parseJokeCommand("งานวันนี้"), null);
});

test("joke: tidy, length cap, no links, setup | punchline", () => {
  assert.equal(cleanJoke("a").ok, false);
  assert.equal(cleanJoke("x".repeat(200)).ok, false);
  assert.equal(cleanJoke("ดู https://x.co").ok, false);
  const c = cleanJoke("  ทำไม  Wi-Fi เร็ว \n เร็วที่จะหลุด ");
  assert.ok(c.ok);
  assert.deepEqual(splitJoke(c.ok ? c.text : ""), { setup: "ทำไม Wi-Fi เร็ว", punch: "เร็วที่จะหลุด" });
  assert.deepEqual(splitJoke("มุกเดียวจบ"), { setup: "", punch: "มุกเดียวจบ" });
  assert.deepEqual(
    splitJoke("ตัวละครยืนคุยกัน คำถาม : จุดแข็งของคุณคืออะไร คำตอบ : คอ บ่า ไหล่ คำถาม : แล้วจุดอ่อน คำตอบ : ปัญญา.. อิอิ"),
    { setup: "จุดแข็งของคุณคืออะไร → คอ บ่า ไหล่ แล้วจุดอ่อน", punch: "ปัญญา.. อิอิ" },
  );
});
