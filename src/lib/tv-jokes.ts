// ตู้ส่งมุกขึ้นจอทีวี (owner, 5 Nov 2026: ทีมชอบตัวการ์ตูน "อยากได้มุกเพิ่ม").
// Anyone linked on Telegram types  มุก <ข้อความ>  (setup | punchline, or two lines)
// → every admin gets ✅ ขึ้นจอ / ❌ ไม่ใช้ → approved jokes are told by the cartoons
// on the TV with "💌 มุกจาก <ชื่อเล่น>". Stored in audit_logs (no new table):
//   tv_joke      entity_id = sender's person id, new_values { text }
//   tv_joke_ok / tv_joke_no   entity_id = the tv_joke row id, new_values { by }

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminRecipientIds, getPeopleByIds } from "@/lib/line/data";
import { esc, sendTelegram } from "@/lib/telegram/api";
import { nickname } from "@/lib/monitor/nicknames";

export const JOKE_MAX = 120;
export const JOKE_DAYS = 120;

/** "มุก ถาม…|ตอบ…" → the joke text; "มุก" alone → "" (ask for it); anything else → null. */
export function parseJokeCommand(text: string): string | null {
  const m = text.match(/^(?:\/joke|ส่งมุก|มุก)(?:\s*[:：]\s*|\s+|$)([\s\S]*)$/i);
  if (!m) return null;
  return m[1].trim();
}

/** Tidy and check a joke; setup and punchline split on "|" or a new line. */
export function cleanJoke(raw: string): { ok: true; text: string } | { ok: false; error: string } {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  if (text.length < 4) return { ok: false, error: "สั้นไปนิด ลองพิมพ์มุกเต็ม ๆ อีกครั้งครับ" };
  if (text.length > JOKE_MAX) return { ok: false, error: `ยาวไป (${text.length} ตัว) ขอไม่เกิน ${JOKE_MAX} ตัวอักษร จะได้อ่านทันบนจอครับ` };
  if (/https?:\/\/|www\./i.test(text)) return { ok: false, error: "ขอเป็นข้อความล้วน ไม่ใส่ลิงก์นะครับ" };
  return { ok: true, text };
}

export function splitJoke(text: string): { setup: string; punch: string } {
  // "คำถาม : … คำตอบ : …" (นัท, 10 Nov 2026): the last answer is the punch line,
  // the turns before it the setup; a stage note before the first คำถาม is dropped.
  const turns = [...text.matchAll(/(คำถาม|คำตอบ|ถาม|ตอบ)\s*[:：]\s*([\s\S]*?)(?=\s*(?:คำถาม|คำตอบ|ถาม|ตอบ)\s*[:：]|$)/g)].map((m) => ({ q: !m[1].endsWith("ตอบ"), t: m[2].trim() })).filter((x) => x.t);
  if (turns.length >= 2 && !turns[turns.length - 1].q) {
    const punch = turns[turns.length - 1].t;
    const setup = turns.slice(0, -1).map((x) => (x.q ? x.t : `→ ${x.t}`)).join(" ");
    return { setup, punch };
  }
  const parts = text.split(/\s*[|\n]\s*/).filter(Boolean);
  if (parts.length >= 2) return { setup: parts[0], punch: parts.slice(1).join(" ") };
  return { setup: "", punch: text };
}

export const JOKE_PROMPT = [
  "😂 <b>ส่งมุกขึ้นจอทีวี</b>",
  "พิมพ์มุกส่งมาได้เลย (ภายใน 10 นาที)",
  "แบ่งคำถาม | คำตอบ ด้วยขีด | หรือขึ้นบรรทัดใหม่",
  "เช่น <code>ประชุมสั้น ๆ 5 นาที | ของจริง 2 ชั่วโมง</code>",
  "แอดมินกดอนุมัติก่อนขึ้นจอนะครับ",
].join("\n");

