// น้องบอทชวนคุย (owner, 12 Nov 2026: "อยากให้บอทสวมบทบาท ช่วยขยันสื่อสารกับพี่เอิร์ธ").
// A friendly once-a-day chat for one person who said yes. Decided with the owner:
//   · the bot asks first (🤝 เอาครับ / 🙅 ไม่เอา); "หยุดชวนคุย" stops it any time
//   · the lines are written fresh by the admin's helper (Claude) in /settings, not canned
//   · working hours only, one a day; replies are read on the next round (not instant)
//   · light teasing only — never the family by name, never "ถูกห้าม"
// Stored in audit_logs (no new table):
//   buddy_optin  entity_id = person id, new_values { on }
//   buddy_msg    entity_id = person id, new_values { message }   (what was sent)
//   bot_unknown  …, new_values { text, buddy: true }             (their reply → 🆘 panel)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TgMessage } from "@/lib/telegram/api";

export const BUDDY_HEAD = "🤖 <b>น้องบอทชวนคุย</b>";
/** A reply within this long after a buddy line is part of the chat, not a question for the admins. */
export const BUDDY_LIVE_HOURS = 6;

export function buddyInvite(): TgMessage {
  return {
    text: [
      BUDDY_HEAD,
      "",
      "อยากให้น้องบอทแวะมาชวนคุยวันละครั้งไหมครับ 😄",
      "เรื่องบอล หนัง มุกขำ ๆ — เฉพาะเวลางาน ไม่กวนตอนอยู่บ้าน",
      "",
      "<i>พิมพ์ตอบมาได้เลย น้องบอทจะตอบกลับในเวลางาน (อาจช้าสักชั่วโมง) · เลิกเมื่อไรพิมพ์ \"หยุดชวนคุย\"</i>",
    ].join("\n"),
    buttons: [[{ text: "🤝 เอาครับ", callback_data: "bd|on" }, { text: "🙅 ไม่เอา", callback_data: "bd|off" }]],
  };
}

/** "หยุดชวนคุย" → off · "ชวนคุย" / "เปิดชวนคุย" → on · anything else → null. */
export function parseBuddyCommand(text: string): "on" | "off" | null {
  const t = text.replace(/\s+/g, "").replace(/(ครับ|ค่ะ|คะ|นะ|จ้า|หน่อย)+$/g, "");
  if (/^(หยุด|เลิก|ปิด|ไม่ต้อง|ไม่เอา)ชวนคุย$/.test(t)) return "off";
  if (/^(เปิด|เอา)?ชวนคุย$/.test(t)) return "on";
  return null;
}

export const buddyOnText = "🤝 <b>จัดไปครับ!</b> เดี๋ยวน้องบอทแวะมาชวนคุยวันละครั้ง (เวลางาน)\nเลิกเมื่อไร พิมพ์ <b>หยุดชวนคุย</b> ได้เลยครับ";
export const buddyOffText = "🙏 <b>ได้ครับ ไม่ชวนคุยแล้ว</b>\nเปลี่ยนใจเมื่อไร พิมพ์ <b>ชวนคุย</b> ได้เลยครับ";
export const buddyGotText = "😄 รับแล้วครับ เดี๋ยวน้องบอทมาคุยต่อ (ตอบช้านิดนึง ช่วงเวลางานครับ)";

export async function setBuddy(admin: SupabaseClient, personId: string, on: boolean): Promise<void> {
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "buddy_optin",
    changed_by: null,
    summary: on ? "เปิดรับน้องบอทชวนคุย" : "ปิดน้องบอทชวนคุย",
    new_values: { on },
  });
}

/** The person's latest choice (false until they say yes). */
export async function isBuddyOn(admin: SupabaseClient, personId: string): Promise<boolean> {
  const { data } = await admin
    .from("audit_logs")
    .select("new_values, changed_at")
    .eq("action", "buddy_optin")
    .eq("entity_id", personId)
    .order("changed_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.new_values as { on?: boolean } | undefined)?.on === true;
}

/** Said yes, and a buddy line went out in the last few hours → their free text is a reply to it. */
export async function buddyLive(admin: SupabaseClient, personId: string, now = new Date()): Promise<boolean> {
  if (!(await isBuddyOn(admin, personId))) return false;
  const since = new Date(now.getTime() - BUDDY_LIVE_HOURS * 3_600_000).toISOString();
  const { data } = await admin.from("audit_logs").select("id").eq("action", "buddy_msg").eq("entity_id", personId).gte("changed_at", since).limit(1);
  return (data ?? []).length > 0;
}

/** One buddy line a day (Bangkok day). */
export async function buddySentToday(admin: SupabaseClient, personId: string, now = new Date()): Promise<boolean> {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
  const { data } = await admin.from("audit_logs").select("id").eq("action", "buddy_msg").eq("entity_id", personId).gte("changed_at", `${day}T00:00:00+07:00`).limit(1);
  return (data ?? []).length > 0;
}
