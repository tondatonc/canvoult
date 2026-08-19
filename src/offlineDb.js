// offlineDb.js — small IndexedDB key/value wrapper used to cache Supabase
// data (cans, wishlist, pinned, tag_meta) for offline browsing, and to
// gate re-fetching behind a "wifi only" check on Android.
//
// This file is additive/isolated: nothing else in the app touches
// IndexedDB directly, so it can't break existing logic — worst case,
// idbGet/idbSet quietly fail and the app behaves exactly as before.

const DB_NAME = "canvault-offline";
const DB_VERSION = 1;
const STORE = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSet(key, value) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}

// Best-effort detection of "on wifi" — only reliable on Android Chrome.
// Everywhere else (iOS Safari, desktop) the Network Information API is
// unavailable, so we default to "treat as wifi" (i.e. always allow syncing)
// rather than silently withholding updates on platforms we can't detect.
export function isOnWifi() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn || !conn.type) return true;
  return conn.type === "wifi";
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// Estimates how much space the offline backup (IndexedDB + Cache Storage)
// is using on this device, via the StorageManager API. This reports usage
// for the whole origin (not just our IndexedDB store), but since offline
// mode's SW cache + IndexedDB dominate this app's storage footprint, it's
// a good proxy for "how big is my backup". Returns null on browsers that
// don't support the API (e.g. older Safari) — callers should treat null
// as "unknown", not zero.
export async function getStorageUsage() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage ?? null, quota: quota ?? null };
  } catch {
    return null;
  }
}

// ─── OPT-IN TOGGLE ──────────────────────────────────────────────────────────
// Offline mode is OFF by default so it doesn't quietly use storage on every
// visitor's device — only people who explicitly turn it on (via the toggle
// in the menu) get a service worker, Cache Storage entries, or IndexedDB
// data at all.
const OFFLINE_ENABLED_KEY = "cv_offline_enabled";

export function isOfflineEnabled() {
  try {
    return localStorage.getItem(OFFLINE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOfflineEnabled(value) {
  try {
    localStorage.setItem(OFFLINE_ENABLED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

// Registers the service worker (with the one-time reload-on-first-control
// behavior so the app shell actually gets cached). Only ever called when
// the user has explicitly turned offline mode on.
export function setupOffline() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("cv_sw_reloaded")) return;
    sessionStorage.setItem("cv_sw_reloaded", "1");
    window.location.reload();
  });
}

// Undoes everything offline-related: unregisters the service worker,
// deletes all canvault-* Cache Storage entries, and deletes the whole
// IndexedDB database — so turning offline mode off actually frees the
// storage instead of just hiding the UI for it.
export async function teardownOffline() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("canvault-")).map((n) => caches.delete(n))
      );
    }
  } catch {
    // ignore
  }
  try {
    if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase(DB_NAME);
  } catch {
    // ignore
  }
}

// Wraps a network-fetching function with an offline/wifi-aware cache.
// - Offline entirely: always serve cache (throws only if nothing cached yet).
// - Online but on cellular: serve cache if we have it (saves data); if the
//   cache is empty, fetch anyway so the app isn't blank on first load.
// - Online on wifi (or platform where wifi can't be detected): fetch fresh
//   and refresh the cache for next time offline/cellular.
export async function cachedFetch(key, fetchFn) {
  if (!isOfflineEnabled()) {
    return fetchFn();
  }

  if (!isOnline()) {
    const cached = await idbGet(key);
    if (cached !== null) return cached;
    throw new Error(`Offline and no cached data for "${key}" yet`);
  }

  if (!isOnWifi()) {
    const cached = await idbGet(key);
    if (cached !== null) return cached;
  }

  const fresh = await fetchFn();
  idbSet(key, fresh); // fire and forget
  idbSet("lastSync", Date.now()); // fire and forget
  return fresh;
}
