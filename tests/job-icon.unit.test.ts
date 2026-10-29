// Job icons (owner, 29 Oct 2026): the type reads without reading the title.
//   npx -y tsx@4.19.2 --test tests/job-icon.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { JOB_ICONS, cleanIcon, jobIcon } from "@/lib/events/job-icon";

test("the title picks the icon, specific types before broad ones", () => {
  assert.equal(jobIcon("ปั่นจักรยานเฉลิมพระเกียรติ รอบบึงบอระเพ็ด").key, "bike");
  assert.equal(jobIcon("พิธีเปิดงานประเพณีลอยกระทง ประจำปี 2569").key, "lotus");
  assert.equal(jobIcon("แข่งเรือยาวประเพณี ชิงถ้วยพระราชทาน").key, "boat");
  assert.equal(jobIcon("บริจาคโลหิตเฉลิมพระเกียรติ").key, "blood");
  assert.equal(jobIcon("แข่งขันกีฬาเฉลิมพระเกียรติ").key, "sport");
  assert.equal(jobIcon("ประชุมสภาเทศบาล สมัยสามัญ").key, "meeting");
  assert.equal(jobIcon("Big Cleaning Day ตลาดสด").key, "clean");
  assert.equal(jobIcon("วันเด็กแห่งชาติ").key, "kids");
  assert.equal(jobIcon("ลงพื้นที่ถ่ายภาพ").key, "photo");
});

test("a choice in the form wins; the same as the guess is not stored", () => {
  assert.equal(jobIcon("ประชุมสภา", "music").key, "music");
  assert.equal(jobIcon("ประชุมสภา", "nonsense").key, "meeting");
  assert.equal(cleanIcon("music", "ประชุมสภา"), "music");
  assert.equal(cleanIcon("meeting", "ประชุมสภา"), null);
  assert.equal(cleanIcon("<script>", "ประชุมสภา"), null);
  assert.equal(cleanIcon("", "ประชุมสภา"), null);
});

test("every icon has an emoji, two colours and a unique key", () => {
  assert.equal(new Set(JOB_ICONS.map((i) => i.key)).size, JOB_ICONS.length);
  for (const i of JOB_ICONS) assert.ok(i.emoji && i.colors.length === 2 && i.glyph, i.key);
});
