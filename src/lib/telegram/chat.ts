// คุยกับบอทแบบพูดธรรมดา (owner, 5 Nov 2026: "อยากให้บอทเทเลแกรมสื่อสารกับน้อง ๆ และ
// ให้คำแนะนำส่วนตัว" — chose keyword answers: free, nothing leaves the system).
// Pure functions: what someone typed → which intent → the reply text. The webhook
// loads the person's work and calls these. No AI, no outside service.

import type { TaskItem } from "@/lib/line/data";
import { esc } from "@/lib/telegram/api";
import { shortName } from "@/lib/names";
import { formatThaiDate } from "@/lib/format";

// ---- what the bot calls each person --------------------------------------------
// พรินเซสแป้ง (owner, 5 Nov 2026 — ราชบัณฑิตฯ spelling). Others via "ขอลุค" later.
export const PANG_ID = "00000000-0000-0000-0000-000000000505";
const TITLES: Record<string, string> = { [PANG_ID]: "พรินเซสแป้ง 👑" };
const NICK: Record<string, string> = {
  "00000000-0000-0000-0000-000000000501": "พี่ไป๋",
  "00000000-0000-0000-0000-000000000502": "พี่เอิร์ธ",
  "00000000-0000-0000-0000-000000000503": "กุ๊ก",
  "00000000-0000-0000-0000-000000000504": "นัท",
  "00000000-0000-0000-0000-000000000506": "แข",
  "dd5a7eb4-d62a-45bc-b11b-33dae93d6b49": "ภัส",
  "1b378ad3-73a3-461c-985e-b1d52189dbee": "พี่เอ๋",
};
export function titleFor(personId: string, displayName: string): string {
  return TITLES[personId] ?? NICK[personId] ?? `คุณ${shortName(displayName)}`;
}

// ---- โหมดแม่ (owner, 5–6 Nov 2026: "บอทคุณแม่" — the affectionate แม่/ลูก talk of
// Thai LGBTQ+ slang). Medium level, chat replies only: job cards, the 07:00
// summary and every date/time/place stay plain. Women on the team only, never
// พี่ไป๋ (senior — always polite) and never the men (owner, 6 Nov 2026). A new
// woman on the team gets it once her id is added to MOM_IDS. Anyone in the list
// can say "ปิดโหมดแม่" (people.metadata.mom = "off").
export const PAI_ID = "00000000-0000-0000-0000-000000000501";
export const MOM_IDS = new Set([
  "00000000-0000-0000-0000-000000000504", // นัท
  PANG_ID, // พรินเซสแป้ง
  "00000000-0000-0000-0000-000000000506", // แข
  "dd5a7eb4-d62a-45bc-b11b-33dae93d6b49", // ภัส
]);
export function momOn(personId: string, metadata: Record<string, unknown> | null | undefined): boolean {
  if (!MOM_IDS.has(personId)) return false;
  return metadata?.mom !== "off";
}
/** How แม่ calls you: ลูก + nickname (no "พี่" — ลูกพี่ means boss). */
export function momAddr(personId: string, displayName: string): string {
  if (personId === PANG_ID) return "พรินเซสแป้งของแม่";
  return `ลูก${(NICK[personId] ?? shortName(displayName)).replace(/^พี่/, "")}`;
}

// ---- intents -----------------------------------------------------------------------
export type Intent =
  | "my_today" | "my_tomorrow" | "my_week" | "my_next" | "who_with"
  | "tip"
  | "how_attach" | "how_avatar" | "how_unavailable" | "how_joke" | "how_add" | "what_can"
  | "look" | "idea" | "mom_on" | "mom_off"
  | "hello" | "thanks" | "tired" | "hungry" | "bored" | "praise" | "love";

const norm = (s: string) => s.replace(/\s+/g, "").replace(/[?？!！.。~ๆ]+/g, "").toLowerCase();

