// Renders public/line/rich-menu.png — the picture behind the LINE bot's
// button panel. The tap areas live in src/lib/line/rich-menu.ts; keep the
// labels, their order and the layout numbers (BAND, ROW1) identical there.
//
//   npx -y playwright@1.56.0 install chromium   (once, if not installed)
//   node scripts/render-rich-menu.mjs
//
// Menu A (owner, 21 Oct 2026): left column "ของฉัน" in purple, the other two
// columns "ของทีม" in white, with the zone names in a strip across the top.
//
// Uses the app's own Thai font (IBM Plex Sans Thai from node_modules) so
// vowels and tone marks render properly — a server-side image library with
// no Thai shaping puts them in the wrong place.

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const font = (w) =>
  readFileSync(resolve(root, `node_modules/@fontsource/ibm-plex-sans-thai/files/ibm-plex-sans-thai-thai-${w}-normal.woff2`)).toString("base64");
const latin = (w) =>
  readFileSync(resolve(root, `node_modules/@fontsource/ibm-plex-sans-thai/files/ibm-plex-sans-thai-latin-${w}-normal.woff2`)).toString("base64");

const W = 2500;
const H = 843;
const BAND = 110; // = RICH_MENU_BAND
const ROW1 = BAND + Math.floor((H - BAND) / 2); // top row of tap areas ends here
const COL = Math.floor(W / 3);

// Row by row, left to right — same order as RICH_MENU_BUTTONS.
const BUTTONS = [
  { label: "งานของฉัน", sub: "รับทราบ / ไม่สะดวก", icon: "👤", mine: true },
  { label: "ทีมวันนี้", sub: "ใครไปงานไหน", icon: "📌" },
  { label: "ทีมพรุ่งนี้", sub: "เตรียมตัวล่วงหน้า", icon: "📅" },
  { label: "เพิ่มงาน", sub: "กรอกงานใหม่ในไลน์", icon: "➕", mine: true },
  { label: "ใครยังไม่รับทราบ", sub: "ทั้งทีม 7 วันข้างหน้า", icon: "⏳" },
  { label: "วิธีใช้", sub: "อ่าน 1 นาที", icon: "❔" },
];

const cell = (b, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = col * COL;
  const w = col === 2 ? W - x : COL;
  const y = row === 0 ? BAND : ROW1;
  const h = row === 0 ? ROW1 - BAND : H - ROW1;
  return `<div class="cell${b.mine ? " mine" : ""}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <div class="icon">${b.icon}</div><div class="label">${b.label}</div><div class="sub">${b.sub}</div></div>`;
};

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:600;src:url(data:font/woff2;base64,${font(600)}) format("woff2");unicode-range:U+0E01-0E5B,U+200C-200D,U+25CC}
@font-face{font-family:Plex;font-weight:700;src:url(data:font/woff2;base64,${font(700)}) format("woff2");unicode-range:U+0E01-0E5B,U+200C-200D,U+25CC}
@font-face{font-family:Plex;font-weight:600;src:url(data:font/woff2;base64,${latin(600)}) format("woff2")}
@font-face{font-family:Plex;font-weight:700;src:url(data:font/woff2;base64,${latin(700)}) format("woff2")}
html,body{margin:0;width:${W}px;height:${H}px;background:#e2d6ea;position:relative;overflow:hidden;font-family:Plex,sans-serif}
.zone{position:absolute;top:0;height:${BAND}px;display:flex;align-items:center;justify-content:center;gap:18px;
  font-size:58px;font-weight:700;letter-spacing:1px}
.zone.mine{left:0;width:${COL}px;background:#3f1d4f;color:#fff}
.zone.team{left:${COL}px;width:${W - COL}px;background:#efe7f4;color:#5e2f73;border-left:6px solid #e2d6ea}
.cell{position:absolute;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  color:#2b1736;background:#fff;border-right:4px solid #e2d6ea;border-bottom:4px solid #e2d6ea}
.cell.mine{background:#5e2f73;color:#fff;border-right:6px solid #3f1d4f;border-bottom-color:#4b2560}
.icon{font-size:84px;line-height:1}
.label{font-size:80px;font-weight:700;line-height:1.15}
.sub{font-size:42px;font-weight:600;opacity:.78}
</style></head><body>
<div class="zone mine">👤 ของฉัน</div><div class="zone team">👥 ของทีม — ดูภาพรวมทั้งทีม</div>
${BUTTONS.map(cell).join("")}
</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
mkdirSync(resolve(root, "public/line"), { recursive: true });
await page.screenshot({ path: resolve(root, process.env.OUT ?? "public/line/rich-menu.png"), type: "png" });
await browser.close();
console.log("wrote", process.env.OUT ?? "public/line/rich-menu.png");
