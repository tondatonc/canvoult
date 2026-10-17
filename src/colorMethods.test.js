// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLOR_METHODS,
  DEFAULT_COLOR_METHOD_ID,
  computeColorFromPixels,
  getColorMethod,
} from "./colorMethods.js";

// Build RGBA data from a list of [r,g,b,a] pixels.
const rgba = (...px) => Uint8ClampedArray.from(px.flat());
const rep = (n, px) => Array(n).fill(px);

// Parse "#rrggbb" to [r,g,b].
const parse = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

test("method ids are unique and the default exists", () => {
  const ids = COLOR_METHODS.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(DEFAULT_COLOR_METHOD_ID));
  assert.equal(getColorMethod("nope").id, DEFAULT_COLOR_METHOD_ID);
});

test("every method returns the exact colour for a solid-colour can", () => {
  const data = rgba(...rep(400, [200, 40, 30, 255]));
  for (const m of COLOR_METHODS) {
    assert.equal(computeColorFromPixels(data, m), "#c8281e", m.id);
  }
});

test("white border and transparent pixels are ignored, all-white gives null", () => {
  const allWhite = rgba(...rep(50, [255, 255, 255, 255]));
  const allClear = rgba(...rep(50, [10, 200, 10, 0]));
  for (const m of COLOR_METHODS) {
    assert.equal(computeColorFromPixels(allWhite, m), null, m.id);
    assert.equal(computeColorFromPixels(allClear, m), null, m.id);
  }
  // a white border around a red centre yields red for every method
  const mixed = rgba(...rep(100, [255, 255, 255, 255]), ...rep(100, [255, 0, 0, 255]));
  for (const m of COLOR_METHODS) assert.equal(computeColorFromPixels(mixed, m), "#ff0000", m.id);
});

test("median ignores a small outlier stripe, plain mean does not", () => {
  // 9 pure-red pixels plus 1 blue pixel
  const data = rgba(...rep(9, [255, 0, 0, 255]), [0, 0, 255, 255]);
  assert.equal(computeColorFromPixels(data, "median"), "#ff0000");
  const [r, , b] = parse(computeColorFromPixels(data, "mean"));
  assert.ok(r < 250 && b > 20, "mean should be pulled towards blue");
});

test("saturation-weighted mean stays closer to red than the plain mean", () => {
  const data = rgba(...rep(9, [255, 0, 0, 255]), [128, 128, 128, 255]);
  const plain = parse(computeColorFromPixels(data, "mean"));
  const sat = parse(computeColorFromPixels(data, "mean-sat"));
  assert.ok(sat[0] > plain[0], "saturation weighting should pull red up");
});

test("vivid method pulls a vivid can on a dark background towards its colour", () => {
  // 20 black background pixels, 6 vivid orange pixels
  const data = rgba(...rep(20, [0, 0, 0, 255]), ...rep(6, [255, 128, 0, 255]));
  const [curR] = parse(computeColorFromPixels(data, "current"));
  const [vivR] = parse(computeColorFromPixels(data, "vivid"));
  assert.ok(curR < 30, `current should be swallowed by black, got r=${curR}`);
  assert.ok(vivR > curR * 2, `vivid should lean further towards orange: current r=${curR}, vivid r=${vivR}`);
});

test("current histogram still favours a dominant bucket over a minor colour", () => {
  // 9 red + 1 blue: count² weighting keeps the result red-dominant
  const data = rgba(...rep(9, [255, 0, 0, 255]), [0, 0, 255, 255]);
  const [r, , b] = parse(computeColorFromPixels(data, "current"));
  assert.ok(r > 240 && b < 10, `expected near-red, got r=${r} b=${b}`);
});

test("finer histogram separates two close shades that coarse merges", () => {
  // two shades of red 20 apart: same coarse bucket, different fine buckets
  const data = rgba(...rep(20, [200, 0, 0, 255]), ...rep(20, [220, 0, 0, 255]));
  const coarse = computeColorFromPixels(data, "coarse");
  const fine = computeColorFromPixels(data, "fine");
  assert.equal(coarse, "#d20000"); // merged, averaged across both shades
  assert.ok(parse(fine)[0] >= 200 && parse(fine)[0] <= 220);
});

test("every method's sample size is a sensible scale", () => {
  for (const m of COLOR_METHODS) {
    assert.ok(m.sample >= 20 && m.sample <= 200, `${m.id} sample ${m.sample}`);
  }
});

test("empty pixel data returns null for every method", () => {
  for (const m of COLOR_METHODS) assert.equal(computeColorFromPixels(new Uint8ClampedArray(0), m), null, m.id);
});
