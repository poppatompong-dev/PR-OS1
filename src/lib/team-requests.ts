// คำขอจากทีม (owner, 10 Nov 2026: "รับงานมา ทำให้น้องๆด้วย เสร็จแล้วรายงานส่วนตัว ติดตามบนจอ").
// A ขอลุค / ไอเดียแก็ก sent to the bot is a request. Admins (and Claude, through
// /settings) move it along: รับแล้ว → กำลังทำ → รอเลือก → เสร็จ. รอเลือก and เสร็จ
// tell the person privately on Telegram; the TV shows the board in the bottom box.
// Stored in audit_logs (no new table):
//   look_request / gag_idea   entity_id = person id, new_values { text }
//   team_request_status       entity_id = the request row id, new_values { status, topic?, image?, note?, by }

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminRecipientIds, getPeopleByIds } from "@/lib/line/data";
import { esc, sendTelegram, type TgMessage } from "@/lib/telegram/api";
import { nickname } from "@/lib/monitor/nicknames";
import { avatarUrl } from "@/lib/avatars";

export const REQ_STATUSES = ["received", "doing", "choose", "done", "dropped"] as const;
export type ReqStatus = (typeof REQ_STATUSES)[number];
export const REQ_STATUS_TH: Record<ReqStatus, string> = { received: "รับแล้ว", doing: "กำลังทำ", choose: "รอเลือก", done: "เสร็จ", dropped: "ไม่ทำ" };
export const REQ_STATUS_ICON: Record<ReqStatus, string> = { received: "📥", doing: "🛠", choose: "🎨", done: "✅", dropped: "🙅" };
export const REQ_KINDS = ["look_request", "gag_idea"] as const;
export type ReqKind = (typeof REQ_KINDS)[number];

const DAYS = 45;
const DONE_SHOWN_DAYS = 3;
const BOARD_MAX = 6;

export type TeamRequest = {
  id: string;
  personId: string;
  name: string;
  kind: ReqKind;
  text: string;
  topic: string;
  status: ReqStatus;
  image: string | null;
  avatar: string;
  at: string;
  updatedAt: string;
};

export const asReqStatus = (v: unknown): ReqStatus | null => ((REQ_STATUSES as readonly string[]).includes(String(v)) ? (v as ReqStatus) : null);

/** Only our own pictures (/looks/…, /avatars/…) or https — nothing else reaches the TV. */
export function safeImage(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (/^\/(looks|avatars)\/[\w./-]+\.(jpe?g|png|webp)$/i.test(s) && !s.includes("..")) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  return null;
}

/** A short line for the TV: the admin's topic, else the start of what they wrote. */
export function topicOf(kind: ReqKind, text: string, topic?: string | null): string {
  const t = (topic ?? "").trim() || text.replace(/\s+/g, " ").trim();
  const base = t || (kind === "look_request" ? "ลุคพิเศษ" : "ไอเดียแก็ก");
  return base.length > 40 ? `${base.slice(0, 39).trimEnd()}…` : base;
}

type ReqRow = { id: string; entity_id: string; action: string; new_values: { text?: string } | null; changed_at: string };
type StatusRow = { entity_id: string; new_values: { status?: string; topic?: string; image?: string } | null; changed_at: string };

/** Fold the status rows (any order) onto the requests: the newest status wins, topic/image stick once set. */
export function foldRequests(reqs: ReqRow[], statuses: StatusRow[], names: Map<string, string>): TeamRequest[] {
  const byReq = new Map<string, StatusRow[]>();
  for (const s of [...statuses].sort((a, b) => a.changed_at.localeCompare(b.changed_at))) {
    const list = byReq.get(s.entity_id) ?? [];
    list.push(s);
    byReq.set(s.entity_id, list);
  }
  return reqs
    .filter((r) => (REQ_KINDS as readonly string[]).includes(r.action))
    .map((r) => {
      const kind = r.action as ReqKind;
      const text = String(r.new_values?.text ?? "");
      let status: ReqStatus = "received";
      let topic: string | null = null;
      let image: string | null = null;
      let updatedAt = r.changed_at;
      for (const s of byReq.get(r.id) ?? []) {
        status = asReqStatus(s.new_values?.status) ?? status;
        if (s.new_values?.topic) topic = String(s.new_values.topic);
        image = safeImage(s.new_values?.image) ?? image;
        updatedAt = s.changed_at;
      }
      return {
        id: r.id,
        personId: r.entity_id,
        name: names.get(r.entity_id) ?? "ทีม ปชส.",
        kind,
        text,
        topic: topicOf(kind, text, topic),
        status,
        image,
        avatar: avatarUrl(r.entity_id),
        at: r.changed_at,
        updatedAt,
      };
    });
}

const ORDER: Record<ReqStatus, number> = { doing: 0, choose: 1, received: 2, done: 3, dropped: 9 };

/** The TV board: open ones first, เสร็จ stays a few days to celebrate, ไม่ทำ never shows. */
export function boardRequests(all: TeamRequest[], now = new Date()): TeamRequest[] {
  const doneSince = now.getTime() - DONE_SHOWN_DAYS * 86_400_000;
  return all
    .filter((r) => r.status !== "dropped" && (r.status !== "done" || Date.parse(r.updatedAt) >= doneSince))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, BOARD_MAX);
}

