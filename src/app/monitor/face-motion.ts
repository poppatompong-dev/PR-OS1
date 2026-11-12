// หันหน้าไปทางที่เดิน (owner, 12 Nov 2026: "ทั้งคนทั้งสัตว์ ยังวิ่งถอยหลังกันอยู่เลย").
// The drawings (and most animal emoji) face LEFT, while the gags and scenes set
// scaleX by hand — some flip when going left, some don't. Instead of trusting any
// of that, watch each character's real movement and turn it to face it:
//   visual = native(-1) × face × elementScaleX  →  face = -dir × elementScaleX
// Two samples the same way before turning (a shake never flickers); standing still
// keeps the last facing. Characters: .tv-gag .sp / .tv-cast-sp (via ::before and
// --face), animal emoji in .tv-gag .emo (wrapped in a span the first time).

const SEL = ".tv-gag .sp, .tv-cast-sp, .tv-gag .emo";
const ANIMAL = /[\u{1F400}-\u{1F43F}\u{1F980}-\u{1F9AE}]/u; // 🐀…🐿 + 🦀…🦮
const MIN_PX = 4; // per sample (~40 px/s)

type St = { x: number; dir: number; streak: number };

export function startFacing(doc: Document = document, everyMs = 100): () => void {
  const seen = new WeakMap<Element, St>();
  const tick = () => {
    doc.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
      const emo = el.classList.contains("emo");
      if (emo && !ANIMAL.test(el.textContent ?? "")) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
      const x = m.e;
      const sx = m.a < 0 ? -1 : 1;
      const st = seen.get(el);
      if (!st) {
        seen.set(el, { x, dir: 0, streak: 0 });
        return;
      }
      const dx = x - st.x;
      st.x = x;
      if (Math.abs(dx) < MIN_PX) return;
      const dir = dx > 0 ? 1 : -1;
      st.streak = dir === st.dir ? st.streak + 1 : 1;
      st.dir = dir;
      if (st.streak < 2) return;
      const face = String(-dir * sx);
      if (emo) {
        let s = el.querySelector<HTMLElement>(":scope > .face-turn");
        if (!s) {
          s = doc.createElement("span");
          s.className = "face-turn";
          while (el.firstChild) s.appendChild(el.firstChild);
          el.appendChild(s);
        }
        if (s.style.getPropertyValue("--face") !== face) s.style.setProperty("--face", face);
      } else if (el.style.getPropertyValue("--face") !== face) el.style.setProperty("--face", face);
    });
  };
  const id = setInterval(tick, everyMs);
  return () => clearInterval(id);
}
