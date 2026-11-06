// ธีมต้อนรับคนมาใหม่บนทีวี (owner + พี่เอิร์ธ, 6 Nov 2026 · หัวหน้าฝ่ายบริการฯ
// คนใหม่มา จ. 9 พ.ย. 69). Like the birthday theme, the job is the switch: a job
// today whose title says ต้อนรับ + โอน/ย้าย/มาใหม่ turns it on for the whole day
// (header banner + a big "red carpet" show). ต้อนรับคณะศึกษาดูงาน does not.
// No name and no photo on screen (owner): the position + a warm line from the team.
// Look: 3 ดอกไม้ (owner, 6 Nov 2026); /tv?welcome=fast&wv=1|2 still previews the others.
// To change the words: edit WELCOME_ROLE / WELCOME_WARM.

import type { MonitorEvent } from "./types";

export const WELCOME_ROLE = "หัวหน้าฝ่ายบริการและเผยแพร่วิชาการ";
export const WELCOME_WARM = "ทีมประชาสัมพันธ์ยินดีต้อนรับ 🙏";
export const WELCOME_VARIANTS = [1, 2, 3] as const;
export type WelcomeVariant = (typeof WELCOME_VARIANTS)[number];
/** Owner picked 3 ดอกไม้ (6 Nov 2026). */
export const WELCOME_DEFAULT_VARIANT: WelcomeVariant = 3;

export type Welcome = { role: string; warm: string; variant: WelcomeVariant; label?: string };
/** /tv?wv=all — big corner tag so the team can say which one they like. */
export const WELCOME_LABELS: Record<WelcomeVariant, string> = { 1: "แบบ 1 · แดง–ทอง", 2: "แบบ 2 · กรมท่า–ทอง", 3: "แบบ 3 · ดอกไม้" };
export const WELCOME_CYCLE_MS = 20_000;

const NEWCOMER = /ต้อนรับ/;
const MOVED_IN = /โอน|ย้าย|มาใหม่|คนใหม่|รับตำแหน่ง|บรรจุ/;
const VISITORS = /ศึกษาดูงาน|ดูงาน|คณะ/;

export function isWelcomeJob(e: Pick<MonitorEvent, "title" | "screenTitle" | "status">): boolean {
  if (e.status === "canceled") return false;
  const t = `${e.title} ${e.screenTitle ?? ""}`;
  return NEWCOMER.test(t) && MOVED_IN.test(t) && !VISITORS.test(t);
}

export function welcomeToday(events: MonitorEvent[], today: string, variant: WelcomeVariant = WELCOME_DEFAULT_VARIANT): Welcome | null {
  return events.some((e) => e.eventDate === today && isWelcomeJob(e)) ? { role: WELCOME_ROLE, warm: WELCOME_WARM, variant } : null;
}

export const asWelcomeVariant = (v: string | null | undefined): WelcomeVariant | null =>
  (WELCOME_VARIANTS as readonly number[]).includes(Number(v)) ? (Number(v) as WelcomeVariant) : null;
