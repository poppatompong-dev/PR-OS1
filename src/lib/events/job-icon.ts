// Icon for each job so the type reads without reading (owner, 29 Oct 2026:
// "งานจักรยานก็ควรมีอะไรที่สื่อถึงลักษณะงาน"). Picked from words in the title;
// the person adding the job can change it. Order matters: the first type whose
// word appears wins, so specific types (แข่งเรือ, ลอยกระทง) come before broad
// ones (กีฬา, พิธี); "เฉลิมพระเกียรติ" is usually a modifier, so รัฐพิธี comes late. Pure; tests/job-icon.unit.test.ts covers it.

export type JobIconKey =
  | "boat" | "bike" | "run" | "lotus" | "merit" | "royal" | "blood" | "health" | "kids"
  | "sport" | "tree" | "clean" | "fire" | "training" | "meeting" | "exhibit" | "music"
  | "festival" | "food" | "open" | "photo";

export type JobIcon = {
  key: JobIconKey;
  emoji: string;
  label: string;
  /** Tile gradient, light → dark. */
  colors: [string, string];
  /** lucide icon drawn inside the tile. */
  glyph: string;
  words: string[];
};

export const JOB_ICONS: JobIcon[] = [
  { key: "boat", emoji: "🚣", label: "แข่งเรือ / ทางน้ำ", colors: ["#4fc3ff", "#1565c0"], glyph: "sailboat", words: ["แข่งเรือ", "เรือยาว", "ทางน้ำ", "น้ำท่วม"] },
  { key: "bike", emoji: "🚴", label: "ปั่นจักรยาน", colors: ["#3ee0c5", "#00897b"], glyph: "bike", words: ["จักรยาน", "ปั่น", "bike"] },
  { key: "run", emoji: "🏃", label: "เดิน-วิ่ง", colors: ["#ffb74d", "#ef6c00"], glyph: "footprints", words: ["วิ่ง", "มาราธอน", "เดินการกุศล", "run"] },
  { key: "lotus", emoji: "🪷", label: "ลอยกระทง", colors: ["#ff9ad5", "#d81b60"], glyph: "flower-2", words: ["ลอยกระทง", "กระทง"] },
  { key: "merit", emoji: "🙏", label: "ทำบุญ / ศาสนา", colors: ["#ffd54f", "#f57f17"], glyph: "hand-heart", words: ["ทำบุญ", "ตักบาตร", "พระสงฆ์", "สงฆ์", "ถวายผ้า", "กฐิน", "ศาสนา", "วัด", "เจ้าพ่อ", "ไหว้"] },
  { key: "blood", emoji: "🩸", label: "บริจาคโลหิต", colors: ["#ff6b6b", "#c62828"], glyph: "droplet", words: ["บริจาคโลหิต", "บริจาคเลือด", "โลหิต"] },
  { key: "health", emoji: "🩺", label: "สุขภาพ", colors: ["#f48fb1", "#ad1457"], glyph: "heart-pulse", words: ["สุขภาพ", "วัคซีน", "ตรวจคัดกรอง", "ผู้สูงอายุ", "โรงพยาบาล", "อสม"] },
  { key: "kids", emoji: "🧒", label: "เด็ก / เยาวชน", colors: ["#90caf9", "#5e35b1"], glyph: "baby", words: ["วันเด็ก", "เด็ก", "เยาวชน"] },
  { key: "sport", emoji: "🏆", label: "กีฬา / แข่งขัน", colors: ["#9ccc65", "#2e7d32"], glyph: "trophy", words: ["กีฬา", "ฟุตบอล", "ฟุตซอล", "วอลเลย์", "แข่งขัน", "ชิงแชมป์"] },
  { key: "tree", emoji: "🌳", label: "ปลูกต้นไม้ / สิ่งแวดล้อม", colors: ["#81c784", "#1b5e20"], glyph: "trees", words: ["ปลูกต้นไม้", "ปลูกป่า", "ต้นไม้", "สิ่งแวดล้อม", "สวนสาธารณะ"] },
  { key: "clean", emoji: "🧹", label: "ทำความสะอาด", colors: ["#80deea", "#00838f"], glyph: "brush-cleaning", words: ["ทำความสะอาด", "bigcleaning", "บิ๊กคลีนนิ่ง", "ขยะ", "คัดแยก"] },
  { key: "fire", emoji: "🚒", label: "ซ้อมแผน / ป้องกันภัย", colors: ["#ff8a65", "#d84315"], glyph: "flame", words: ["ดับเพลิง", "อัคคีภัย", "ซ้อมแผน", "ป้องกันภัย", "สาธารณภัย", "กู้ภัย"] },
  { key: "training", emoji: "🎓", label: "อบรม / สัมมนา", colors: ["#7986cb", "#283593"], glyph: "graduation-cap", words: ["อบรม", "สัมมนา", "ฝึกอบรม", "ศึกษาดูงาน", "ปฐมนิเทศ", "นักเรียน", "โรงเรียน", "workshop"] },
  { key: "meeting", emoji: "🎤", label: "ประชุม / แถลงข่าว", colors: ["#b39ddb", "#4527a0"], glyph: "mic", words: ["ประชุม", "แถลงข่าว", "สัมภาษณ์", "เสวนา", "สภา", "ประชาคม", "รับฟังความคิดเห็น"] },
  { key: "exhibit", emoji: "🖼️", label: "นิทรรศการ", colors: ["#a1887f", "#4e342e"], glyph: "presentation", words: ["นิทรรศการ", "จัดแสดง", "บูธ"] },
  { key: "music", emoji: "🎵", label: "ดนตรี / การแสดง", colors: ["#ce93d8", "#6a1b9a"], glyph: "music", words: ["คอนเสิร์ต", "ดนตรี", "การแสดง", "ประกวดร้องเพลง", "มหรสพ"] },
  { key: "festival", emoji: "🎉", label: "เทศกาล / งานรื่นเริง", colors: ["#ff80ab", "#c2185b"], glyph: "party-popper", words: ["เทศกาล", "ตรุษจีน", "สงกรานต์", "ปีใหม่", "เคานต์ดาวน์", "แห่เจ้า", "แห่มังกร", "ขบวนแห่", "งานประจำปี", "รื่นเริง"] },
  { key: "food", emoji: "🍲", label: "ตลาด / อาหาร", colors: ["#ffcc80", "#e65100"], glyph: "utensils", words: ["ตลาด", "ถนนคนเดิน", "อาหาร", "otop", "ของดี"] },
  { key: "royal", emoji: "🎗️", label: "รัฐพิธี / วันสำคัญ", colors: ["#ffe082", "#b8860b"], glyph: "landmark", words: ["รัฐพิธี", "เฉลิมพระเกียรติ", "ถวายพระพร", "พระราช", "วันพ่อ", "วันแม่", "วันปิยมหาราช", "วางพวงมาลา", "เคารพธงชาติ"] },
  { key: "open", emoji: "✂️", label: "พิธีเปิด / ส่งมอบ", colors: ["#f8bbd0", "#880e4f"], glyph: "scissors", words: ["พิธีเปิด", "เปิดงาน", "เปิดโครงการ", "ตัดริบบิ้น", "ส่งมอบ", "มอบ", "พิธี"] },
  { key: "photo", emoji: "📸", label: "งานทั่วไป", colors: ["#c99bff", "#5b2a86"], glyph: "camera", words: [] },
];

const BY_KEY = new Map(JOB_ICONS.map((i) => [i.key, i]));
export const DEFAULT_ICON = BY_KEY.get("photo")!;

export function isJobIconKey(v: unknown): v is JobIconKey {
  return typeof v === "string" && BY_KEY.has(v as JobIconKey);
}

/** The icon for a job: the one chosen in the form, else guessed from the title. */
export function jobIcon(title: string, chosen?: string | null): JobIcon {
  if (chosen && isJobIconKey(chosen)) return BY_KEY.get(chosen)!;
  const t = title.replace(/\s+/g, "").toLowerCase();
  for (const icon of JOB_ICONS) if (icon.words.some((w) => t.includes(w))) return icon;
  return DEFAULT_ICON;
}

/**
 * What to store from the form: only a real choice that differs from the guess,
 * so a job keeps following its title until someone picks something else.
 */
export function cleanIcon(value: unknown, title: string): JobIconKey | null {
  if (!isJobIconKey(value)) return null;
  return value === jobIcon(title).key ? null : value;
}
