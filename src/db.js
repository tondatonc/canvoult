// db.js — Supabase database layer for CanVault
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function base(table) {
  return `${SUPABASE_URL}/rest/v1/${table}`;
}

// ─── CANS ────────────────────────────────────────────────────────────────────

export async function getCans() {
  return request(`${base("cans")}?order=added_at.desc&select=*`, {
    headers: headers(),
  });
}

export async function upsertCan(can) {
  return request(base("cans"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      id: can.id,
      name: can.name,
      image_url: can.image || null,
      tags: can.tags,
      note: can.note || null,
      price: can.price || null,
      countries: can.countries || [],
      added_at: new Date(can.addedAt).toISOString(),
      date_unknown: can.dateUnknown || false,
    }),
  });
}

export async function deleteCan(id) {
  return request(`${base("cans")}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=minimal" }),
  });
}

// ─── WISHLIST ─────────────────────────────────────────────────────────────────

export async function getWishlist() {
  return request(`${base("wishlist")}?order=added_at.desc&select=*`, {
    headers: headers(),
  });
}

export async function upsertWish(wish) {
  return request(base("wishlist"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      id: wish.id,
      name: wish.name,
      image_url: wish.image || null,
      tags: wish.tags,
      note: wish.note || null,
      price: wish.price || null,
      countries: wish.countries || [],
      added_at: new Date(wish.addedAt).toISOString(),
    }),
  });
}

export async function deleteWish(id) {
  return request(`${base("wishlist")}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=minimal" }),
  });
}

// ─── WALL PHOTOS ──────────────────────────────────────────────────────────────

export async function getWallPhotos() {
  return request(`${base("wall_photos")}?order=added_at.desc&select=*`, {
    headers: headers(),
  });
}

export async function addWallPhoto(photo) {
  return request(base("wall_photos"), {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      id: photo.id,
      image_url: photo.image,
      caption: photo.caption || null,
      added_at: new Date(photo.addedAt).toISOString(),
    }),
  });
}

export async function deleteWallPhoto(id) {
  return request(`${base("wall_photos")}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=minimal" }),
  });
}

export async function updateWallPhoto(photo) {
  return request(`${base("wall_photos")}?id=eq.${encodeURIComponent(photo.id)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      image_url: photo.image,
      caption: photo.caption || null,
    }),
  });
}

// ─── PINNED ───────────────────────────────────────────────────────────────────
// Table: pinned (can_id text, type text)  PK: (can_id, type)
// type = 'can' | 'wish'

export async function getPinned() {
  const rows = await request(`${base("pinned")}?select=can_id,type`, {
    headers: headers(),
  });
  return rows || [];
}

export async function pinItem(id, type = "can") {
  return request(base("pinned"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({ can_id: id, type }),
  });
}

export async function unpinItem(id, type = "can") {
  return request(
    `${base("pinned")}?can_id=eq.${encodeURIComponent(id)}&type=eq.${type}`,
    { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) }
  );
}

// ─── ROW CONVERTERS ───────────────────────────────────────────────────────────

export const rowToCan = r => ({
  id: r.id,
  name: r.name,
  image: r.image_url || null,
  tags: r.tags || [],
  note: r.note || "",
  price: r.price || "",
  countries: r.countries || [],
  addedAt: new Date(r.added_at).getTime(),
  dateUnknown: r.date_unknown || false,
});

export const rowToWish = r => ({
  id: r.id,
  name: r.name,
  image: r.image_url || null,
  tags: r.tags || [],
  note: r.note || "",
  price: r.price || "",
  countries: r.countries || [],
  addedAt: new Date(r.added_at).getTime(),
});

export const rowToPhoto = r => ({
  id: r.id,
  image: r.image_url,
  caption: r.caption || "",
  addedAt: new Date(r.added_at).getTime(),
});

export const isConfigured = () => !!(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  SUPABASE_URL !== "undefined" &&
  SUPABASE_KEY !== "undefined"
);
