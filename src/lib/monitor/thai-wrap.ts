// ตัดคำขึ้นบรรทัดใหม่ให้ถูก (owner, 12 Nov 2026): the browser's Thai word breaker
// split "เมืองอนาคตฯ" into เมือ|งอ|นาค|ตฯ (the ฯ confuses it) and "คนชรา" into คน|ชรา.
// Break only at spaces when a phrase fits; inside a long phrase only between real
// words, with ฯ/ๆ stuck to their word, prefixes kept with the next word and a few
// compounds glued.

const GLUE = [
  "คนชรา", "ผู้สูงอายุ", "พวงมาลา", "ดอกไม้จันทน์", "ไม้จันทน์", "เทศบาลนคร", "นครสวรรค์", "ปากน้ำโพ", "ประชาสัมพันธ์",
  "ปิยมหาราช", "มหาราช", "พนักงานจ้าง", "สมเด็จพระ", "พระราชทาน", "กองยุทธศาสตร์", "ลอยกระทง", "ศึกษาดูงาน", "ผู้บริหาร",
];
const PREFIX = new Set(["ความ", "การ", "ผู้", "นัก", "ที่", "ของ", "แห่ง"]);
const SHORT = 13; // a phrase this long (or shorter) never breaks inside

const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

function words(chunk: string): string[] {
  const tail = chunk.match(/[ฯๆ]+$/)?.[0] ?? "";
  const body = tail ? chunk.slice(0, -tail.length) : chunk;
  let parts = seg ? [...seg.segment(body)].map((s) => s.segment).filter(Boolean) : [body];
  // glue compounds: merge while the joined text is still the start of a glue word
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    let cur = parts[i];
    for (let j = i + 1; j < parts.length; j++) {
      const next = cur + parts[j];
      if (GLUE.some((g) => g.startsWith(next))) { cur = next; i = j; } else break;
    }
    out.push(cur);
  }
  parts = [];
  for (const w of out) {
    const prev = parts[parts.length - 1];
    if (prev !== undefined && (PREFIX.has(prev) || w.length <= 1 || /^[่-๋ะาำ]/.test(w))) parts[parts.length - 1] = prev + w;
    else parts.push(w);
  }
  if (tail) parts[parts.length - 1] = (parts[parts.length - 1] ?? "") + tail;
  return parts;
}

/** Pieces that must not break inside, in order; a break may come between any two. */
export function thaiPieces(text: string): string[][] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => (/[ก-๛]/.test(chunk) && [...chunk].length > SHORT ? words(chunk) : [chunk]));
}
