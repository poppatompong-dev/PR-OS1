// โชว์ผลงานในกล่องท้ายแถบล่างของทีวี (owner, 6 Nov 2026): the latest posts of the
// municipality's Facebook page (facebook.com/nsm.go.th, run by this PR team).
// Facebook needs a Page access token made by a page admin (FB_PAGE_ID +
// FB_PAGE_TOKEN in Vercel, set by the owner — never typed by Claude). Until
// then, and whenever Facebook is down, the same photos come from the website's
// ข่าวประชาสัมพันธ์ list (www.nsm.go.th/total_newspr.php). Public content only.

export type ShowcaseItem = { title: string; image: string; date: string; source: "facebook" | "website" };

const CACHE_S = 900;
const TIMEOUT_MS = 8000;
const MAX = 8;
const SITE = "https://www.nsm.go.th/";

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** The first line of a post, trimmed for a small box. */
export function headline(message: string, max = 90): string {
  const first = message.split(/\n+/).map((l) => l.trim()).find((l) => l.replace(/[#\p{Extended_Pictographic}\s]/gu, "").length > 0) ?? "";
  const t = first.replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

type FbPost = { message?: string; full_picture?: string; created_time?: string };

export function fromFacebook(json: unknown): ShowcaseItem[] {
  const data = (json as { data?: FbPost[] } | null)?.data ?? [];
  return data
    .filter((p) => p.full_picture && p.message && headline(p.message))
    .slice(0, MAX)
    .map((p) => ({ title: headline(p.message!), image: p.full_picture!, date: (p.created_time ?? "").slice(0, 10), source: "facebook" as const }));
}

/** www.nsm.go.th/total_newspr.php → newest first. */
export function fromWebsite(html: string): ShowcaseItem[] {
  const out: ShowcaseItem[] = [];
  // The page's own markup: unquoted or single-quoted attributes, one <a> per item.
  const re = /<a[^>]+href=["']?detail_newspr\.php\?id_newspr=(\d+)[\s\S]*?<img[^>]+src=["']?(images_newspr\/[^"'\s>]+)[\s\S]*?<b>([\s\S]*?)<\/b>[\s\S]*?(\d{1,2}\/\d{1,2}\/\d{4})[\s\S]*?<\/a>/g;
  const seen = new Set<string>();
  for (const m of html.matchAll(re)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const title = clean(m[3]);
    if (!title) continue;
    const [d, mo, y] = m[4].split("/").map(Number);
    const iso = `${y - 543}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    out.push({ title: title.length > 90 ? `${title.slice(0, 89)}…` : title, image: SITE + m[2], date: iso, source: "website" });
    if (out.length >= MAX) break;
  }
  return out;
}

async function get(url: string, auth?: string): Promise<Response | null> {
  try {
    const headers: Record<string, string> = { "user-agent": "PR-OS TV (nsm.go.th)" };
    if (auth) headers.authorization = `OAuth ${auth}`;
    const res = await fetch(url, { next: { revalidate: CACHE_S }, signal: AbortSignal.timeout(TIMEOUT_MS), headers });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

export async function showcase(): Promise<ShowcaseItem[]> {
  const page = (process.env.FB_PAGE_ID ?? "").trim();
  const token = (process.env.FB_PAGE_TOKEN ?? "").trim();
  if (page && token) {
    const res = await get(`https://graph.facebook.com/v21.0/${encodeURIComponent(page)}/posts?fields=message,full_picture,created_time&limit=15`, token);
    const items = res ? fromFacebook(await res.json().catch(() => null)) : [];
    if (items.length) return items;
  }
  const site = await get(`${SITE}total_newspr.php`);
  return site ? fromWebsite(await site.text()) : [];
}
