// พิกัดงาน (3 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/maps.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { navigateUrl, normalizeMapInput } from "@/lib/maps";

test("coordinates become a maps link; directions from it", () => {
  const r = normalizeMapInput("15.7047, 100.1372");
  assert.deepEqual(r, { ok: true, url: "https://www.google.com/maps/search/?api=1&query=15.7047,100.1372" });
  assert.equal(navigateUrl((r as { url: string }).url), "https://www.google.com/maps/dir/?api=1&destination=15.7047%2C100.1372");
  assert.equal(normalizeMapInput("95, 100").ok, false);
});

test("maps links are kept, other links refused, empty is fine", () => {
  assert.deepEqual(normalizeMapInput("ดูที่นี่ https://maps.app.goo.gl/AbC123xyz"), { ok: true, url: "https://maps.app.goo.gl/AbC123xyz" });
  assert.equal(normalizeMapInput("https://www.google.com/maps/place/x/@15.7,100.1,17z").ok, true);
  assert.equal(normalizeMapInput("https://evil.example.com/maps").ok, false);
  assert.equal(normalizeMapInput("https://www.google.com/search?q=x").ok, false);
  assert.deepEqual(normalizeMapInput(""), { ok: true, url: null });
  assert.equal(navigateUrl("https://maps.app.goo.gl/AbC"), "https://maps.app.goo.gl/AbC");
});
