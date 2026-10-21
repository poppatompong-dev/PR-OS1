import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.PR_OS_BASE_URL ?? "https://pr-os1.vercel.app";
const get = (path) => fetch(`${baseUrl}${path}`, { redirect: "manual" });
const isRedirect = (status) => [301, 302, 303, 307, 308].includes(status);

// These checks hold whether the deployment is live (Supabase connected, app
// pages behind a login) or still in demo mode (no auth layer at all). The
// previous version asserted demo-mode text on the home page, so it was bound
// to fail the moment the site went live.

test("health check answers without a login and reaches its backend", async () => {
  const res = await get("/api/health");
  assert.equal(res.status, 200, `health answered ${res.status} ${res.headers.get("location") ?? ""}`);
  const body = await res.json();
  if (body.mode === "live") assert.equal(body.database, "connected", JSON.stringify(body));
  else assert.equal(body.mode, "mock", JSON.stringify(body));
});

test("the wall screen is public", async () => {
  const res = await get("/monitor");
  assert.equal(res.status, 200);
});

// Regression guard: these three were caught by the login redirect, which
// silently disabled offline mode and "Add to Home Screen" on the live site.
for (const [path, type] of [
  ["/manifest.json", /json/],
  ["/sw.js", /javascript/],
  ["/offline.html", /html/],
]) {
  test(`PWA file ${path} is served directly, never redirected`, async () => {
    const res = await get(path);
    assert.equal(res.status, 200, `${path} answered ${res.status} ${res.headers.get("location") ?? ""}`);
    assert.match(res.headers.get("content-type") ?? "", type);
  });
}

for (const path of ["/", "/login", "/schedule", "/events/new", "/reports", "/mobile/my-tasks", "/settings"]) {
  test(`app page ${path} renders, or redirects for a login`, async () => {
    const res = await get(path);
    if (res.status === 200) return;
    assert.ok(isRedirect(res.status), `${path} answered ${res.status}`);
    // Live: protected pages go to /login. Demo: /login itself goes home.
    assert.match(res.headers.get("location") ?? "", path === "/login" ? /\/$|\/\?/ : /\/login/);
  });
}

// ---- Flow guards added 21 Oct 2026 (loop-engineering review) ---------------
// Public, secret-free checks that the pieces the LINE workflow depends on are
// wired: a "done" that a script can check instead of someone's say-so.

test("the scheduler is alive (health reports it, never stale)", async () => {
  const body = await (await get("/api/health")).json();
  if (body.mode !== "live") return;
  assert.ok(body.scheduler, `no scheduler block: ${JSON.stringify(body)}`);
  assert.notEqual(body.scheduler.state, "stale", `scheduler stale: ${JSON.stringify(body.scheduler)}`);
  assert.notEqual(body.scheduler.state, "never", `scheduler never ran: ${JSON.stringify(body.scheduler)}`);
});

test("TV short link keeps its query", async () => {
  const res = await get("/tv?v=3d");
  assert.ok(isRedirect(res.status), `/tv answered ${res.status}`);
  assert.match(res.headers.get("location") ?? "", /\/monitor\?v=3d$/);
});

test("the LINE add-job form page is public", async () => {
  const res = await get("/liff/add-event");
  assert.equal(res.status, 200);
});

for (const [method, path] of [
  ["GET", "/api/liff/options"],
  ["POST", "/api/liff/events"],
  ["POST", "/api/notifications/process"],
  ["POST", "/api/line/webhook"],
]) {
  test(`${method} ${path} refuses a caller with no token / secret / signature`, async () => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      redirect: "manual",
      headers: { "content-type": "application/json", "x-line-signature": "bad" },
      body: method === "POST" ? "{}" : undefined,
    });
    assert.equal(res.status, 401, `${path} answered ${res.status}`);
  });
}

for (const path of ["/line/rich-menu.png", "/avatars/default.png", "/monitor/mascot-2.png"]) {
  test(`asset ${path} is served`, async () => {
    const res = await get(path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /image\/png/);
  });
}
