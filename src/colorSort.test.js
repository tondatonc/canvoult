// Run with: npm test   (uses Node's built-in test runner, no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hexToHsl,
  colorSortKey,
  compareColorHex,
  GRAYSCALE_SATURATION_THRESHOLD,
  HUE_ROTATION,
} from "./colorSort.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const toHex = (r, g, b) =>
  "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");

// HSL (h 0-360, s/l 0-100) → "#rrggbb", used to generate full hue spectrums.
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// Sort a list of hex strings with the same comparator the app uses.
const sortHexes = hexes => [...hexes].sort(compareColorHex);

// Per-channel reference aggregators for the median-vs-average comparison.
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ─── hexToHsl ───────────────────────────────────────────────────────────────

test("hexToHsl converts primary colors", () => {
  assert.deepEqual(hexToHsl("#ff0000").map(v => Math.round(v)), [0, 100, 50]);
  assert.deepEqual(hexToHsl("#00ff00").map(v => Math.round(v)), [120, 100, 50]);
  assert.deepEqual(hexToHsl("#0000ff").map(v => Math.round(v)), [240, 100, 50]);
});

test("hexToHsl gives zero saturation for pure grays", () => {
  const [, s] = hexToHsl("#808080");
  assert.equal(s, 0);
  assert.equal(hexToHsl("#000000")[2], 0);
  assert.equal(hexToHsl("#ffffff")[2], 100);
});

test("hexToHsl rejects invalid input (short hex, junk, empty)", () => {
  assert.equal(hexToHsl("#fff"), null); // only 6-digit hex is accepted
  assert.equal(hexToHsl("zzzzzz"), null);
  assert.equal(hexToHsl(""), null);
  assert.equal(hexToHsl(null), null);
  assert.equal(hexToHsl(undefined), null);
});

test("hexToHsl accepts hex without the leading #", () => {
  assert.deepEqual(hexToHsl("ff0000"), hexToHsl("#ff0000"));
});

// ─── colorSortKey: spectrum and buckets ─────────────────────────────────────

test("hue rotation is applied so the spectrum starts at crimson/pink-red", () => {
  assert.equal(HUE_ROTATION, 30);
  // pure red (hue 0) moves to 30
  assert.equal(Math.round(colorSortKey("#ff0000")[1]), 30);
  // crimson (hue ~348) wraps to ~18, i.e. near the start of the spectrum
  assert.ok(colorSortKey("#dc143c")[1] < colorSortKey("#ff8000")[1]);
});

test("pink-red (hue 330-360) sorts before red, not at the very end", () => {
  const pinkRed = hslToHex(345, 100, 50);
  const magenta = hslToHex(300, 100, 50);
  const sorted = sortHexes([magenta, "#ff0000", pinkRed]);
  assert.equal(sorted[0], pinkRed);
  assert.equal(sorted[sorted.length - 1], magenta);
});

test("the spectrum seam sits at hue 330: just above starts it, just below ends it", () => {
  // hues just over 330 wrap past the rotation and lead the spectrum
  const justAbove = hslToHex(335, 100, 50);
  // hues just under 330 land at the end, after magenta
  const justBelow = hslToHex(325, 100, 50);
  const sorted = sortHexes([justBelow, "#ff0000", justAbove]);
  assert.equal(sorted[0], justAbove);
  assert.equal(sorted[sorted.length - 1], justBelow);
});

test("full hue wheel in 30° steps sorts from rose through red, orange, ... to purple", () => {
  const hues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 345];
  const hexes = hues.map(h => hslToHex(h, 100, 50));
  const sorted = sortHexes(hexes);
  // expected order: 345 (pink-red, start), 0, 30, 60, ..., 300 (end)
  const expectedHues = [345, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
  assert.deepEqual(sorted, expectedHues.map(h => hslToHex(h, 100, 50)));
});

test("grayscale cans go after every hued can", () => {
  const sorted = sortHexes(["#808080", "#0000ff", "#ffffff", "#ff0000", "#000000"]);
  assert.deepEqual(sorted.slice(0, 2), ["#ff0000", "#0000ff"]);
  // grays come last, ordered black → white by lightness
  assert.deepEqual(sorted.slice(2), ["#000000", "#808080", "#ffffff"]);
});

