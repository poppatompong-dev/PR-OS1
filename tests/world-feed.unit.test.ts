// TV ticker filler: gold, oil, headlines (owner, 3 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/world-feed.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { goldLine, newsLines, oilLine } from "@/lib/monitor/world-feed";

test("gold: bar prices with the association's time; bad input → nothing", () => {
  const j = { status: "success", response: { update_time: "เวลา 09:02 น. (ครั้งที่ 1)", price: { gold_bar: { buy: "62,850.00", sell: "63,050.00" } } } };
  assert.equal(goldLine(j), "🥇 ทองคำแท่ง ขายออก 63,050.00 · รับซื้อ 62,850.00 บาท (สมาคมค้าทองคำ 09:02 น.)");
  assert.equal(goldLine(null), null);
  assert.equal(goldLine({ status: "error" }), null);
});

test("oil: four common grades, tomorrow's move when there is one", () => {
  const list = [
    { OilName: "ดีเซล B20", PriceToday: 33.5, PriceTomorrow: 33.5 },
    { OilName: "ไฮดีเซล S", PriceToday: 42.54, PriceTomorrow: 42.94 },
    { OilName: "แก๊สโซฮอล์ E20 S EVO", PriceToday: 33.5, PriceTomorrow: 33.5 },
    { OilName: "แก๊สโซฮอล์ 91 S EVO", PriceToday: 41.17, PriceTomorrow: 41.17 },
    { OilName: "แก๊สโซฮอล์ 95 S EVO", PriceToday: 41.54, PriceTomorrow: 41.54 },
  ];
  assert.equal(
    oilLine([{ OilList: JSON.stringify(list) }]),
    "⛽ น้ำมันวันนี้ (บางจาก) ดีเซล 42.54 · แก๊สโซฮอล์ 95 41.54 · แก๊สโซฮอล์ 91 41.17 · E20 33.50 บาท/ลิตร · พรุ่งนี้ขึ้น 0.40 บาท",
  );
  assert.equal(oilLine([{ OilList: "not json" }]), null);
  assert.equal(oilLine({}), null);
});

test("news: only economy / society / world, no politics, crime or violence, recent, max 5", () => {
  const now = Date.parse("Tue, 3 Nov 2026 09:00:00 +0700");
  const item = (t: string, c: string, d = "Tue, 3 Nov 2026 08:00:00 +0700") => `<item><title><![CDATA[${t}]]></title><category>${c}</category><pubDate>${d}</pubDate></item>`;
  const xml = `<rss><channel>${[
    item("สภาพอากาศวันนี้ ฝนตก 60%", "สังคม"),
    item("ปธ.สภาฯ วางกรอบ กมธ.", "การเมือง"),
    item("แจ้งความที่กองปราบ", "อาชญากรรม"),
    item("อิหร่านเตือนสงครามระลอกใหม่", "ต่างประเทศ"),
    item("สรุปราคาทองคำ 2 พ.ย. &amp; ปิดตลาด", "เศรษฐกิจ"),
    item("ข่าวเก่าเศรษฐกิจ", "เศรษฐกิจ", "Fri, 30 Oct 2026 08:00:00 +0700"),
  ].join("")}</channel></rss>`;
  assert.deepEqual(newsLines(xml, now), ["📰 สภาพอากาศวันนี้ ฝนตก 60%", "📰 สรุปราคาทองคำ 2 พ.ย. & ปิดตลาด (Thai PBS)"]);
  assert.deepEqual(newsLines(null), []);
});
