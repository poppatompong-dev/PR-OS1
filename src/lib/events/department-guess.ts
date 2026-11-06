// "หน่วยงานเจ้าของงาน" on the phone form (owner, 6 Nov 2026): optional, guessed
// from the job title so most jobs need no tap. Keys are departments.short_name
// (settings: ยก. พส. ปชส. สภาฯ บค. บช. พบ. กศ. สธ. สป.). First rule that
// matches wins, so the narrow ones come first. Client-safe (no imports).

const RULES: Array<[RegExp, string]> = [
  [/สปสช|อสม|สาธารณสุข|สุขภาพ|วัคซีน|ไข้เลือดออก|ขยะ|สิ่งแวดล้อม|ตลาดสด|อาหารปลอดภัย|รักษ์อาหาร/, "สธ."],
  [/โรงพยาบาล|รพ\.|แพทย์|คลินิก/, "พบ."],
  [/สตรี|คนชรา|ผู้สูงอายุ|คนพิการ|ผู้พิการ|ถุงยังชีพ|ผู้ประสบ|อุทกภัย|สวัสดิการ|กรรมการชุมชน|ชุมชน|ครัวกลาง|ความรุนแรง/, "พส."],
  [/สภา|ส\.ท\.|สท\b|สท |สมาชิกสภา/, "สภาฯ"],
  [/โรงเรียน|นักเรียน|ครู|ศึกษา|ห้องสมุด|กีฬา|นักกีฬา|ยกน้ำหนัก|วิ่ง|run\b|แข่งเรือ|ลอยกระทง|สงกรานต์|ตักบาตร|ออกพรรษา|ประเพณี|วัฒนธรรม|ตรุษจีน|ฮาโลวีน|halloween|haloween|holloven/i, "กศ."],
  [/คลัง|ภาษี|รายได้|จัดเก็บ/, "บค."],
  [/ช่าง|ถนน|ก่อสร้าง|ไฟฟ้า|ระบายน้ำ|สะพาน|ผังเมือง/, "บช."],
  [/ยุทธศาสตร์|งบประมาณ|กองยุทธ|ยก\.|แผนพัฒนา/, "ยก."],
  [/แถลงข่าว|ประชาสัมพันธ์|บันทึกเทป|สกู๊ป|ไลฟ์|ถ่ายทอดสด|เสวนา|สัมภาษณ์|thaipbs|วันเกิด/i, "ปชส."],
  [/พิธี|พวงมาลา|ดอกไม้จันทน์|วันคล้าย|รัฐพิธี|ต้อนรับ|ผู้โอน|โอนย้าย|เลขา|นายก|ปลัด|ผู้บริหาร/, "สป."],
];

/** The short name of the department this job most likely belongs to, or null. */
export function guessDepartment(title: string): string | null {
  const t = (title ?? "").trim();
  if (!t) return null;
  for (const [re, short] of RULES) if (re.test(t)) return short;
  return null;
}