/** Order matters: the more specific wish wins. Returns null when nothing fits. */
export function matchIntent(raw: string): Intent | null {
  const t = norm(raw);
  if (!t) return null;
  if (/^(ปิด|หยุด|เลิก)โหมดแม่/.test(t)) return "mom_off";
  if (/^(เปิด|ขอ)โหมดแม่/.test(t)) return "mom_on";
  if (/^(ขอลุค|ขอฉายา|อยากได้ลุค|เปลี่ยนลุค)/.test(t)) return "look";
  if (/^(ไอเดีย|เสนอแก็ก|ไอเดียแก็ก|อยากให้มีแก็ก|ขอแก็ก)/.test(t)) return "idea";
  if (/(เปลี่ยนรูป|รูปการ์ตูน|เปลี่ยนการ์ตูน|รูปบนจอ|รูปไม่สวย|ทำรูปใหม่)/.test(t)) return "how_avatar";
  if (/(แนบ(ไฟล์|รูป|เอกสาร|pdf)|ไฟล์แนบ|ส่งไฟล์|อัปโหลด|อัพโหลด)/.test(t)) return "how_attach";
  if (/(ไม่สะดวก|ไปไม่ได้|ติดธุระ|ขอลา|ลาป่วย|ไม่ว่างวันนั้น|แลกงาน|หาคนแทน)/.test(t)) return "how_unavailable";
  if (/(ส่งมุก|มุกยังไง|เล่ามุก|ตู้มุก)/.test(t)) return "how_joke";
  if (/(วิธีเพิ่มงาน|เพิ่มงานยังไง|ลงงานยังไง|สร้างงานยังไง)/.test(t)) return "how_add";
  if (/(ทำอะไรได้|ช่วยอะไรได้|บอททำอะไร|ใช้ยังไง|คำสั่ง|เมนู|ถามอะไรได้)/.test(t)) return "what_can";
  if (/(ทิป|เคล็ดลับ|ต้องเตรียม|เตรียมอะไร|เตรียมตัว|แนะนำหน่อย|ควรเตรียม)/.test(t)) return "tip";
  if (/(ใครไปด้วย|ไปกับใคร|ใครอยู่ด้วย|ใครบ้าง|ทีมมีใคร|คู่กับใคร)/.test(t)) return "who_with";
  if (/(งานถัดไป|งานต่อไป|งานหน้า|ต้องไปกี่โมง|กี่โมง|ไปที่ไหน|ที่ไหน)/.test(t)) return "my_next";
  if (/พรุ่งนี้/.test(t)) return "my_tomorrow";
  if (/(สัปดาห์นี้|อาทิตย์นี้|วีคนี้|ว่างไหม|ว่างมั้ย|ว่างมั๊ย|ว่างป่าว|เสาร์อาทิตย์|วันหยุด)/.test(t)) return "my_week";
  if (/(วันนี้มี|วันนี้ต้อง|วันนี้งาน|งานวันนี้ของฉัน|วันนี้ไป)/.test(t)) return "my_today";
  if (/(ขอบคุณ|ขอบใจ|thank|thx|แต๊งกิ้ว)/.test(t)) return "thanks";
  if (/(เหนื่อย|ง่วง|เพลีย|ล้า|หมดแรง|เครียด)/.test(t)) return "tired";
  if (/(หิว|กินอะไรดี|ข้าว)/.test(t)) return "hungry";
  if (/(เบื่อ|เซ็ง|ไม่มีอะไรทำ)/.test(t)) return "bored";
  if (/(เก่งมาก|เก่งจัง|น่ารัก|เจ๋ง|สุดยอด)/.test(t)) return "praise";
  if (/(รักบอท|ชอบบอท|รักนะ|คิดถึง)/.test(t)) return "love";
  if (/^(สวัสดี|หวัดดี|ดีจ้า|ดีค่ะ|ดีครับ|hello|hi|ฮัลโหล|อรุณสวัสดิ์|ทัก)/.test(t)) return "hello";
  return null;
}

// ---- role tips ---------------------------------------------------------------------
export type RoleKey = "photo" | "video" | "mc" | "live" | "writer" | "coord" | "driver";

