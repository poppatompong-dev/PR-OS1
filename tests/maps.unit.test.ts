// พิกัดงาน (3 Nov 2026).
//   npx -y tsx@4.19.2 --test tests/maps.unit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMetadata, navigateUrl, normalizeMapInput, parseMapPoints, pointButton, pointsFromMetadata } from "@/lib/maps";

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

test("several pins: cleaned, capped at 5, a lone old link still reads as one pin", () => {
  const r = parseMapPoints(JSON.stringify([{ label: "  เวที  ", lat: 15.7047123, lng: 100.1373456 }, { url: "https://maps.app.goo.gl/AbC" }]));
  assert.deepEqual(r, { ok: true, points: [{ label: "เวที", lat: 15.704712, lng: 100.137346 }, { label: "", url: "https://maps.app.goo.gl/AbC" }] });
  assert.equal(parseMapPoints(Array.from({ length: 6 }, () => ({ lat: 15, lng: 100 }))).ok, false);
  assert.equal(parseMapPoints([{ lat: 99, lng: 100 }]).ok, false);
  assert.equal(parseMapPoints([{ url: "https://evil.example.com" }]).ok, false);
  assert.deepEqual(parseMapPoints("", "15.7, 100.1"), { ok: true, points: [{ label: "", lat: 15.7, lng: 100.1 }] });
  assert.deepEqual(pointsFromMetadata({ map_url: "https://www.google.com/maps/search/?api=1&query=15.7,100.1" }), [{ label: "", lat: 15.7, lng: 100.1 }]);
  const meta = mapMetadata([{ label: "", lat: 15.7, lng: 100.1 }]);
  assert.equal(meta.map_url, "https://www.google.com/maps/search/?api=1&query=15.7,100.1");
  assert.deepEqual(pointsFromMetadata(meta), meta.map_points);
  assert.equal(pointButton({ label: "ลานจอดรถด้านหลังศาลากลางจังหวัด" }, 0, 2).length <= 20, true);
});
