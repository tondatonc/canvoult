// Pure color-sorting helpers used by the "sort by color" option.
// Kept free of React/DOM imports so they can be unit tested with `node --test`.

// Cans with a saturation below this (0-100 scale) are treated as grayscale.
export const GRAYSCALE_SATURATION_THRESHOLD = 12;

// Degrees the hue wheel is rotated so the spectrum starts at crimson/pink-red
// (~330°) instead of exactly 0°.
export const HUE_ROTATION = 30;

// Convert "#rrggbb" to [h, s, l] (h in 0-360, s/l in 0-100). Returns null for
// invalid input, so callers can push colorless cans to the end of a sort.
export function hexToHsl(hex) {
  if (!hex || typeof hex !== "string") return null;
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

// Sort key for "by color": group into hue buckets (so reds stay with reds,
// blues with blues, etc.) then order by lightness within a bucket. Grayscale
// cans (very low saturation) are bucketed separately and ordered black→white
// so they don't scatter randomly between hue groups (hue is meaningless at s≈0).
export function colorSortKey(hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const [h, s, l] = hsl;
  if (s < GRAYSCALE_SATURATION_THRESHOLD) return [1, 0, l]; // grayscale bucket, after all hued colors
  return [0, (h + HUE_ROTATION) % 360, l];
}

// Comparator over two "#rrggbb" strings for the color sort. Colorless (invalid)
// values sort last; two colorless values compare equal (caller adds a tie-break).
export function compareColorHex(hexA, hexB) {
  const ka = colorSortKey(hexA), kb = colorSortKey(hexB);
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
}

// ─── Sort scope (admin switches) ─────────────────────────────────────────────
// A scope bundles the knobs that change how colours are ordered. DEFAULT_SORT_SCOPE
// reproduces the ordering used since v1.3.2 exactly.
//   hueStart:       degrees added to the hue wheel, so the spectrum starts at this hue.
//                   0 = red first, 30 = crimson first (default), 60 = magenta first.
//   greyThreshold:  saturation below which a colour counts as grey (5 strict, 12 normal, 25 loose).
//   within:         order inside one hue bucket: "light-asc" (dark→light, default),
//                   "light-desc", "sat-desc" (vivid first), "sat-asc" (muted first).
//   greyOrder:      "asc" (black→white, default) or "desc".
export const DEFAULT_SORT_SCOPE = {
  hueStart: HUE_ROTATION,
  greyThreshold: GRAYSCALE_SATURATION_THRESHOLD,
  within: "light-asc",
  greyOrder: "asc",
};

export function colorSortKeyWith(hex, scope = DEFAULT_SORT_SCOPE) {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const [h, s, l] = hsl;
  if (s < scope.greyThreshold) {
    return [1, 0, scope.greyOrder === "desc" ? -l : l];
  }
  let within;
  switch (scope.within) {
    case "light-desc": within = -l; break;
    case "sat-desc": within = -s; break;
    case "sat-asc": within = s; break;
    default: within = l; // "light-asc"
  }
  return [0, (h + scope.hueStart) % 360, within];
}

export function compareColorHexWith(hexA, hexB, scope = DEFAULT_SORT_SCOPE) {
  const ka = colorSortKeyWith(hexA, scope), kb = colorSortKeyWith(hexB, scope);
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
}

// The colour a can contributes to a given method's sort. Cans saved before
// multi-method support have no colorMethods, so they fall back to avgColor.
// Cans that have been processed but lack this method return null (sorted last).
export function colorValueOf(can, methodId) {
  const m = can.colorMethods;
  if (!m) return can.avgColor || null;
  return m[methodId] || null;
}