test("within one hue bucket, darker shades sort before lighter shades", () => {
  const sorted = sortHexes(["#ff8080", "#800000", "#ff0000"]);
  assert.deepEqual(sorted, ["#800000", "#ff0000", "#ff8080"]);
});

test("colorless (invalid) values always sort last", () => {
  assert.equal(compareColorHex(null, "#ff0000"), 1);
  assert.equal(compareColorHex("#ff0000", null), -1);
  assert.equal(compareColorHex(null, "#fff"), 0);
  assert.equal(compareColorHex("#ff0000", "#00ff00") < 0, true);
});

// ─── sensitivity ────────────────────────────────────────────────────────────

test("grayscale threshold is 12 (saturation scale 0-100)", () => {
  assert.equal(GRAYSCALE_SATURATION_THRESHOLD, 12);
});

test("slightly tinted gray (s≈7) still lands in the grayscale bucket", () => {
  const [, s] = hexToHsl("#806e6e");
  assert.ok(s < GRAYSCALE_SATURATION_THRESHOLD);
  assert.equal(colorSortKey("#806e6e")[0], 1);
});

test("just past the threshold (s≈12.3) is treated as a hued color", () => {
  const [, s] = hexToHsl("#806464");
  assert.ok(s >= GRAYSCALE_SATURATION_THRESHOLD);
  assert.equal(colorSortKey("#806464")[0], 0);
});

test("a one-step RGB change across the threshold flips the bucket", () => {
  // #807070 (s≈6.7) is grayscale; #806464 (s≈12.3) is hued
  assert.equal(colorSortKey("#807070")[0], 1);
  assert.equal(colorSortKey("#806464")[0], 0);
  // so a near-gray hued can sorts before the gray one
  assert.ok(compareColorHex("#806464", "#807070") < 0);
});

test("tiny RGB noise inside a hue keeps near-identical colors adjacent", () => {
  const sorted = sortHexes(["#00ff00", "#0000ff", "#01fe01", "#00fe00"]);
  // the three greens stay together, blue stays after them
  assert.deepEqual(sorted.slice(0, 3).sort(), ["#00fe00", "#00ff00", "#01fe01"].sort());
  assert.equal(sorted[3], "#0000ff");
});

// ─── median vs average aggregation ──────────────────────────────────────────
// CanVault's computeAvgColor currently uses a count²-weighted mean of the top
// histogram buckets. These tests use a plain per-channel mean and median as a
// reference to show how an outlier pixel pulls a mean-based color, so a future
// switch to median can be judged against real behaviour.

// 9 pure-red pixels plus 1 blue outlier pixel (say, a blue label stripe)
const pixels = [
  ...Array(9).fill([255, 0, 0]),
  [0, 0, 255],
];

test("mean of channels is pulled by a single outlier pixel", () => {
  const avg = toHex(
    mean(pixels.map(p => p[0])),
    mean(pixels.map(p => p[1])),
    mean(pixels.map(p => p[2])),
  );
  // averaged color is a darker, bluish red — not the true dominant red
  const [h, , l] = hexToHsl(avg);
  assert.ok(l < 50, `mean lightness should drop below 50, got ${l}`);
  assert.ok(h > 340 || h < 10, `mean stays in the red range, got hue ${h}`);
  // because of that shift, the mean-based color sorts before pure red
  assert.ok(compareColorHex(avg, "#ff0000") < 0);
});

test("median of channels ignores the outlier and matches the dominant red", () => {
  const med = toHex(
    median(pixels.map(p => p[0])),
    median(pixels.map(p => p[1])),
    median(pixels.map(p => p[2])),
  );
  assert.equal(med, "#ff0000");
  assert.equal(compareColorHex(med, "#ff0000"), 0);
});

test("median is more stable than mean when an outlier is added", () => {
  const withOutlier = [...pixels, [0, 0, 255], [0, 0, 255]]; // 2 more blue pixels
  const meanShift = Math.abs(mean(withOutlier.map(p => p[2])) - mean(pixels.map(p => p[2])));
  const medianShift = Math.abs(median(withOutlier.map(p => p[2])) - median(pixels.map(p => p[2])));
  assert.ok(medianShift < meanShift, `median shift ${medianShift} should be < mean shift ${meanShift}`);
});
