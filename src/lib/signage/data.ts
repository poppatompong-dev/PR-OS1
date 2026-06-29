// ข้อมูลสำหรับจอ digital signage (สลับหน้าอัตโนมัติ)
// ค่าเริ่มต้น = ข้อมูลจริง ณ 29 มิ.ย. 2569 (ดึงจากเว็บ)
// โครงสร้างนี้ออกแบบให้ดึง API จริงทีหลังได้ (ดู src/app/api/signage/*)

export type GoldPrice = { barBuy: number; barSell: number; ornamentSell: number; changeTHB: number; updatedAt: string };
export type OilRow = { name: string; price: number };
export type WeatherNow = { place: string; tempHigh: number; tempLow: number; condition: string; rainChance: number; icon: string };
export type NewsItem = { tag: string; title: string; time: string };

export const GOLD: GoldPrice = {
  barBuy: 63500,
  barSell: 63600,
  ornamentSell: 64400,
  changeTHB: -300,
  updatedAt: "29 มิ.ย. 2569",
};

export const OIL: OilRow[] = [
  { name: "ดีเซล", price: 37.5 },
  { name: "ดีเซล B20", price: 32.5 },
  { name: "แก๊สโซฮอล์ 91", price: 37.68 },
  { name: "แก๊สโซฮอล์ 95", price: 38.05 },
  { name: "แก๊สโซฮอล์ E20", price: 33.05 },
  { name: "เบนซิน", price: 47.64 },
];
export const OIL_UPDATED = "29 มิ.ย. 2569";

export const WEATHER: WeatherNow = {
  place: "นครสวรรค์",
  tempHigh: 36,
  tempLow: 25,
  condition: "ฝนฟ้าคะนองบางแห่ง",
  rainChance: 60,
  icon: "🌦️",
};

// ข่าวเด่น / ประกาศเทศบาลนครนครสวรรค์ (ตัวอย่าง — เปลี่ยนเป็นประกาศจริงได้)
export const NEWS: NewsItem[] = [
  { tag: "ประกาศ", title: "เทศบาลนครนครสวรรค์ เปิดรับชำระภาษีที่ดินและสิ่งปลูกสร้าง ประจำปี 2569", time: "วันนี้" },
  { tag: "กิจกรรม", title: "เชิญชวนประชาชนร่วมงานประเพณีแห่เจ้าพ่อ-เจ้าแม่ปากน้ำโพ", time: "เร็ว ๆ นี้" },
  { tag: "บริการ", title: "เปิดให้บริการฉีดวัคซีนป้องกันโรคพิษสุนัขบ้า ฟรี ทุกชุมชน", time: "ก.ค. 69" },
  { tag: "แจ้งเตือน", title: "เฝ้าระวังน้ำท่วมขังช่วงฝนตกหนัก ติดตามประกาศจากเทศบาลอย่างใกล้ชิด", time: "ช่วงฤดูฝน" },
];

// เกร็ดน่าติดตาม: บอลโลก 2026 + เทรนด์
export const FUN_FACTS: NewsItem[] = [
  { tag: "ฟุตบอลโลก 2026", title: "จัด 3 ประเทศเจ้าภาพ สหรัฐฯ–แคนาดา–เม็กซิโก ครั้งแรกที่มี 48 ทีม", time: "มิ.ย.–ก.ค. 2026" },
  { tag: "รู้หรือไม่", title: "นครสวรรค์ คือต้นกำเนิดแม่น้ำเจ้าพระยา จุดบรรจบปิง–วัง–ยม–น่าน", time: "เกร็ดเมือง" },
  { tag: "เทรนด์", title: "คลิปวิดีโอสั้นแนวตั้ง ยังครองการเข้าถึงสูงสุดบนโซเชียลปี 2026", time: "อัปเดต" },
];
