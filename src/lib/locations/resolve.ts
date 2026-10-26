// Place typed by hand (owner, 26 Oct 2026). A name already in the list is
// reused; a new one is kept as a "custom" row (locations.is_custom, 0016) so
// it never shows up in the master list in /settings, but LINE cards, the TV
// and reports read its name like any other place, and it is offered again as
// a suggestion next time. Service-role client: a LINE-only member has no
// web session, and the caller has already checked who may create jobs.

import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_PLACE_LENGTH = 120;

/** Trimmed, single spaces, capped. Empty → null. */
export function cleanPlace(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PLACE_LENGTH);
  return text || null;
}

/**
 * The place for a job from the form. `locationText` (typed) wins; an old form
 * that still posts `locationId` keeps working. Returns null for "no place".
 */
export async function resolveLocationId(
  admin: SupabaseClient,
  input: { locationText?: unknown; locationId?: unknown; currentId?: string | null },
): Promise<string | null> {
  const typed = cleanPlace(input.locationText);
  if (!typed) {
    const id = String(input.locationId ?? "").trim();
    return id || null;
  }
  // Editing and the name was left as it was: keep the same row (no "สถานที่" change).
  if (input.currentId) {
    const { data: cur } = await admin.from("locations").select("name").eq("id", input.currentId).maybeSingle();
    if (cur && cleanPlace(cur.name)?.toLocaleLowerCase("th-TH") === typed.toLocaleLowerCase("th-TH")) return input.currentId;
  }
  const { data: found } = await admin
    .from("locations")
    .select("id, name, is_active")
    .ilike("name", typed.replace(/[\\%_]/g, (c) => `\\${c}`))
    .order("is_custom", { ascending: true })
    .limit(5);
  const exact = (found ?? []).find((l) => l.name.trim().toLocaleLowerCase("th-TH") === typed.toLocaleLowerCase("th-TH"));
  if (exact) {
    if (!exact.is_active) await admin.from("locations").update({ is_active: true }).eq("id", exact.id);
    return exact.id;
  }
  const { data: created, error } = await admin
    .from("locations")
    .insert({ name: typed, is_custom: true, is_active: true })
    .select("id")
    .single();
  if (error || !created) throw new Error(`บันทึกสถานที่ไม่สำเร็จ: ${error?.message ?? "ไม่ทราบสาเหตุ"}`);
  return created.id;
}

/**
 * Suggestions for the place box: the master list first, then places typed
 * on earlier jobs (most used first). Names only, no duplicates.
 */
export async function placeSuggestions(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin
    .from("locations")
    .select("id, name, is_custom, events(count)")
    .eq("is_active", true)
    .limit(500);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const uses = (r: { events?: Array<{ count: number }> }) => r.events?.[0]?.count ?? 0;
  const master = rows.filter((r) => !r.is_custom).sort((a, b) => a.name.localeCompare(b.name, "th"));
  const custom = rows.filter((r) => r.is_custom && uses(r) > 0).sort((a, b) => uses(b) - uses(a));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...master, ...custom]) {
    const key = r.name.trim().toLocaleLowerCase("th-TH");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r.name.trim());
    }
  }
  return out;
}
