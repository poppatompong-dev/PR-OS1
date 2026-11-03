// TV ticker filler (owner, 3 Nov 2026: "ให้ขึ้นข่าวสารที่เป็นประโยชน์ เช่น
// ราคาทองวันนี้ ราคาน้ำมันวันนี้ ดีกว่าเป็นตัววิ่งเปล่า ๆ"). Runs after the
// team's own lines (ประกาศ / ยกเลิก / เปลี่ยน). Server-side only, cached:
//   🥇 gold   — สมาคมค้าทองคำ price via api.chnwt.dev (unofficial mirror)
//   ⛽ oil    — Bangchak's public price feed (owner's choice)
//   📰 news   — Thai PBS RSS, only เศรษฐกิจ / สังคม / ต่างประเทศ, no politics
//               or crime, no death/violence words: an office TV, not a newsroom
// Any source that fails is simply left out; the ticker never shows an error.

const TIMEOUT_MS = 6000;
const CACHE_S = 30 * 60;

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: CACHE_S }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// ---------- gold ----------

type GoldJson = { status?: string; response?: { update_time?: string; price?: { gold_bar?: { buy?: string; sell?: string } } } };

export function goldLine(j: GoldJson | null): string | null {
  const bar = j?.response?.price?.gold_bar;
  if (j?.status !== "success" || !bar?.sell || !bar?.buy) return null;
  const at = (j.response?.update_time ?? "").replace(/^เวลา\s*/, "").replace(/\s*\(.*\)\s*$/, "");
  return `🥇 ทองคำแท่ง ขายออก ${bar.sell} · รับซื้อ ${bar.buy} บาท${at ? ` (สมาคมค้าทองคำ ${at})` : ""}`;
}

// ---------- oil ----------

type Oil = { OilName: string; PriceToday: number; PriceTomorrow: number };
const OIL_PICK: Array<[RegExp, string]> = [
  [/^ไฮดีเซล S$/, "ดีเซล"],
  [/^แก๊สโซฮอล์ 95/, "แก๊สโซฮอล์ 95"],
  [/^แก๊สโซฮอล์ 91/, "แก๊สโซฮอล์ 91"],
  [/^แก๊สโซฮอล์ E20/, "E20"],
];

export function oilLine(raw: unknown): string | null {
  const first = Array.isArray(raw) ? (raw[0] as { OilList?: string } | undefined) : undefined;
  if (!first?.OilList) return null;
  let list: Oil[];
  try {
    list = JSON.parse(first.OilList) as Oil[];
  } catch {
    return null;
  }
  const parts: string[] = [];
  let move = "";
  for (const [re, label] of OIL_PICK) {
    const o = list.find((x) => re.test(x.OilName.trim()));
    if (!o || !Number.isFinite(o.PriceToday)) continue;
    parts.push(`${label} ${o.PriceToday.toFixed(2)}`);
    const d = Number(o.PriceTomorrow) - o.PriceToday;
    if (!move && Number.isFinite(d) && Math.abs(d) >= 0.01) move = ` · พรุ่งนี้${d > 0 ? "ขึ้น" : "ลง"} ${Math.abs(d).toFixed(2)} บาท`;
  }
  return parts.length ? `⛽ น้ำมันวันนี้ (บางจาก) ${parts.join(" · ")} บาท/ลิตร${move}` : null;
}

// ---------- news ----------

const NEWS_CATEGORIES = new Set(["เศรษฐกิจ", "สังคม", "ต่างประเทศ"]);
const NEWS_AVOID = /เสียชีวิต|ศพ|ฆ่า|ยิง|แทง|ข่มขืน|ระเบิด|สงคราม|โจมตี|บาดเจ็บ|อุบัติเหตุ|ฆาตกร|ทักษิณ|พรรค|นายกฯ|รัฐบาล|ฝ่ายค้าน|เลือกตั้ง|สภาฯ|ส\.ส\.|ม็อบ|ชุมนุม/;
const NEWS_MAX = 5;
const NEWS_MAX_AGE_H = 36;

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  return m[1]
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function newsLines(xml: string | null, now = Date.now()): string[] {
  if (!xml) return [];
  const out: string[] = [];
  for (const block of xml.split(/<item[\s>]/).slice(1)) {
    const title = tag(block, "title");
    const cat = tag(block, "category");
    const when = Date.parse(tag(block, "pubDate"));
    if (!title || !NEWS_CATEGORIES.has(cat) || NEWS_AVOID.test(title)) continue;
    if (Number.isFinite(when) && now - when > NEWS_MAX_AGE_H * 3600_000) continue;
    out.push(`📰 ${title.replace(/\s{2,}/g, " ")}`);
    if (out.length >= NEWS_MAX) break;
  }
  if (out.length) out[out.length - 1] += " (Thai PBS)";
  return out;
}

/** Gold, oil, then up to 5 headlines. Empty when every source is down. */
export async function worldFeed(): Promise<string[]> {
  const [gold, oil, news] = await Promise.all([
    getText("https://api.chnwt.dev/thai-gold-api/latest"),
    getText("https://oil-price.bangchak.co.th/ApiOilPrice2/th"),
    getText("https://news.thaipbs.or.th/rss/news"),
  ]);
  const json = (t: string | null) => {
    try {
      return t ? JSON.parse(t) : null;
    } catch {
      return null;
    }
  };
  return [goldLine(json(gold)), oilLine(json(oil)), ...newsLines(news)].filter((x): x is string => Boolean(x));
}
