// In-memory stand-in for the Supabase admin client, enough for the bot handlers:
// from(table).select/insert/upsert/update/delete with eq/neq/in/is/gte/lte/like,
// order/limit, single/maybeSingle, { count, head }. Filters on "a.b" read nested
// objects (joined rows are stored already joined). Unique keys per table are
// enforced so claimRun sees 23505 on a repeat.

type Row = Record<string, any>;
const UNIQUE: Record<string, string> = { notification_runs: "run_key", line_chat_state: "line_user_id" };

const get = (r: Row, path: string) => path.split(".").reduce((v: any, k) => (v == null ? v : Array.isArray(v) ? v[0]?.[k] : v[k]), r);

export function fakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  const t = (name: string) => (tables[name] ??= []);

  function from(name: string) {
    let op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let head = false;
    let wantCount = false;
    const filters: Array<(r: Row) => boolean> = [];
    let order: { col: string; asc: boolean } | null = null;
    let lim: number | null = null;
    let single: "one" | "maybe" | null = null;

    const run = () => {
      const rows = t(name);
      if (op === "insert" || op === "upsert") {
        const list = Array.isArray(payload) ? payload : [payload!];
        const key = UNIQUE[name];
        const out: Row[] = [];
        for (const p of list) {
          const row = { id: p.id ?? crypto.randomUUID(), changed_at: new Date().toISOString(), ...p };
          const i = key ? rows.findIndex((r) => r[key] === row[key]) : -1;
          if (i >= 0 && op === "insert") return { data: null, error: { code: "23505", message: "duplicate key" }, count: null };
          if (i >= 0) rows[i] = { ...rows[i], ...row };
          else rows.push(row);
          out.push(row);
        }
        return { data: single ? out[0] : out, error: null, count: null };
      }
      let hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        hit.forEach((r) => Object.assign(r, payload));
        return { data: hit, error: null, count: null };
      }
      if (op === "delete") {
        tables[name] = rows.filter((r) => !hit.includes(r));
        return { data: hit, error: null, count: null };
      }
      if (order) hit = [...hit].sort((a, b) => (get(a, order!.col) > get(b, order!.col) ? 1 : -1) * (order!.asc ? 1 : -1));
      if (lim !== null) hit = hit.slice(0, lim);
      const count = wantCount ? hit.length : null;
      if (head) return { data: null, error: null, count };
      if (single === "one") return hit.length ? { data: hit[0], error: null, count } : { data: null, error: { code: "PGRST116", message: "no rows" }, count };
      if (single === "maybe") return { data: hit[0] ?? null, error: null, count };
      return { data: hit, error: null, count };
    };

    const q: any = {
      select: (_c?: string, o?: { count?: string; head?: boolean }) => { if (op === "select") { head = !!o?.head; wantCount = !!o?.count; } return q; },
      insert: (p: Row | Row[]) => { op = "insert"; payload = p; return q; },
      upsert: (p: Row | Row[]) => { op = "upsert"; payload = p; return q; },
      update: (p: Row) => { op = "update"; payload = p; return q; },
      delete: () => { op = "delete"; return q; },
      eq: (c: string, v: any) => { filters.push((r) => get(r, c) === v); return q; },
      neq: (c: string, v: any) => { filters.push((r) => get(r, c) !== v); return q; },
      in: (c: string, v: any[]) => { filters.push((r) => v.includes(get(r, c))); return q; },
      is: (c: string, v: any) => { filters.push((r) => (get(r, c) ?? null) === v); return q; },
      gte: (c: string, v: any) => { filters.push((r) => get(r, c) >= v); return q; },
      lte: (c: string, v: any) => { filters.push((r) => get(r, c) <= v); return q; },
      gt: (c: string, v: any) => { filters.push((r) => get(r, c) > v); return q; },
      lt: (c: string, v: any) => { filters.push((r) => get(r, c) < v); return q; },
      like: (c: string, v: string) => { const re = new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`); filters.push((r) => re.test(String(get(r, c) ?? ""))); return q; },
      not: () => q,
      or: () => q,
      order: (col: string, o?: { ascending?: boolean }) => { order = { col, asc: o?.ascending !== false }; return q; },
      limit: (n: number) => { lim = n; return q; },
      single: () => { single = "one"; return q; },
      maybeSingle: () => { single = "maybe"; return q; },
      then: (res: (v: any) => any, rej?: (e: any) => any) => Promise.resolve(run()).then(res, rej),
    };
    return q;
  }
  return { from, tables, rpc: async () => ({ data: null, error: null }) } as any;
}

/** Replace global fetch; records every call and answers LINE/Telegram APIs. */
export function captureFetch(botUsername = "pros_test_bot") {
  const calls: Array<{ url: string; body: any }> = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: any) => {
    const u = String(url);
    let body: any = null;
    try { body = init?.body ? JSON.parse(init.body) : null; } catch { body = init?.body; }
    calls.push({ url: u, body });
    const ok = (result: any) => new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
    if (u.includes("api.telegram.org") && u.endsWith("/getMe")) return ok({ ok: true, result: { username: botUsername } });
    if (u.includes("api.telegram.org")) return ok({ ok: true, result: { message_id: 1 } });
    return ok({});
  }) as any;
  return { calls, restore: () => { globalThis.fetch = real; } };
}
