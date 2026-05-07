// db.js — Supabase database layer for CanVault
// All data (cans, wishlist, wall photos) is stored in Supabase and shared across all devices.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Low-level fetch wrapper — no SDK needed, just REST calls
async function query(table, options = {}) {
  const { method = "GET", body, params = {} } = options;

  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const search = new URLSearchParams(params).toString();
  if (search) url += "?" + search;

  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error (${res.status}): ${err}`);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ─── CANS ────────────────────────────────────────────────────────────────────

export async function getCans() {
  return query("cans", { params: { order: "added_at.desc", select: "*" } });
}

export async function upsertCan(can) {
  // Map JS camelCase → DB snake_case
  const row = {
    id: can.id,
    name: can.name,
    image_url: can.image || null,
    tags: can.tags,           // stored as text[] in Postgres
    added_at: new Date(can.addedAt).toISOString(),
  };
  return query("cans", {
    method: "POST",
    params: { on_conflict: "id" },
    body: row,
    // Upsert via POST + on_conflict
  });
}

export async function deleteCan(id) {
  return query(`cans?id=eq.${id}`, { method: "DELETE" });
}

// ─── WISHLIST ─────────────────────────────────────────────────────────────────

export async function getWishlist() {
  return query("wishlist", { params: { order: "added_at.desc", select: "*" } });
}

export async function upsertWish(wish) {
  const row = {
    id: wish.id,
    name: wish.name,
    image_url: wish.image || null,
    tags: wish.tags,
    note: wish.note || null,
    added_at: new Date(wish.addedAt).toISOString(),
  };
  return query("wishlist", {
    method: "POST",
    params: { on_conflict: "id" },
    body: row,
  });
}

export async function deleteWish(id) {
  return query(`wishlist?id=eq.${id}`, { method: "DELETE" });
}

// ─── WALL PHOTOS ──────────────────────────────────────────────────────────────

export async function getWallPhotos() {
  return query("wall_photos", { params: { order: "added_at.desc", select: "*" } });
}

export async function addWallPhoto(photo) {
  const row = {
    id: photo.id,
    image_url: photo.image,
    caption: photo.caption || null,
    added_at: new Date(photo.addedAt).toISOString(),
  };
  return query("wall_photos", { method: "POST", body: row });
}

export async function deleteWallPhoto(id) {
  return query(`wall_photos?id=eq.${id}`, { method: "DELETE" });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Convert DB row (snake_case) back to JS object (camelCase)
export function rowToCan(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image_url || null,
    tags: row.tags || [],
    addedAt: new Date(row.added_at).getTime(),
  };
}

export function rowToWish(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image_url || null,
    tags: row.tags || [],
    note: row.note || "",
    addedAt: new Date(row.added_at).getTime(),
  };
}

export function rowToPhoto(row) {
  return {
    id: row.id,
    image: row.image_url,
    caption: row.caption || "",
    addedAt: new Date(row.added_at).getTime(),
  };
}

export const isConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;
