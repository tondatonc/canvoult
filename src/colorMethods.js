// Selectable methods for computing a can's representative ("avgColor") color.
// Pure functions only (no DOM), so they can be unit tested with `node --test`.

import { DEFAULT_SORT_SCOPE } from "./colorSort.js";
//
// The default method "current" reproduces the algorithm in use since v1.2.
// Other methods exist so an admin can compare them on real photos and pick
// the best one. Only signed-in admins ever use a non-default method; public
// visitors always get "current" (see getActiveColorMethodId).

export const COLOR_METHOD_STORAGE_KEY = "cv_color_method";
export const DEFAULT_COLOR_METHOD_ID = "current";

const WHITE_THRESHOLD = 235; // r,g,b all >= this counts as "white border"
const ALPHA_THRESHOLD = 16;  // pixels with alpha below this are skipped

// kind:
//   "histogram" — quantise pixels into buckets, weighted mean of the top N buckets
//   "mean"      — weighted mean of every remaining pixel
//   "median"    — per-channel median of every remaining pixel
// sample: canvas size the photo is downscaled to (the "scale" knob)
// bucket: quantisation step per channel (smaller = finer colour distinctions)
// topN / power: how many buckets to blend, and how strongly the biggest wins
// chromaBoost: extra weight for saturated buckets (0 = off)
// weight (mean kind): "uniform" or "saturation"
export const COLOR_METHODS = [
  {
    id: "current",
    label: "Current",
    description: "Baseline in use since v1.2: count²-weighted average of the 3 most common colour buckets, 60px sample.",
    kind: "histogram", sample: 60, bucket: 24, topN: 3, power: 2, chromaBoost: 0,
  },
  {
    id: "fine",
    label: "Fine histogram",
    description: "Finer buckets, 120px sample, blends the top 5. More nuance, but more sensitive to noise and texture.",
    kind: "histogram", sample: 120, bucket: 12, topN: 5, power: 2, chromaBoost: 0,
  },
  {
    id: "coarse",
    label: "Coarse histogram",
    description: "Big buckets, 40px sample, blends the top 2 with linear counts. Smoothest and most forgiving of JPEG noise.",
    kind: "histogram", sample: 40, bucket: 48, topN: 2, power: 1, chromaBoost: 0,
  },
  {
    id: "vivid",
    label: "Vivid histogram",
    description: "Current method, but saturated buckets get extra weight so a vivid can on a dark background isn't swallowed by the background.",
    kind: "histogram", sample: 60, bucket: 24, topN: 3, power: 2, chromaBoost: 3,
  },
  {
    id: "mean",
    label: "Plain mean",
    description: "Average of every remaining pixel, equal weight. Simple, but muddies multi-colour labels.",
    kind: "mean", sample: 60, weight: "uniform",
  },
  {
    id: "mean-sat",
    label: "Saturation mean",
    description: "Average of every remaining pixel, where more saturated pixels count more.",
    kind: "mean", sample: 60, weight: "saturation",
  },
  {
    id: "median",
    label: "Median",
    description: "Per-channel median of every remaining pixel. Ignores outlier pixels such as a small label stripe.",
    kind: "median", sample: 60,
  },
];

export function getColorMethod(id) {
  return COLOR_METHODS.find(m => m.id === id) || COLOR_METHODS.find(m => m.id === DEFAULT_COLOR_METHOD_ID);
}

// Only signed-in admins may use a method other than the default. Public
// visitors (no cv_admin flag) always get "current", so their data is unaffected
// by whatever an admin tried in the same browser before signing out.
export function getActiveColorMethodId() {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_COLOR_METHOD_ID;
    if (localStorage.getItem("cv_admin") !== "1") return DEFAULT_COLOR_METHOD_ID;
    const id = localStorage.getItem(COLOR_METHOD_STORAGE_KEY);
    return COLOR_METHODS.some(m => m.id === id) ? id : DEFAULT_COLOR_METHOD_ID;
  } catch {
    return DEFAULT_COLOR_METHOD_ID;
  }
}

export function setActiveColorMethodId(id) {
  if (!COLOR_METHODS.some(m => m.id === id)) return;
  try { localStorage.setItem(COLOR_METHOD_STORAGE_KEY, id); } catch { /* storage unavailable */ }
}

const hex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
const toHex = (r, g, b) => `#${hex(r)}${hex(g)}${hex(b)}`;

// Collect the pixels that count as "the can": opaque and not white border.
// Each entry carries its colour and chroma (max − min channel, 0-255).
function collectPixels(data) {
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < ALPHA_THRESHOLD) continue;
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) continue;
    pixels.push({ r, g, b, c: Math.max(r, g, b) - Math.min(r, g, b) });
  }
  return pixels;
}