export async function loadTeamRequests(admin: SupabaseClient, now = new Date()): Promise<TeamRequest[]> {
  const since = new Date(now.getTime() - DAYS * 86_400_000).toISOString();
  const { data: reqs } = await admin
    .from("audit_logs")
    .select("id, entity_id, action, new_values, changed_at")
    .in("action", [...REQ_KINDS])
    .gte("changed_at", since)
    .order("changed_at", { ascending: false })
    .limit(200);
  const rows = (reqs ?? []) as ReqRow[];
  if (!rows.length) return [];
  const { data: st } = await admin
    .from("audit_logs")
    .select("entity_id, new_values, changed_at")
    .eq("action", "team_request_status")
    .in("entity_id", rows.map((r) => r.id))
    .limit(1000);
  const people = await getPeopleByIds(admin, [...new Set(rows.map((r) => r.entity_id))]);
  const names = new Map(people.map((p) => [p.id, nickname(p.id, p.displayName)]));
  return foldRequests(rows, (st ?? []) as StatusRow[], names);
}

/** What the person hears privately. Only รอเลือก and เสร็จ are worth a message. */
export function requestNotice(r: Pick<TeamRequest, "kind" | "topic">, status: ReqStatus, note: string, image: string | null, base: string): TgMessage | null {
  if (status !== "choose" && status !== "done") return null;
  const what = r.kind === "look_request" ? "ลุค" : "แก็ก";
  const head =
    status === "choose"
      ? `🎨 <b>${what}ที่ขอ มีตัวอย่างให้เลือกแล้ว</b>\n${esc(r.topic)}`
      : `✅ <b>${what}ที่ขอ เสร็จแล้ว!</b>\n${esc(r.topic)}${r.kind === "look_request" ? "\nรอดูบนจอทีวีได้เลย 📺" : ""}`;
  const tail = status === "choose" ? `\n\nเลือกแล้วพิมพ์ตอบมาในแชทนี้ เช่น <b>ขอลุค แบบ 2</b>` : "";
  const text = `${head}${note ? `\n\n${esc(note)}` : ""}${tail}`;
  const photo = image ? (image.startsWith("/") ? `${base.replace(/\/$/, "")}${image}` : image) : undefined;
  return photo ? { text, photo } : { text };
}

/** Admin-only. Writes the status row and, for รอเลือก / เสร็จ, tells the person. */
export async function setRequestStatus(
  admin: SupabaseClient,
  input: { requestId: string; status: ReqStatus; by: string; topic?: string; image?: string; note?: string; notify?: boolean; base: string },
): Promise<{ ok: boolean; notified: boolean; error?: string }> {
  const { data: req } = await admin.from("audit_logs").select("id, entity_id, action, new_values, changed_at").eq("id", input.requestId).in("action", [...REQ_KINDS]).maybeSingle();
  if (!req) return { ok: false, notified: false, error: "ไม่พบคำขอนี้" };
  const image = safeImage(input.image);
  const topic = (input.topic ?? "").trim().slice(0, 60);
  const note = (input.note ?? "").trim().slice(0, 500);
  await admin.from("audit_logs").insert({
    entity_type: "team_request",
    entity_id: req.id,
    action: "team_request_status",
    changed_by: null,
    summary: `คำขอจากทีม → ${REQ_STATUS_TH[input.status]}`,
    new_values: { status: input.status, by: input.by, ...(topic ? { topic } : {}), ...(image ? { image } : {}), ...(note ? { note } : {}) },
  });
  if (input.notify === false) return { ok: true, notified: false };
  const [r] = foldRequests([req as ReqRow], [{ entity_id: req.id, new_values: { topic: topic || undefined }, changed_at: req.changed_at }], new Map());
  const msg = requestNotice(r, input.status, note, image, input.base);
  if (!msg) return { ok: true, notified: false };
  const [person] = await getPeopleByIds(admin, [req.entity_id]);
  if (!person?.telegramChatId) return { ok: true, notified: false };
  let sent = await sendTelegram(person.telegramChatId, msg);
  if (!sent.ok && msg.photo) sent = await sendTelegram(person.telegramChatId, { text: msg.text });
  return { ok: true, notified: sent.ok };
}

/** A request that came in some other way (told in person): an admin logs it for the person. */
export async function addRequestFor(admin: SupabaseClient, personId: string, kind: ReqKind, text: string, by: string): Promise<string | null> {
  const t = text.trim().slice(0, 500);
  if (t.length < 2) return null;
  const { data } = await admin
    .from("audit_logs")
    .insert({
      entity_type: "person",
      entity_id: personId,
      action: kind,
      changed_by: null,
      summary: kind === "look_request" ? "ขอลุคพิเศษตัวการ์ตูน (แอดมินบันทึกแทน)" : "เสนอไอเดียแก็กการ์ตูน (แอดมินบันทึกแทน)",
      new_values: { text: t, via: "admin", by },
    })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

/** Buttons under the admins' copy of a new request (callback rq|<id>|<status index>). */
export function requestButtons(requestId: string) {
  return [
    (["doing", "choose", "done", "dropped"] as const).map((s) => ({ text: `${REQ_STATUS_ICON[s]} ${REQ_STATUS_TH[s]}`, callback_data: `rq|${requestId}|${REQ_STATUSES.indexOf(s)}` })),
  ];
}

/** Every admin recipient gets the new request with the status buttons. */
export async function tellAdminsRequest(admin: SupabaseClient, text: string, requestId: string | null): Promise<number> {
  const ids = await getAdminRecipientIds(admin);
  const people = (await getPeopleByIds(admin, ids)).filter((p) => p.telegramChatId);
  let sent = 0;
  for (const p of people) {
    const res = await sendTelegram(p.telegramChatId!, { text, ...(requestId ? { buttons: requestButtons(requestId) } : {}) });
    if (res.ok) sent += 1;
  }
  return sent;
}

export const isAdminOf = async (admin: SupabaseClient, personId: string) => (await getAdminRecipientIds(admin)).includes(personId);
