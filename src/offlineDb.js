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

// Wraps a network-fetching function with an offline/wifi-aware cache.
// - Offline entirely: always serve cache (throws only if nothing cached yet).
// - Online but on cellular: serve cache if we have it (saves data); if the
//   cache is empty, fetch anyway so the app isn't blank on first load.
// - Online on wifi (or platform where wifi can't be detected): fetch fresh
//   and refresh the cache for next time offline/cellular.
export async function cachedFetch(key, fetchFn) {
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