function histogramColor(pixels, m) {
  const buckets = new Map();
  for (const p of pixels) {
    const key = ((p.r / m.bucket) | 0) * 10000 + ((p.g / m.bucket) | 0) * 100 + ((p.b / m.bucket) | 0);
    let bk = buckets.get(key);
    if (!bk) { bk = { count: 0, r: 0, g: 0, b: 0, c: 0 }; buckets.set(key, bk); }
    bk.count++; bk.r += p.r; bk.g += p.g; bk.b += p.b; bk.c += p.c;
  }
  const scored = [...buckets.values()].map(bk => {
    const avgChroma = bk.c / bk.count;
    const weight = Math.pow(bk.count, m.power) * (1 + m.chromaBoost * (avgChroma / 255));
    return { bk, weight };
  });
  scored.sort((a, b) => b.weight - a.weight);
  let wr = 0, wg = 0, wb = 0, wSum = 0;
  for (const { bk, weight } of scored.slice(0, m.topN)) {
    wr += (bk.r / bk.count) * weight;
    wg += (bk.g / bk.count) * weight;
    wb += (bk.b / bk.count) * weight;
    wSum += weight;
  }
  return toHex(wr / wSum, wg / wSum, wb / wSum);
}

function meanColor(pixels, m) {
  let wr = 0, wg = 0, wb = 0, wSum = 0;
  for (const p of pixels) {
    const weight = m.weight === "saturation" ? p.c / 255 + 0.02 : 1; // +0.02 so grey pixels still count a little
    wr += p.r * weight; wg += p.g * weight; wb += p.b * weight; wSum += weight;
  }
  return toHex(wr / wSum, wg / wSum, wb / wSum);
}

function medianOf(values) {
  const sorted = Uint8Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianColor(pixels) {
  return toHex(
    medianOf(pixels.map(p => p.r)),
    medianOf(pixels.map(p => p.g)),
    medianOf(pixels.map(p => p.b)),
  );
}

// Compute "#rrggbb" from RGBA pixel data (already sampled at method.sample px).
// Returns null when no usable pixels remain.
export function computeColorFromPixels(data, methodOrId) {
  const m = typeof methodOrId === "string" ? getColorMethod(methodOrId) : methodOrId;
  const pixels = collectPixels(data);
  if (pixels.length === 0) return null;
  if (m.kind === "histogram") return histogramColor(pixels, m);
  if (m.kind === "mean") return meanColor(pixels, m);
  if (m.kind === "median") return medianColor(pixels);
  return null;
}

// Count votes per method from rows shaped { method }. Unknown methods are ignored.
export function tallyVotes(rows) {
  const tally = Object.fromEntries(COLOR_METHODS.map(m => [m.id, 0]));
  for (const r of rows) if (r && tally[r.method] !== undefined) tally[r.method]++;
  return tally;
}

// ─── Configs: a colour method plus the sort switches, as one votable thing ───
const HUE_LABEL = { 0: "red", 30: "crimson", 60: "magenta" };
const GREY_LABEL = { 5: "strict", 12: "normal", 25: "loose" };
const WITHIN_LABEL = { "light-asc": "dark→light", "light-desc": "light→dark", "sat-desc": "vivid first", "sat-asc": "muted first" };
const GREY_ORDER_LABEL = { asc: "black→white", desc: "white→black" };

// Fill in any missing switch with its default (old votes may store partial scopes).
export function normalizeScope(scope) {
  return { ...DEFAULT_SORT_SCOPE, ...(scope || {}) };
}

// Stable identity for a config, so the same combination always groups together.
export function configKey(methodId, scope) {
  const s = normalizeScope(scope);
  return [methodId, s.hueStart, s.greyThreshold, s.within, s.greyOrder].join("|");
}

// Human label, e.g. "Median · red · normal greys" or "Fine histogram · crimson · loose greys · vivid first".
export function configLabel(methodId, scope) {
  const s = normalizeScope(scope);
  const parts = [
    getColorMethod(methodId).label,
    HUE_LABEL[s.hueStart] || `${s.hueStart}°`,
    `${GREY_LABEL[s.greyThreshold] || `s<${s.greyThreshold}`} greys`,
  ];
  if (s.within !== DEFAULT_SORT_SCOPE.within) parts.push(WITHIN_LABEL[s.within] || s.within);
  if (s.greyOrder !== DEFAULT_SORT_SCOPE.greyOrder) parts.push(GREY_ORDER_LABEL[s.greyOrder] || s.greyOrder);
  return parts.join(" · ");
}

// Group vote rows ({ method, scope }) by config. Returns best-first:
// [{ key, method, scope, label, count }]. Unknown methods are ignored.
export function tallyConfigs(rows) {
  const byKey = new Map();
  for (const r of rows) {
    if (!r || !COLOR_METHODS.some(m => m.id === r.method)) continue;
    const key = configKey(r.method, r.scope);
    const entry = byKey.get(key) || {
      key, method: r.method, scope: normalizeScope(r.scope),
      label: configLabel(r.method, r.scope), count: 0,
    };
    entry.count++;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
