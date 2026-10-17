// Network-first service worker: always try for fresh data, but if you open the app with no signal
// you still see the last dashboard you loaded instead of an error page.
const CACHE = "pulse-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || url.pathname.startsWith("/_next/static/"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "/" : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === "navigate" ? "/" : req).then((r) => r || Response.error())),
  );
});
