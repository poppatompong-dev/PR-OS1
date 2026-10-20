// Pure helpers for the "ทีมงาน" table on /settings: one row per person with
// their sign-in account(s), plus a row for each account that belongs to no
// one (the office TV). No server imports, so the rules are unit-tested.

import type { AppRole } from "@/lib/auth/roles";

export type TeamPersonInput = {
  id: string;
  displayName: string;
  position: string;
  email?: string;
  isActive: boolean;
  lineLinked: boolean;
};

export type TeamAccountInput = {
  id: string;
  email: string;
  username: string | null;
  role: AppRole;
  personId: string | null;
  displayName: string | null;
  lastSignInAt: string | null;
  suspended: boolean;
  lineLinked: boolean;
  lineLinkedAt: string | null;
};

export type TeamMember = {
  /** Stable React key: the person id, or acct:<id> for an account with no person. */
  key: string;
  personId: string | null;
  displayName: string;
  position: string;
  email: string | null;
  /** The person row is active (an account-only row counts as active). */
  personActive: boolean;
  lineLinked: boolean;
  lineLinkedAt: string | null;
  /** Gets the admin-side LINE messages (settings line_admin_person_ids). */
  watcher: boolean;
  accounts: TeamAccountInput[];
  /** Latest sign-in over this member's accounts. */
  lastSignInAt: string | null;
  /** Shown as ระงับ: the person is inactive, or every account is suspended. */
  suspended: boolean;
};

export function buildTeam(
  people: TeamPersonInput[],
  accounts: TeamAccountInput[],
  watcherIds: string[],
): TeamMember[] {
  const byPerson = new Map<string, TeamAccountInput[]>();
  const orphans: TeamAccountInput[] = [];
  const personIds = new Set(people.map((p) => p.id));
  for (const a of accounts) {
    if (a.personId && personIds.has(a.personId)) {
      byPerson.set(a.personId, [...(byPerson.get(a.personId) ?? []), a]);
    } else {
      orphans.push(a);
    }
  }
  const watchers = new Set(watcherIds);
  const latest = (list: TeamAccountInput[]) =>
    list
      .map((a) => a.lastSignInAt)
      .filter((t): t is string => Boolean(t))
      .sort()
      .at(-1) ?? null;

  const rows: TeamMember[] = people.map((p) => {
    const accs = byPerson.get(p.id) ?? [];
    return {
      key: p.id,
      personId: p.id,
      displayName: p.displayName,
      position: p.position,
      email: p.email ?? null,
      personActive: p.isActive,
      lineLinked: p.lineLinked,
      lineLinkedAt: accs.find((a) => a.lineLinkedAt)?.lineLinkedAt ?? null,
      watcher: watchers.has(p.id),
      accounts: accs,
      lastSignInAt: latest(accs),
      suspended: !p.isActive || (accs.length > 0 && accs.every((a) => a.suspended)),
    };
  });

  for (const a of orphans) {
    rows.push({
      key: `acct:${a.id}`,
      personId: null,
      displayName: a.displayName ?? (a.username ? `@${a.username}` : a.email),
      position: a.role === "display" ? "บัญชีจอทีวี" : "บัญชีที่ยังไม่ผูกกับรายชื่อ",
      email: null,
      personActive: true,
      lineLinked: false,
      lineLinkedAt: null,
      watcher: false,
      accounts: [a],
      lastSignInAt: a.lastSignInAt,
      suspended: a.suspended,
    });
  }

  // Working people first, by name; suspended next; accounts with no person last.
  const rank = (m: TeamMember) => (m.personId === null ? 2 : m.suspended ? 1 : 0);
  return rows.sort(
    (x, y) => rank(x) - rank(y) || x.displayName.localeCompare(y.displayName, "th"),
  );
}

/** Lowercase, no spaces; letters, digits and . _ - only; 3–30 long (so "+123" always
 * reaches Supabase's 6). Null when unusable. */
export function normalizeUsername(raw: unknown): string | null {
  const u = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(u) ? u : null;
}

/**
 * Initial password for a new account (owner's rule): the username itself, or
 * the username + "123" when that is shorter than Supabase's 6-character minimum.
 */
export function initialPassword(username: string): string {
  return username.length >= 6 ? username : `${username}123`;
}

// ---- matching a LINE name to a person (registration from the group) ---------

export type MatchCandidate = { id: string; displayName: string; usernames: string[] };

const TITLES = /^(นางสาว|น\.ส\.|นาง|นาย|ด\.ช\.|ด\.ญ\.|ว่าที่ร้อยตรี|ว่าที่ ร\.ต\.|\[ทดสอบ\])\s*/u;

/** Lowercase, Thai title and everything but letters, marks and digits removed. */
export function normalizeName(raw: string): string {
  let s = raw.trim().toLowerCase();
  // A name can carry two prefixes ("[ทดสอบ] นาย…").
  for (let i = 0; i < 3 && TITLES.test(s); i++) s = s.replace(TITLES, "");
  return s.replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

function firstName(displayName: string): string {
  let s = displayName.trim();
  for (let i = 0; i < 3 && TITLES.test(s); i++) s = s.replace(TITLES, "");
  return normalizeName(s.split(/\s+/)[0] ?? "");
}

/**
 * Best guess at who a LINE display name belongs to, for the admin's dropdown.
 * Exact match on username, first name or full name beats "contains"; a tie or
 * no match gives null (the admin picks by hand).
 */
export function suggestPerson(lineName: string, people: MatchCandidate[]): string | null {
  const name = normalizeName(lineName);
  if (name.length < 2) return null;
  // Words of the LINE name ("Pop😄Patompong" → pop, patompong). Partial matches
  // are judged per word, and only when the key covers most of that word, so a
  // short username ("pat") never matches inside a longer word ("patompong").
  let stripped = lineName.trim().toLowerCase();
  for (let i = 0; i < 3 && TITLES.test(stripped); i++) stripped = stripped.replace(TITLES, "");
  const words = stripped.split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length >= 2);
  let best = 0;
  let bestIds: string[] = [];
  for (const p of people) {
    const keys = [normalizeName(p.displayName), firstName(p.displayName), ...p.usernames.map(normalizeName)].filter(
      (k) => k.length >= 2,
    );
    let score = 0;
    for (const k of keys) {
      if (k === name) score = Math.max(score, 3);
      for (const w of words) {
        if (k === w) score = Math.max(score, 3);
        else if (
          k.length >= 3 &&
          w.length >= 3 &&
          (w.startsWith(k) || k.startsWith(w)) &&
          Math.min(k.length, w.length) / Math.max(k.length, w.length) >= 0.6
        ) {
          score = Math.max(score, 2);
        }
      }
    }
    if (score > best) {
      best = score;
      bestIds = [p.id];
    } else if (score > 0 && score === best) {
      bestIds.push(p.id);
    }
  }
  return best > 0 && bestIds.length === 1 ? bestIds[0] : null;
}

/** People an admin can attach a LINE account to: active, not suspended, no LINE yet. */
export function lineCandidates(team: TeamMember[]): MatchCandidate[] {
  return team
    .filter((m) => m.personId && m.personActive && !m.suspended && !m.lineLinked)
    .map((m) => ({
      id: m.personId as string,
      displayName: m.displayName,
      usernames: m.accounts.map((a) => a.username).filter((u): u is string => Boolean(u)),
    }));
}
