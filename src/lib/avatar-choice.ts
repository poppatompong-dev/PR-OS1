// The person decides about their own cartoon (owner, 29 Oct 2026): use it, do
// not use it (screens show the name only), or send a real photo for a redraw.
// The choice lives in people.metadata.avatar ('on' | 'off'); photos go to the
// private avatar-sources bucket (service role only) and are deleted once drawn.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AvatarChoice = "on" | "off";
export const AVATAR_SOURCE_BUCKET = "avatar-sources";

export async function setAvatarChoice(admin: SupabaseClient, personId: string, choice: AvatarChoice, via: "line" | "telegram"): Promise<void> {
  const { data } = await admin.from("people").select("metadata").eq("id", personId).maybeSingle();
  const metadata = { ...((data?.metadata as Record<string, unknown>) ?? {}), avatar: choice };
  await admin.from("people").update({ metadata }).eq("id", personId);
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: choice === "on" ? "avatar_ok" : "avatar_off",
    changed_by: null,
    summary: choice === "on" ? `เจ้าตัวเลือกใช้รูปการ์ตูน (${via})` : `เจ้าตัวเลือกไม่ใช้รูปการ์ตูน — แสดงแค่ชื่อ (${via})`,
  });
}

export async function getAvatarChoice(admin: SupabaseClient, personId: string): Promise<AvatarChoice> {
  const { data } = await admin.from("people").select("metadata").eq("id", personId).maybeSingle();
  return (data?.metadata as Record<string, unknown> | null)?.avatar === "off" ? "off" : "on";
}

/** Store a photo sent in the chat for a redraw. Returns false when it could not be saved. */
export async function saveAvatarSource(
  admin: SupabaseClient,
  personId: string,
  bytes: ArrayBuffer,
  contentType: string,
  via: "line" | "telegram",
): Promise<boolean> {
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `${personId}/${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
  const { error } = await admin.storage.from(AVATAR_SOURCE_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) return false;
  await admin.from("audit_logs").insert({
    entity_type: "person",
    entity_id: personId,
    action: "avatar_photo_received",
    changed_by: null,
    summary: `ส่งรูปจริงมาให้ทำการ์ตูนใหม่ (${via})`,
    new_values: { path },
  });
  return true;
}

/** People who chose "no cartoon": pages show their name only. Server-side, any signed-in client. */
export async function getAvatarOffIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("people").select("id").eq("metadata->>avatar", "off");
  return new Set(((data as Array<{ id: string }>) ?? []).map((r) => r.id));
}