export const ROLE_TIPS: Record<RoleKey, { label: string; tips: string[] }> = {
  photo: {
    label: "📷 ภาพนิ่ง",
    tips: [
      "ชาร์จแบตให้เต็ม + พกแบตสำรอง และเคลียร์การ์ดให้ว่างก่อนออก",
      "ไปถึงก่อน 15 นาที ดูมุมเวทีกับทิศแสง จองจุดยืนไว้",
      "ช็อตที่ขาดไม่ได้: ป้ายชื่องาน · ประธานกล่าว · ภาพหมู่ · บรรยากาศผู้ร่วมงาน",
      "ภาพหมู่ถ่ายรัว 3–5 ช็อต กันคนหลับตา",
      "เลือกภาพเด็ด 5–10 รูปส่งทีมภายใน 1 ชม. หลังจบงาน",
    ],
  },
  video: {
    label: "🎥 ภาพวิดีโอ",
    tips: [
      "เช็กไมค์/เสียงก่อนเริ่ม เสียงแย่แก้ทีหลังยากกว่าภาพ",
      "ถ่าย B-roll บรรยากาศไว้ก่อนพิธีเริ่ม คลิปละ 10–15 วินาที",
      "ใช้ขาตั้งหรือกันสั่นทุกครั้งที่ถ่ายช่วงกล่าว",
      "ถ้าจะทำคลิปสั้นลงโซเชียล ถ่ายแนวตั้งเผื่อไว้ด้วย",
    ],
  },
  mc: {
    label: "🎤 พิธีกร",
    tips: [
      "ขอกำหนดการฉบับล่าสุด และซ้อมอ่านชื่อ-ตำแหน่งผู้บริหารให้คล่อง",
      "ทดสอบไมค์และถามช่างเสียงว่าใครคุมเพลงเปิด-ปิด",
      "ยืนยันกับผู้กล่าวรายงานก่อนเริ่มว่าใครขึ้นก่อน-หลัง",
      "พกน้ำเปล่า และสคริปต์สำรองเผื่อกำหนดการเปลี่ยนหน้างาน",
    ],
  },
  live: {
    label: "📡 ถ่ายทอดสด",
    tips: [
      "ทดลองสตรีมก่อนเริ่ม 10 นาที และเตรียมเน็ตสำรอง (ซิมอีกเครือข่าย)",
      "เสียบไฟ/พาวเวอร์แบงก์ตลอดไลฟ์ อย่าพึ่งแบตเครื่องอย่างเดียว",
      "ตั้งชื่อไลฟ์ + ภาพปกให้ชัดว่าเป็นงานอะไร ที่ไหน",
    ],
  },
  writer: {
    label: "📝 ทำข่าว",
    tips: [
      "ขอกำหนดการและคำกล่าวรายงานไว้ก่อน ช่วยให้เขียนข่าวเร็วขึ้น",
      "จดชื่อ-ตำแหน่งให้ถูกตั้งแต่หน้างาน (สะกดผิดแก้ยากที่สุด)",
      "ใช้ 5W1H: ใคร ทำอะไร ที่ไหน เมื่อไร ทำไม อย่างไร",
    ],
  },
  coord: {
    label: "🤝 ประสานงาน",
    tips: [
      "เก็บเบอร์ผู้ประสานหน้างานไว้ 1 คน",
      "ยืนยันเวลา/สถานที่อีกครั้งเช้าวันงาน",
      "เช็กว่าผู้บริหารคนไหนมา จะได้บอกช่างภาพกับพิธีกรทัน",
    ],
  },
  driver: {
    label: "🚐 ยานพาหนะ",
    tips: ["เช็กน้ำมันและจุดจอดรถก่อนวันงาน", "นัดเวลาออกให้ถึงก่อนเริ่มงาน 20 นาที"],
  },
};

export function roleKey(roleName: string): RoleKey | null {
  const r = roleName.toLowerCase();
  if (/ถ่ายทอดสด|live|ไลฟ์/.test(r)) return "live";
  if (/วิดีโอ|วีดีโอ|video/.test(r)) return "video";
  if (/ภาพนิ่ง|ถ่ายภาพ|ช่างภาพ|photo/.test(r)) return "photo";
  if (/พิธีกร|mc/.test(r)) return "mc";
  if (/ข่าว|writer/.test(r)) return "writer";
  if (/ประสาน|coord/.test(r)) return "coord";
  if (/ยานพาหนะ|พลขับ|driver/.test(r)) return "driver";
  return null;
}

/** The role keys named in a message ("ทิปพิธีกร"), else none. */
export function rolesIn(raw: string): RoleKey[] {
  const t = norm(raw);
  const out: RoleKey[] = [];
  if (/ไลฟ์|ถ่ายทอดสด|live/.test(t)) out.push("live");
  if (/วิดีโอ|วีดีโอ|video/.test(t)) out.push("video");
  if (/ถ่ายรูป|ภาพนิ่ง|ช่างภาพ|กล้อง|photo/.test(t)) out.push("photo");
  if (/พิธีกร|mc/.test(t)) out.push("mc");
  if (/ข่าว/.test(t)) out.push("writer");
  if (/ประสาน/.test(t)) out.push("coord");
  return out;
}

