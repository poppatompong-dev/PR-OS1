// ตัดคำขึ้นบรรทัดใหม่ (12 Nov 2026): the TV breaks titles only between real words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { thaiPieces } from "@/lib/monitor/thai-wrap";

const flat = (t: string) => thaiPieces(t).map((c) => c.join("|")).join(" / ");
test("ฯ stays with its word, no mid-word break", () => {
  assert.equal(flat("เสวนา ขับเคลื่อนเมืองอนาคตฯ"), "เสวนา / ขับ|เคลื่อน|เมือง|อนาคตฯ");
});
test("short phrases never break; compounds and prefixes stay whole", () => {
  assert.equal(flat("พิธีเปิดโครงการยุติความรุนแรงต่อเด็ก สตรี คนชรา"), "พิธี|เปิด|โครงการ|ยุติ|ความรุนแรง|ต่อ|เด็ก / สตรี / คนชรา");
  assert.equal(flat("วางดอกไม้จันทน์ ช่วงที่ 2"), "วาง|ดอกไม้จันทน์ / ช่วงที่ / 2");
  assert.equal(flat("พิธีวางพวงมาลาเนื่องในวันปิยมหาราช"), "พิธี|วาง|พวงมาลา|เนื่อง|ใน|วัน|ปิยมหาราช");
});
