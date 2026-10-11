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
