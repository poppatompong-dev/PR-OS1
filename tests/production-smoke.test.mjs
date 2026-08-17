import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.PR_OS_BASE_URL ?? "https://pr-os1.vercel.app";

test("mock-mode production dashboard renders without a server exception", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /ภาพรวมระบบ PR-OS/);
});

for (const path of [
  "/schedule",
  "/events/evt_005",
  "/events/new",
  "/reports",
  "/monitor",
  "/mobile/my-tasks",
  "/settings",
]) {
  test(`mock-mode production page ${path} responds successfully`, async () => {
    const response = await fetch(`${baseUrl}${path}`);

    assert.equal(response.status, 200);
  });
}