/** Same tip for the same day + role, so a re-read does not flip it. */
export function dailyTip(key: RoleKey, isoDay: string): string {
  const list = ROLE_TIPS[key].tips;
  const n = [...isoDay].reduce((a, c) => a + c.charCodeAt(0), 0);
  return list[n % list.length];
}

export function tipText(keys: RoleKey[]): string {
  if (!keys.length) {
    return [
      "💡 <b>ทิปตามบทบาท</b> — พิมพ์ชื่อบทบาทต่อท้ายได้เลย",
      "เช่น <code>ทิปถ่ายรูป</code> · <code>ทิปวิดีโอ</code> · <code>ทิปพิธีกร</code> · <code>ทิปไลฟ์</code> · <code>ทิปทำข่าว</code>",
    ].join("\n");
  }
  return keys
    .map((k) => [`💡 <b>${ROLE_TIPS[k].label}</b>`, ...ROLE_TIPS[k].tips.map((x) => `• ${esc(x)}`)].join("\n"))
    .join("\n\n");
}

// ---- my work in plain words --------------------------------------------------------
const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const dayName = (iso: string) => TH_DAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const timeRange = (t: TaskItem) => (t.event.endTime ? `${t.event.startTime}–${t.event.endTime}` : t.event.startTime) + " น.";
const line = (t: TaskItem, withDay = false) =>
  `• ${withDay ? `${formatThaiDate(t.event.eventDate)} · ` : ""}${timeRange(t)} <b>${esc(t.event.title)}</b>` +
  `\n   📍 ${esc(t.event.locationName)} · ${esc(t.roleName)}${t.acknowledged ? "" : " · ⏳ ยังไม่กดรับทราบ"}`;

export function myDayText(title: string, label: "วันนี้" | "พรุ่งนี้", tasks: TaskItem[], mom = false): string {
  const who = esc(title);
  if (!tasks.length) {
    if (mom) return label === "วันนี้" ? `🌤 วันนี้${who}ไม่มีงานค่ะ พักผ่อนให้สวย ๆ นะคะ 💅` : `🌙 พรุ่งนี้${who}ว่างจ้า นอนเอาแรงให้เต็มที่นะคะ ✨`;
    return label === "วันนี้" ? `🌤 ${who} วันนี้ไม่มีงานนะ พักผ่อนบ้างน้า` : `🌙 ${who} พรุ่งนี้ว่างจ้า ไม่มีงานในระบบ`;
  }
  const tip = roleKey(tasks[0].roleName);
  return [
    mom ? `📋 ${label}${who}มี ${tasks.length} งานนะคะ แม่จดไว้ให้แล้ว 💅` : `📋 ${who} ${label}มี ${tasks.length} งาน`,
    ...tasks.map((t) => line(t)),
    tip ? `\n💡 ${mom ? "แม่ฝากทิป: " : ""}${esc(dailyTip(tip, tasks[0].event.eventDate))}` : "",
  ].filter(Boolean).join("\n");
}

export function myWeekText(title: string, from: string, tasks: TaskItem[], mom = false): string {
  const who = esc(title);
  if (!tasks.length) return mom ? `🏖 7 วันนี้${who}ว่างทั้งหมดเลยค่ะ ปังมาก ✨` : `🏖 ${who} 7 วันข้างหน้ายังว่างทั้งหมด`;
  const busy = new Set(tasks.map((t) => t.event.eventDate));
  const free: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (!busy.has(iso)) free.push(dayName(iso));
  }
  return [
    mom ? `🗓 7 วันนี้${who}มี ${tasks.length} งานค่ะ` : `🗓 ${who} 7 วันข้างหน้ามี ${tasks.length} งาน`,
    ...tasks.slice(0, 10).map((t) => line(t, true)),
    free.length ? `\n✅ วันว่าง: ${free.join(" · ")}` : mom ? "\n🔥 ไม่มีวันว่างเลยลูก แม่ส่งกำลังใจ ✊💜" : "\n🔥 ไม่มีวันว่างเลย สู้ ๆ นะ",
  ].join("\n");
}

