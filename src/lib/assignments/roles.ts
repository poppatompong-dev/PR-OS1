// One person, several duties on one job (owner, 26 Oct 2026, asked by คุณกุ๊ก).
// Still one assignment row per person per job, so one LINE card and one
// acknowledgement. role_id = the first duty, extra_role_ids = the rest
// (migration 0016). Pure helpers, covered by tests/multi-role.unit.test.ts.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valid ids, first-picked order kept, no repeats. */
export function normalizeRoleIds(values: unknown): string[] {
  const list = Array.isArray(values) ? values : values == null ? [] : [values];
  const out: string[] = [];
  for (const v of list) {
    const id = String(v ?? "").trim();
    if (UUID.test(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Columns for the assignments row. Caller makes sure ids is not empty. */
export function roleColumns(ids: string[]): { role_id: string; extra_role_ids: string[] } {
  return { role_id: ids[0], extra_role_ids: ids.slice(1) };
}

/** Same duties, ignoring order? (no change card when nothing changed) */
export function sameRoles(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * Rows from a form ({personId, roleIds}) merged per person: the same person
 * picked twice ends up as one row with both sets of duties.
 */
export function mergeAssignees(rows: Array<{ personId: string; roleIds: string[] }>) {
  const byPerson = new Map<string, string[]>();
  for (const r of rows) {
    const prev = byPerson.get(r.personId) ?? [];
    byPerson.set(r.personId, normalizeRoleIds([...prev, ...r.roleIds]));
  }
  return [...byPerson].map(([personId, roleIds]) => ({ personId, roleIds }));
}
