// พิกัดงาน (พี่เอิร์ธ 3 Nov 2026): the form takes a Google Maps link or
// "lat, lng"; cards get a 🧭 นำทาง button that opens directions on the phone.
// Only map links are kept — anything else is refused so a card never carries
// a stranger's link.

const COORD = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const HOSTS = ["maps.app.goo.gl", "goo.gl", "maps.google.com", "www.google.com", "google.com", "www.google.co.th", "google.co.th", "waze.com", "www.waze.com", "ul.waze.com"];

export type MapCheck = { ok: true; url: string | null } | { ok: false; error: string };

/** "15.70, 100.12" or a maps link → a stored link; empty → null. */
export function normalizeMapInput(raw: unknown): MapCheck {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return { ok: true, url: null };
  const c = v.match(COORD);
  if (c) {
    const lat = Number(c[1]);
    const lng = Number(c[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "พิกัดไม่ถูกต้อง" };
    return { ok: true, url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` };
  }
  // A link pasted from the share sheet often comes with text around it.
  const m = v.match(/https?:\/\/\S+/);
  if (!m) return { ok: false, error: 'ช่องพิกัด: วางลิงก์ Google Maps หรือพิมพ์พิกัด เช่น "15.70, 100.13"' };
  let u: URL;
  try {
    u = new URL(m[0].replace(/[),.;]+$/, ""));
  } catch {
    return { ok: false, error: "ลิงก์แผนที่ไม่ถูกต้อง" };
  }
  const host = u.hostname.toLowerCase();
  const isMaps = HOSTS.includes(host) && (host.includes("goo.gl") || host.includes("waze") || host.startsWith("maps.") || u.pathname.startsWith("/maps"));
  if (!isMaps) return { ok: false, error: "ช่องพิกัด: ใช้ได้เฉพาะลิงก์ Google Maps หรือ Waze" };
  u.protocol = "https:";
  return { ok: true, url: u.toString().slice(0, 500) };
}

/** The link a phone should open to drive there. */
export function navigateUrl(mapUrl: string): string {
  try {
    const u = new URL(mapUrl);
    const q = u.searchParams.get("query");
    if (u.hostname === "www.google.com" && u.pathname === "/maps/search/" && q && COORD.test(q)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
    }
  } catch {
    /* keep the link as it is */
  }
  return mapUrl;
}