export function nextJobText(title: string, next: TaskItem | null, mom = false): string {
  const who = esc(title);
  if (!next) return mom ? `🎉 ${who}ยังไม่มีงานถัดไปเลยค่ะ เริ่ดดด ✨` : `🎉 ${who} ยังไม่มีงานถัดไปใน 30 วันนี้`;
  const tip = roleKey(next.roleName);
  return [
    mom ? `⏭ งานถัดไปของ${who}นะคะ อย่าตื่นสายน้า 💅` : `⏭ งานถัดไปของ${who}`,
    line(next, true),
    tip ? `\n💡 ${mom ? "แม่ฝากทิป: " : ""}${esc(dailyTip(tip, next.event.eventDate))}` : "",
  ].filter(Boolean).join("\n");
}

export function whoWithText(title: string, next: TaskItem | null, team: TaskItem[], mom = false): string {
  const who = esc(title);
  if (!next) return mom ? `🙂 ${who}ยังไม่มีงานถัดไปเลยค่ะ` : `🙂 ${who} ยังไม่มีงานถัดไปให้ดูว่าใครไปด้วย`;
  const others = team.filter((t) => t.event.id === next.event.id && t.personId !== next.personId);
  return [
    `👥 <b>${esc(next.event.title)}</b> · ${formatThaiDate(next.event.eventDate)} ${timeRange(next)}`,
    others.length
      ? others.map((t) => `• ${esc(titleFor(t.personId, t.personName))} — ${esc(t.roleName)}`).join("\n")
      : mom ? "• งานนี้ไปเดี่ยวค่ะลูก ชีเสิร์ฟคนเดียวก็ปังได้ 💪✨" : "• ไปคนเดียวงานนี้ สู้ ๆ 💪",
  ].join("\n");
}

// ---- how-to + small talk -----------------------------------------------------------
export const HOW: Record<"how_attach" | "how_avatar" | "how_unavailable" | "how_joke" | "how_add", string> = {
  how_attach: [
    "📎 <b>แนบไฟล์ (กำหนดการ รูป PDF)</b>",
    "1️⃣ กดปุ่ม <b>งาน</b> ซ้ายล่าง → ➕ เพิ่มงาน (หรือ ✏️ แก้งานเดิม)",
    "2️⃣ เลื่อนลงถึงช่อง 📎 → แตะเลือกไฟล์ (ได้หลายไฟล์)",
    "3️⃣ รอขึ้น ✓ ครบทุกไฟล์ แล้วกดบันทึก",
    "👀 ดูไฟล์ที่แนบ: กด 📎 บนการ์ดงานได้เลย ไม่ต้องล็อกอิน",
  ].join("\n"),
  how_avatar: [
    "🖼 <b>เปลี่ยนรูปการ์ตูนบนจอ</b>",
    "1️⃣ กดปุ่ม <b>🖼 เปลี่ยนรูป</b> ด้านล่าง",
    "2️⃣ กด 📷 ส่งรูปให้ทำใหม่ → ส่งรูปหน้าตรง ชัด 1 รูป",
    "3️⃣ แอดมินวาดให้ภายใน 1–2 วันทำการ เสร็จแล้วแจ้งกลับ",
    "✨ อยากได้ลุคพิเศษ/ฉายา พิมพ์ <b>ขอลุค</b>",
  ].join("\n"),
  how_unavailable: [
    "⛔ <b>ไปงานไม่ได้</b>",
    "กด <b>⛔ ไม่สะดวก</b> ใต้การ์ดงานนั้น → เลือกเหตุผล",
    "แอดมินจะได้แจ้งทันทีเพื่อหาคนแทน (งานยังอยู่ในชื่อเราจนกว่าแอดมินเปลี่ยน)",
    "ไม่เจอการ์ด? พิมพ์ <b>งานของฉัน</b>",
  ].join("\n"),
  how_joke: [
    "😂 <b>ส่งมุกขึ้นจอทีวี</b>",
    "พิมพ์ <code>มุก คำถาม | คำตอบ</code> เช่น",
    "<code>มุก ประชุมสั้น ๆ 5 นาที | ของจริง 2 ชั่วโมง</code>",
    "แอดมินกดอนุมัติ → ตัวการ์ตูนของเราเล่าบนจอ 📺",
  ].join("\n"),
  how_add: [
    "➕ <b>เพิ่มงาน</b>",
    "กดปุ่ม <b>งาน</b> ซ้ายล่าง → ➕ เพิ่มงาน → กรอกชื่อ วัน เวลา สถานที่ คนไป → บันทึก",
    "คนที่ถูกใส่ชื่อจะได้การ์ดงานทันที",
  ].join("\n"),
};