export async function submitJoke(admin: SupabaseClient, person: { id: string; displayName: string }, raw: string): Promise<string> {
  const c = cleanJoke(raw);
  if (!c.ok) return `⚠️ ${esc(c.error)}`;
  const { data, error } = await admin
    .from("audit_logs")
    .insert({ entity_type: "tv_joke", entity_id: person.id, action: "tv_joke", changed_by: null, summary: "ส่งมุกขึ้นจอทีวี (Telegram)", new_values: { text: c.text } })
    .select("id")
    .single();
  if (error || !data) return "⚠️ ส่งไม่สำเร็จ ลองใหม่อีกครั้งครับ";
  const name = nickname(person.id, person.displayName);
  const { setup, punch } = splitJoke(c.text);
  const people = await getPeopleByIds(admin, await getAdminRecipientIds(admin));
  for (const a of people) {
    if (!a.telegramChatId) continue;
    await sendTelegram(a.telegramChatId, {
      text: [`😂 <b>มุกใหม่จาก ${esc(name)}</b>`, "", setup ? `❓ ${esc(setup)}` : "", `💥 ${esc(punch)}`].filter(Boolean).join("\n"),
      buttons: [[{ text: "✅ ขึ้นจอ", callback_data: `jk|${data.id}|1` }, { text: "❌ ไม่ใช้", callback_data: `jk|${data.id}|0` }]],
    });
  }
  return "📨 <b>ส่งมุกแล้ว!</b> รอแอดมินกดอนุมัติ แล้วตัวการ์ตูนจะเล่าให้ทั้งห้องฟังครับ 😆";
}

/** An admin pressed ✅/❌. Returns the toast, and tells the sender when it goes up. */
export async function decideJoke(admin: SupabaseClient, jokeId: string, ok: boolean, by: { id: string; displayName: string }): Promise<{ toast: string; done: string | null }> {
  const admins = await getAdminRecipientIds(admin);
  if (!admins.includes(by.id)) return { toast: "เฉพาะแอดมินครับ", done: null };
  const { data: joke } = await admin.from("audit_logs").select("id, entity_id, new_values").eq("id", jokeId).eq("action", "tv_joke").maybeSingle();
  if (!joke) return { toast: "ไม่พบมุกนี้", done: null };
  const { data: prev } = await admin.from("audit_logs").select("action, new_values").eq("entity_id", jokeId).in("action", ["tv_joke_ok", "tv_joke_no"]).limit(1).maybeSingle();
  if (prev) return { toast: prev.action === "tv_joke_ok" ? "มีแอดมินอนุมัติไปแล้ว" : "มีแอดมินกดไม่ใช้ไปแล้ว", done: null };
  await admin.from("audit_logs").insert({
    entity_type: "tv_joke",
    entity_id: jokeId,
    action: ok ? "tv_joke_ok" : "tv_joke_no",
    changed_by: null,
    summary: ok ? "อนุมัติมุกขึ้นจอ" : "ไม่ใช้มุกนี้",
    new_values: { by: by.id },
  });
  const text = String((joke.new_values as { text?: string })?.text ?? "");
  if (ok) {
    const [sender] = await getPeopleByIds(admin, [joke.entity_id]);
    if (sender?.telegramChatId) await sendTelegram(sender.telegramChatId, { text: "🎉 <b>มุกของคุณผ่านแล้ว!</b> เดี๋ยวตัวการ์ตูนจะเล่าบนจอทีวี รอดูได้เลยครับ 📺" });
  }
  return { toast: ok ? "✅ ขึ้นจอแล้ว" : "❌ ไม่ใช้มุกนี้", done: `${ok ? "✅ ขึ้นจอแล้ว" : "❌ ไม่ใช้"} · ${esc(text)}` };
}

export type TvJoke = { id: string; personId: string; name: string; setup: string; punch: string };

/** Approved jokes of the last JOKE_DAYS days, newest first (public TV feed). */
export async function loadApprovedJokes(admin: SupabaseClient, now = new Date()): Promise<TvJoke[]> {
  const since = new Date(now.getTime() - JOKE_DAYS * 86_400_000).toISOString();
  const { data: oks } = await admin.from("audit_logs").select("entity_id").eq("action", "tv_joke_ok").gte("changed_at", since).limit(500);
  const ids = (oks ?? []).map((r: { entity_id: string }) => r.entity_id);
  if (!ids.length) return [];
  const { data: rows } = await admin.from("audit_logs").select("id, entity_id, new_values, changed_at").in("id", ids).eq("action", "tv_joke").order("changed_at", { ascending: false });
  const people = await getPeopleByIds(admin, [...new Set((rows ?? []).map((r: { entity_id: string }) => r.entity_id))]);
  const nameOf = new Map(people.map((p) => [p.id, nickname(p.id, p.displayName)]));
  return (rows ?? []).map((r: { id: string; entity_id: string; new_values: { text?: string } }) => {
    const { setup, punch } = splitJoke(String(r.new_values?.text ?? ""));
    return { id: r.id, personId: r.entity_id, name: nameOf.get(r.entity_id) ?? "ทีม ปชส.", setup, punch };
  }).filter((j) => j.punch);
}
