// Bangkok wall-clock and Thai date words for the TV screens. Always resolved
// in Asia/Bangkok, never the display's own zone: a TV stick left on a
// factory-default timezone is common, and a wall clock hours out is worse
// than no clock at all.

export const TH_WEEKDAY_LONG = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
export const TH_WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export const TH_MONTH_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const TH_MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function bangkokNow(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "00";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  const hh = get("hour") === "24" ? "00" : get("hour");
  return { iso, hh, mm: get("minute"), ss: get("second"), minutes: Number(hh) * 60 + Number(get("minute")) };
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function isoParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, weekday: new Date(`${iso}T00:00:00Z`).getUTCDay() };
}

/** "วันอังคารที่ 28 ตุลาคม 2569" */
export function thaiLongDate(iso: string): string {
  const { y, m, d, weekday } = isoParts(iso);
  return `${TH_WEEKDAY_LONG[weekday]}ที่ ${d} ${TH_MONTH_LONG[m - 1]} ${y + 543}`;
}

/** "วันนี้ 13:30", "พรุ่งนี้ 09:30", "พฤ. 30 ต.ค. 09:30" */
export function whenLabel(iso: string, time: string, today: string): string {
  if (iso === today) return `วันนี้ ${time}`;
  if (iso === addDaysIso(today, 1)) return `พรุ่งนี้ ${time}`;
  const p = isoParts(iso);
  return `${TH_WEEKDAY_SHORT[p.weekday]} ${p.d} ${TH_MONTH_SHORT[p.m - 1]} ${time}`;
}