export function whatCanText(title: string, mom = false): string {
  return [
    mom ? `🤖💅 แม่ทำได้เยอะเลยค่ะ${esc(title)} ลองพิมพ์แบบพูดธรรมดาได้เลย` : `🤖 บอททำได้เยอะเลย ${esc(title)} ลองพิมพ์แบบพูดธรรมดาได้`,
    "",
    "🗓 <b>งานของเรา</b>: วันนี้มีงานไหม · พรุ่งนี้มีไร · งานถัดไปกี่โมง · ใครไปด้วย · สัปดาห์นี้ว่างวันไหน",
    "💡 <b>ทิป</b>: ทิปถ่ายรูป · ทิปวิดีโอ · ทิปพิธีกร · ทิปไลฟ์",
    "✅ <b>รับทราบ / ⛔ ไม่สะดวก</b>: กดใต้การ์ดงาน",
    "➕ <b>เพิ่ม/แก้งาน · 📎 แนบไฟล์</b>: ปุ่ม งาน ซ้ายล่าง",
    "🖼 <b>เปลี่ยนรูป</b> · ✨ <b>ขอลุค</b> (ลุค/ฉายาพิเศษ)",
    "😂 <b>มุก</b> คำถาม | คำตอบ → ตัวการ์ตูนเล่าบนจอ",
    "🎬 <b>ไอเดีย</b> เรื่องแก็กที่อยากเห็น → แอดมินทำเป็นฉากการ์ตูน (ใส่ชื่อคนคิดด้วย)",
    "📢 <b>ประกาศ</b> ข้อความ → ตัววิ่งบนจอ",
    mom ? "💅 ไม่ชอบให้แม่พูดแบบนี้ พิมพ์ <b>ปิดโหมดแม่</b> ได้ค่ะ" : "",
  ].filter(Boolean).join("\n");
}

const pick = <T,>(list: T[], seed = Date.now()) => list[Math.floor(seed / 1000) % list.length];

