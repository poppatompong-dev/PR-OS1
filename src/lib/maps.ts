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

// ---------------------------------------------------------------------------
// หลายจุด (owner, 3 Nov 2026: "พี่เอิร์ธปักหมุดได้มากกว่าหนึ่งจุด" · ลากหมุดได้อิสระ).
// Kept in events.metadata.map_points; metadata.map_url stays = the first point
// so anything that read the single link keeps working.

export const MAX_MAP_POINTS = 5;

/** A pin on the map (lat/lng) or a pasted maps link (url). */
export type MapPoint = { label: string; lat?: number; lng?: number; url?: string };

const cleanLabel = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 40) : "");
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export type PointsCheck = { ok: true; points: MapPoint[] } | { ok: false; error: string };

/** The form's list of points (array or JSON text) → clean points; a lone mapUrl is one point. */
export function parseMapPoints(raw: unknown, legacyUrl?: unknown): PointsCheck {
  let list: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) list = [];
    else {
      try {
        list = JSON.parse(t);
      } catch {
        return { ok: false, error: "ข้อมูลพิกัดไม่ถูกต้อง" };
      }
    }
  }
  if (list == null) list = [];
  if (!Array.isArray(list)) return { ok: false, error: "ข้อมูลพิกัดไม่ถูกต้อง" };
  const points: MapPoint[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = cleanLabel(o.label);
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (o.lat != null && o.lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "พิกัดไม่ถูกต้อง" };
      points.push({ label, lat: round6(lat), lng: round6(lng) });
    } else if (typeof o.url === "string" && o.url.trim()) {
      const m = normalizeMapInput(o.url);
      if (!m.ok) return m;
      if (m.url) points.push(coordPoint(m.url, label) ?? { label, url: m.url });
    }
  }
  if (!points.length && legacyUrl != null) {
    const m = normalizeMapInput(legacyUrl);
    if (!m.ok) return m;
    if (m.url) points.push(coordPoint(m.url, "") ?? { label: "", url: m.url });
  }
  if (points.length > MAX_MAP_POINTS) return { ok: false, error: `ปักหมุดได้ไม่เกิน ${MAX_MAP_POINTS} จุด` };
  return { ok: true, points };
}

/** A "?query=lat,lng" link we made ourselves → a draggable pin again. */
function coordPoint(url: string, label: string): MapPoint | null {
  try {
    const q = new URL(url).searchParams.get("query");
    const c = q?.match(COORD);
    if (c) return { label, lat: Number(c[1]), lng: Number(c[2]) };
  } catch {
    /* not ours */
  }
  return null;
}

/** Points saved on a job (map_points, else the single map_url). */
export function pointsFromMetadata(meta: unknown): MapPoint[] {
  const m = (meta ?? {}) as { map_points?: unknown; map_url?: unknown };
  const r = parseMapPoints(Array.isArray(m.map_points) ? m.map_points : [], typeof m.map_url === "string" ? m.map_url : undefined);
  return r.ok ? r.points : [];
}

/** What goes into events.metadata for these points. */
export function mapMetadata(points: MapPoint[]): { map_points: MapPoint[]; map_url: string | null } {
  return { map_points: points, map_url: points.length ? pointLink(points[0]) : null };
}

/** The link that shows the point. */
export function pointLink(p: MapPoint): string {
  return p.lat != null && p.lng != null ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : (p.url ?? "");
}

/** Directions to the point. */
export function pointNavUrl(p: MapPoint): string {
  return navigateUrl(pointLink(p));
}

/** "เวที" or "จุดที่ 2"; a single unnamed point is just "นำทาง". */
export function pointName(p: MapPoint, i: number, total: number): string {
  return p.label || (total > 1 ? `จุดที่ ${i + 1}` : "");
}

/** The button text on a card, short enough for LINE (20 chars). */
export function pointButton(p: MapPoint, i: number, total: number): string {
  const name = pointName(p, i, total);
  return name ? `🧭 ${[...name].slice(0, 16).join("")}` : "🧭 นำทาง";
}
