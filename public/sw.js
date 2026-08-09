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

const SHELL_CACHE = "canvault-shell-v4";
const IMAGE_CACHE = "canvault-images-v2";
const DEBUG_CACHE = "canvault-debug-log";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Records what happened to each request (cached / skipped / errored) into
// its own cache entry, readable later without needing devtools — just
// fetch this cache's "log" entry and parse the JSON. Keeps only the most
// recent 60 entries.
async function logEvent(entry) {
  try {
    const cache = await caches.open(DEBUG_CACHE);
    const existing = await cache.match("log");
    let arr = [];
    if (existing) {
      try {
        arr = await existing.json();
      } catch {
        arr = [];
      }
    }
    arr.push({ t: new Date().toISOString(), ...entry });
    if (arr.length > 60) arr = arr.slice(-60);
    await cache.put(
      "log",
      new Response(JSON.stringify(arr), { headers: { "Content-Type": "application/json" } })
    );
  } catch (e) {
    // never let logging itself break anything
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== IMAGE_CACHE && k !== DEBUG_CACHE)
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
          if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
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
        // IMPORTANT: res.ok is true for 206 Partial Content too, but the
        // Cache API throws if you try to store a 206 response. Only cache
        // clean, full 200 responses — otherwise this write silently fails
        // (fire-and-forget, unhandled rejection) while the page itself
        // keeps working fine online, so nothing ever gets cached for
        // offline use even though everything looks fine when connected.
        if (res && res.status === 200) {
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put(req, res.clone()))
            .then(() => logEvent({ url: url.pathname, status: res.status, cached: true }))
            .catch((e) =>
              logEvent({ url: url.pathname, status: res.status, cached: false, err: String(e) })
            );
        } else {
          logEvent({
            url: url.pathname,
            status: res ? res.status : "no-response",
            cached: false,
            reason: "status-not-200",
          });
        }
        return res;
      })
      .catch(async (e) => {
        logEvent({ url: url.pathname, cached: false, reason: "fetch-threw", err: String(e) });
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = (await cache.match("/index.html")) || (await cache.match("/"));
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
