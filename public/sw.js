/*
 * PR-OS offline support — deliberately conservative.
 *
 * Read-only offline: pages the user has already opened come back from the
 * cache when the network is gone. Nothing is written through the worker;
 * acknowledgements are queued in the page (see useAckQueue) so they go
 * through the normal authenticated request when the signal returns.
 *
 * Navigations are network-first, so a new deploy always wins while online
 * and the office never has to be told to "clear the cache". Hashed build
 * assets are cache-first because their URL changes whenever they do.
 */

const VERSION = "pr-os-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isBuildAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever touch our own GETs. Server actions, the Supabase API and every
  // other write must reach the network untouched or fail honestly.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The monitor screen is a live display; a cached copy of it would be a lie.
  if (url.pathname.startsWith("/monitor")) return;

  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached || caches.match(OFFLINE_URL);
        }),
    );
  }
});
