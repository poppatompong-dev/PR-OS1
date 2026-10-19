// Renders public/line/rich-menu.png — the picture behind the LINE bot's
// button panel. The tap areas live in src/lib/line/rich-menu.ts; keep the
// labels and their order here identical to RICH_MENU_BUTTONS there.
//
//   npx -y playwright@1.56.0 install chromium   (once, if not installed)
//   node scripts/render-rich-menu.mjs
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

const BUTTONS = [
  { label: "งานของฉัน", sub: "งาน 7 วัน + ปุ่มรับทราบ", icon: "👤" },
  { label: "งานวันนี้", sub: "ใครไปงานไหน", icon: "📌" },
  { label: "งานพรุ่งนี้", sub: "เตรียมตัวล่วงหน้า", icon: "📅" },
  { label: "ยังไม่รับทราบ", sub: "งานที่ค้างกดรับทราบ", icon: "⏳" },
  { label: "เปิดระบบ PR-OS", sub: "กรอก / แก้งาน / รายงาน", icon: "🌐" },
  { label: "วิธีใช้", sub: "คำสั่งที่บอทตอบได้", icon: "❔" },
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:600;src:url(data:font/woff2;base64,${font(600)}) format("woff2");unicode-range:U+0E01-0E5B,U+200C-200D,U+25CC}
@font-face{font-family:Plex;font-weight:700;src:url(data:font/woff2;base64,${font(700)}) format("woff2");unicode-range:U+0E01-0E5B,U+200C-200D,U+25CC}
@font-face{font-family:Plex;font-weight:600;src:url(data:font/woff2;base64,${latin(600)}) format("woff2")}
@font-face{font-family:Plex;font-weight:700;src:url(data:font/woff2;base64,${latin(700)}) format("woff2")}
html,body{margin:0;width:2500px;height:843px;background:#f3eef6}
.grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);width:2500px;height:843px;gap:0}
.cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
  font-family:Plex,sans-serif;color:#2b1736;border-right:4px solid #e2d6ea;border-bottom:4px solid #e2d6ea;background:#fff}
.cell:nth-child(3n){border-right:0}.cell:nth-child(n+4){border-bottom:0}
.cell:nth-child(1),.cell:nth-child(4){background:#5e2f73;color:#fff}
.icon{font-size:96px;line-height:1}
.label{font-size:84px;font-weight:700;line-height:1.15}
.sub{font-size:44px;font-weight:600;opacity:.75}
</style></head><body><div class="grid">${BUTTONS.map(
  (b) => `<div class="cell"><div class="icon">${b.icon}</div><div class="label">${b.label}</div><div class="sub">${b.sub}</div></div>`,
).join("")}</div></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 2500, height: 843 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
mkdirSync(resolve(root, "public/line"), { recursive: true });
await page.screenshot({ path: resolve(root, "public/line/rich-menu.png"), type: "png" });
await browser.close();
console.log("wrote public/line/rich-menu.png");
