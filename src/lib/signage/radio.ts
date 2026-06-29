// สถานีเพลงล้วน (ไม่มีข่าว/โฆษณาคั่น) เหมาะคลอจอเปิดทั้งวัน
// เลือกแนว lo-fi / chill / บรรเลง ที่เล่นเพลงต่อเนื่อง
// หมายเหตุ: URL สตรีมอาจเปลี่ยน/ติด CORS ตอน deploy — ปรับได้ที่ไฟล์นี้
export type Station = { name: string; genre: string; url: string };

export const STATIONS: Station[] = [
  { name: "Lo-Fi Chill", genre: "lo-fi ต่อเนื่อง", url: "https://stream.zeno.fm/f3wvbbqmdg8uv" },
  { name: "Chill Lounge", genre: "ฟังสบาย ไม่มีโฆษณา", url: "https://stream.zeno.fm/0r0xa792kwzuv" },
  { name: "Instrumental", genre: "บรรเลง คลอเบา", url: "https://stream.zeno.fm/8s5y6e7trf9uv" },
  { name: "Acoustic Cafe", genre: "อะคูสติก คาเฟ่", url: "https://stream.zeno.fm/u9eqfvfm2nhvv" },
];
