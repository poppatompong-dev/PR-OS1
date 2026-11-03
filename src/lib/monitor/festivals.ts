// Festival themes on the TV (owner, 3 Nov 2026: "ลองแค่เทศกาลก่อน · ไม่ต้อง
// รอให้ใครกด ให้แสดงได้เลย · ใส่เทคนิคเอฟเฟกต์ให้สวย ๆ" — and คุณกุ๊ก does not
// like a cluttered screen, so each theme is a few soft pieces at the edges).
// The theme switches itself by date (Bangkok). /tv?fest=loy previews one.
//
// Fixed-date festivals repeat every year. Lunar ones need their date each
// year — add the next year's line when it is announced:
//   ลอยกระทง  2569 = 24 พ.ย. (PPTV)
//   ตรุษจีนปากน้ำโพ 2570 = งาน 30 ม.ค.–10 ก.พ. (แนวหน้า: แห่กลางคืน 8 ก.พ., กลางวัน 9 ก.พ.)

export type FestivalKey = "loy" | "father" | "newyear" | "child" | "cny" | "songkran" | "mother";

export type Festival = { key: FestivalKey; chip: string };

type Range = { key: FestivalKey; from: string; to: string; chip: string }; // ISO yyyy-mm-dd, inclusive

/** One-off (lunar) windows, by Gregorian date. */
const DATED: Range[] = [
  { key: "loy", from: "2026-11-17", to: "2026-11-24", chip: "🪷 ลอยกระทง 24 พ.ย. 69" },
  { key: "cny", from: "2027-01-30", to: "2027-02-10", chip: "🏮 ตรุษจีนปากน้ำโพ 30 ม.ค.–10 ก.พ. 70" },
];

/** Same days every year (month-day, inclusive; may wrap the new year). */
const YEARLY: Array<{ key: FestivalKey; from: string; to: string; chip: (beYear: number) => string }> = [
  { key: "father", from: "12-01", to: "12-05", chip: () => "💛 5 ธันวาคม วันพ่อแห่งชาติ" },
  { key: "newyear", from: "12-26", to: "01-03", chip: (be) => `🎆 สวัสดีปีใหม่ ${be}` },
  { key: "songkran", from: "04-10", to: "04-16", chip: () => "💦 สุขสันต์วันสงกรานต์" },
  { key: "mother", from: "08-06", to: "08-12", chip: () => "🤍 12 สิงหาคม วันแม่แห่งชาติ" },
];

/** วันเด็ก = the second Saturday of January; the theme runs the 5 days before it too. */
export function childrensDay(year: number): string {
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay(); // 0 Sun … 6 Sat
  const firstSat = 1 + ((6 - jan1 + 7) % 7);
  return `${year}-01-${String(firstSat + 7).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const KEYS: FestivalKey[] = ["loy", "father", "newyear", "child", "cny", "songkran", "mother"];
export const isFestivalKey = (v: string | undefined): v is FestivalKey => KEYS.includes(v as FestivalKey);

export function festivalFor(iso: string): Festival | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  for (const r of DATED) if (iso >= r.from && iso <= r.to) return { key: r.key, chip: r.chip };

  const year = Number(iso.slice(0, 4));
  const md = iso.slice(5);
  const kid = childrensDay(year);
  if (iso >= addDays(kid, -5) && iso <= kid) {
    const day = Number(kid.slice(8));
    return { key: "child", chip: `🎈 วันเด็กแห่งชาติ ${day} ม.ค. ${String((year + 543) % 100).padStart(2, "0")}` };
  }
  for (const r of YEARLY) {
    const inside = r.from <= r.to ? md >= r.from && md <= r.to : md >= r.from || md <= r.to;
    if (!inside) continue;
    // ปีใหม่ late in December greets the coming year.
    const be = r.key === "newyear" && md >= r.from ? year + 544 : year + 543;
    return { key: r.key, chip: r.chip(be) };
  }
  return null;
}

/** For ?fest=… previews: the chip text without needing the date. */
export function previewFestival(key: FestivalKey): Festival {
  const sample: Record<FestivalKey, string> = {
    loy: "2026-11-24",
    father: "2026-12-05",
    newyear: "2026-12-31",
    child: childrensDay(2027),
    cny: "2027-02-06",
    songkran: "2027-04-13",
    mother: "2027-08-12",
  };
  return festivalFor(sample[key]) ?? { key, chip: "" };
}
