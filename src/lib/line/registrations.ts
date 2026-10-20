// LINE accounts that tapped "ลงทะเบียน" in the team group and are waiting for
// an admin to say who they are (owner, 20 Oct 2026: staff should only need the
// existing group — no PR-OS password, no LINE Login screen).
//
// Kept in settings["line_pending_registrations"] as a small JSON array; the
// team is about ten people, so no table of its own. Pure helpers only here, so
// the rules are unit-tested; the reads and writes live in line/data.ts.

export const PENDING_REGISTRATIONS_KEY = "line_pending_registrations";
export const MAX_PENDING_REGISTRATIONS = 50;

export type PendingRegistration = {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  groupId: string | null;
  /** ISO time of the (latest) tap. */
  at: string;
};

/** Whatever is stored, as a clean list (bad entries dropped, newest first). */
export function parsePendingRegistrations(value: unknown): PendingRegistration[] {
  if (!Array.isArray(value)) return [];
  const out: PendingRegistration[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    if (typeof o.lineUserId !== "string" || !o.lineUserId) continue;
    out.push({
      lineUserId: o.lineUserId,
      displayName: typeof o.displayName === "string" && o.displayName ? o.displayName : "ผู้ใช้ LINE",
      pictureUrl: typeof o.pictureUrl === "string" && o.pictureUrl ? o.pictureUrl : null,
      groupId: typeof o.groupId === "string" && o.groupId ? o.groupId : null,
      at: typeof o.at === "string" ? o.at : new Date(0).toISOString(),
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Add or refresh one entry (one per LINE account), keeping the newest `max`. */
export function mergePendingRegistration(
  list: PendingRegistration[],
  entry: PendingRegistration,
  max = MAX_PENDING_REGISTRATIONS,
): PendingRegistration[] {
  return [entry, ...list.filter((r) => r.lineUserId !== entry.lineUserId)]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, max);
}

export function removePendingRegistration(list: PendingRegistration[], lineUserId: string): PendingRegistration[] {
  return list.filter((r) => r.lineUserId !== lineUserId);
}