export function smallTalk(intent: "hello" | "thanks" | "tired" | "hungry" | "bored" | "praise" | "love", title: string, seed = Date.now(), mom = false): string {
  const w = esc(title);
  if (mom) {
    const M: Record<typeof intent, string[]> = {
      hello: [`ว้ายยย ${w} มาแล้ว! 👋 วันนี้มีอะไรให้แม่ช่วยคะ`, `สวัสดีค่ะ${w} สวยปังตั้งแต่เช้าเลย ✨ พิมพ์ "งานถัดไป" ให้แม่ดูให้ได้นะคะ`],
      thanks: [`ด้วยความยินดีค่ะลูก 💜`, `ไม่ต้องขอบคุณแม่หรอกค่ะ ลูกเก่งเองล้วน ๆ 💅`],
      tired: [`เหนื่อยเหรอลูก มาให้แม่กอด 🫂 พักดื่มน้ำก่อนนะคะ`, `พักก่อนค่ะลูก นางฟ้าก็ต้องชาร์จแบต 🧚 เดี๋ยวค่อยลุยต่อ`],
      hungry: [`หิวแล้วต้องกินค่ะลูก 🍜 สวยแค่ไหนก็ต้องกินข้าว`, `ไปหาอะไรอร่อย ๆ กินเลยค่ะ แม่อนุญาต 🍱✨`],
      bored: [`เบื่อเหรอลูก? ส่งมุกให้ตัวการ์ตูนเล่าบนทีวีเลยค่ะ พิมพ์ "มุก" 😂`, `มาค่ะ พิมพ์ "ขอลุค" ให้แม่แต่งตัวการ์ตูนให้ปังกว่าเดิม 💅`, `เล่าเรื่องฮา ๆ ในออฟฟิศให้แม่ฟังหน่อย พิมพ์ "ไอเดีย" แล้วเล่ามาเลยค่ะ 🎬`],
      praise: [`ตายแล้ว ชมแม่เหรอคะ เขินนน 🙈 ลูกก็ปังไม่แพ้กัน!`, `มงลงค่ะลูก 👑 ทีมเราเริ่ดที่สุด`],
      love: [`แม่ก็รักลูกนะคะ 💜`, `รักเหมือนกันค่ะลูก 🥰`],
    };
    return pick(M[intent], seed);
  }
  const L: Record<typeof intent, string[]> = {
    hello: [`สวัสดีจ้า ${w} 👋 วันนี้มีอะไรให้ช่วย พิมพ์ "วันนี้มีงานไหม" ได้เลย`, `หวัดดี ${w} ✨ พร้อมลุยแล้ว! อยากรู้งานถัดไปพิมพ์ "งานถัดไป"`],
    thanks: [`ยินดีเสมอ ${w} 🙏`, `ด้วยความยินดี ${w} 😊 มีอะไรทักมาได้ตลอด`],
    tired: [`พักดื่มน้ำก่อนน้า ${w} 💧 งานหนักแค่ไหน ทีมเราก็ผ่านมาได้ทุกครั้ง`, `เหนื่อยก็พักนะ ${w} 🫶 อยากหายเครียด ลองส่งมุกขึ้นจอดู พิมพ์ "มุก"`],
    hungry: ["หิวแล้วต้องกิน! 🍜 ส่วนบอทกินแต่ไฟฟ้า ⚡", `${w} ไปหาอะไรอร่อย ๆ กินก่อนเลย 🍱 งานรอได้ (แต่อย่านานนะ 😆)`],
    bored: [`เบื่อเหรอ ${w}? ลองส่งมุกให้ตัวการ์ตูนเล่าบนทีวีดูสิ 😂 พิมพ์ "มุก"`, `มาเล่นกัน! พิมพ์ "ขอลุค" ขอลุคพิเศษให้ตัวการ์ตูนของ${w}ได้นะ ✨`, `มีเรื่องขำในออฟฟิศอยากเห็นเป็นการ์ตูนมั้ย ${w}? พิมพ์ "ไอเดีย" แล้วเล่ามาเลย 🎬`],
    praise: [`เขินเลย 🙈 ${w} ก็เก่งไม่แพ้กัน!`, `ขอบคุณจ้า ${w} 😆 ทีมเราเก่งที่สุดอยู่แล้ว`],
    love: [`บอทก็ชอบ ${w} นะ 💜`, `รู้สึกเหมือนกันเลย ${w} 🥰`],
  };
  return pick(L[intent], seed);
}

export function didNotGetText(title: string, mom = false): string {
  return [
    mom ? `🫠 แม่งงนิดนึงค่ะ ${esc(title)}` : `🤔 ยังไม่เข้าใจนิดนึง ${esc(title)}`,
    'ลองพิมพ์แบบนี้: "พรุ่งนี้มีงานไหม" · "งานถัดไป" · "ใครไปด้วย" · "ทิปพิธีกร" · "เปลี่ยนรูป"',
    'ดูทั้งหมด พิมพ์ "ทำอะไรได้บ้าง"',
  ].join("\n");
}

export const IDEA_PROMPT = [
  "🎬 <b>ไอเดียแก็กการ์ตูน</b>",
  "เล่ามาเลย (ภายใน 15 นาที): ใครทำอะไร แล้วฮาตรงไหน",
  "เช่น <code>แข กับ แป้ง แย่งขนมชิ้นสุดท้าย แล้วพี่ไป๋เดินมาแบ่งให้</code>",
  "🙏 ขอเป็นมุกน่ารัก ไม่ล้อใครให้เสียใจนะ · แอดมินเลือกไปทำเป็นฉากบนจอ พร้อมชื่อคนคิด",
].join("\n");

export const LOOK_PROMPT = [
  "✨ <b>ขอลุคพิเศษให้ตัวการ์ตูน</b>",
  "พิมพ์บอกได้เลย (ภายใน 15 นาที) ว่าอยากได้ลุคแบบไหน + อยากให้บอทเรียกว่าอะไร",
  "เช่น <code>ลุคนักบินอวกาศ เรียกว่ากัปตันกุ๊ก</code>",
  "แอดมินจะทำตัวอย่างให้เลือกก่อนขึ้นจอ",
].join("\n");
