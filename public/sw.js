// sw.js — CanVault service worker
// Strategy:
//   - Supabase & /api/* requests: never intercepted (db.js handles its own
//     offline/wifi caching via IndexedDB; API calls need to fail normally
//     when offline so app code's own .catch() handlers can react).
//   - Images (can photos, wall photos): cache-first, so once a photo has
//     been viewed it's available offline without re-downloading.
//   - Everything else (app shell — JS/CSS/HTML/fonts): network-first with
//     cache fallback, so the app itself opens offline after first visit,
//     but still picks up new deploys whenever a connection is available.

const SHELL_CACHE = "canvault-shell-v1";
const IMAGE_CACHE = "canvault-images-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never touch Supabase or our own API routes — let them fail/succeed
  // naturally so the app's existing offline handling (db.js) applies.
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) {
    return;
  }

  const isImage =
    req.destination === "image" ||
    url.hostname.includes("blob.vercel-storage.com") ||
    url.hostname.includes("flagcdn.com");

  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // App shell: network-first, cache fallback, offline SPA fallback to /index.html
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await cache.match("/index.html");
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
