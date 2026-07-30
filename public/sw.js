/**
 * Degis Scanner service worker.
 * Caches the app shell so the scanner opens with no connectivity at all.
 * Ticket data lives in IndexedDB, not here — this only keeps the UI available.
 */
const CACHE = "degis-scanner-v1";
const SHELL = ["/scan", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache API traffic — stale pairing or sync data would be dangerous
  if (url.pathname.startsWith("/api/")) return;
  if (!url.pathname.startsWith("/scan") && !url.pathname.startsWith("/_next")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/scan")))
  );
});
