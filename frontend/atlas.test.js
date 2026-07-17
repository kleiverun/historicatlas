// Unit tests for the pure helpers in atlas.js. Runs on Node's built-in
// test runner -- no dependencies:  node --test  (from this directory).

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  PALETTE, colorFor, ringArea, ringCentroid,
  featureAnchor, labelPoints, parseYearHash, findCountry, formatPeriod
} = require("./atlas.js");

// A closed square ring from (x, y) with the given side length,
// counter-clockwise, as GeoJSON coordinates.
function square(x, y, side) {
  return [[x, y], [x + side, y], [x + side, y + side], [x, y + side], [x, y]];
}

function multiPolygonFeature(name, ...rings) {
  return {
    type: "Feature",
    geometry: { type: "MultiPolygon", coordinates: rings.map((r) => [r]) },
    properties: { name }
  };
}

test("colorFor is stable and always picks from the palette", () => {
  assert.equal(colorFor("France"), colorFor("France"));
  for (const name of ["France", "Sweden", "Austria-Hungary", ""]) {
    assert.ok(PALETTE.includes(colorFor(name)), name);
  }
});

test("ringArea of a unit square is 1", () => {
  assert.equal(Math.abs(ringArea(square(3, 7, 1))), 1);
});

test("ringArea sign flips with winding order", () => {
  const ccw = square(0, 0, 2);
  const cw = [...ccw].reverse();
  assert.equal(ringArea(ccw), -ringArea(cw));
});

test("ringCentroid of a square is its center", () => {
  const [cx, cy] = ringCentroid(square(10, 20, 4));
  assert.ok(Math.abs(cx - 12) < 1e-9);
  assert.ok(Math.abs(cy - 22) < 1e-9);
});

test("featureAnchor picks the largest polygon of a multipolygon", () => {
  // Mainland at (0,0), a tiny overseas island far away at (50,50):
  // the label must sit on the mainland.
  const feature = multiPolygonFeature("X", square(0, 0, 10), square(50, 50, 0.1));
  const { point } = featureAnchor(feature);
  assert.ok(Math.abs(point[0] - 5) < 1e-9);
  assert.ok(Math.abs(point[1] - 5) < 1e-9);
});

test("featureAnchor handles plain Polygon geometry too", () => {
  const feature = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [square(0, 0, 2)] },
    properties: { name: "P" }
  };
  const { point } = featureAnchor(feature);
  assert.ok(Math.abs(point[0] - 1) < 1e-9);
});

test("bigger countries get bigger labels, within bounds", () => {
  const tiny = featureAnchor(multiPolygonFeature("Tiny", square(0, 0, 0.05)));
  const huge = featureAnchor(multiPolygonFeature("Huge", square(0, 0, 40)));
  assert.ok(tiny.labelSize < huge.labelSize);
  assert.ok(tiny.labelSize >= 8);
  assert.ok(huge.labelSize <= 17);
});

test("labelPoints yields one named point per country", () => {
  const collection = {
    type: "FeatureCollection",
    features: [
      multiPolygonFeature("A", square(0, 0, 1)),
      multiPolygonFeature("B", square(5, 5, 2))
    ]
  };
  const points = labelPoints(collection);
  assert.equal(points.features.length, 2);
  assert.deepEqual(points.features.map((f) => f.properties.name), ["A", "B"]);
  for (const f of points.features) {
    assert.equal(f.geometry.type, "Point");
    assert.equal(typeof f.properties.labelSize, "number");
  }
});

test("parseYearHash accepts #YYYY and clamps to the dataset range", () => {
  assert.equal(parseYearHash("#1918", 1886, 2019), 1918);
  assert.equal(parseYearHash("#1700", 1886, 2019), 1886);
  assert.equal(parseYearHash("#9999", 1886, 2019), 2019);
});

test("parseYearHash rejects garbage", () => {
  assert.equal(parseYearHash("", 1886, 2019), null);
  assert.equal(parseYearHash(null, 1886, 2019), null);
  assert.equal(parseYearHash("#abc", 1886, 2019), null);
  assert.equal(parseYearHash("#19x8", 1886, 2019), null);
  assert.equal(parseYearHash("#12345", 1886, 2019), null);
});

test("findCountry is case-insensitive and prefers exact matches", () => {
  const collection = {
    type: "FeatureCollection",
    features: [
      multiPolygonFeature("South Sudan", square(0, 0, 1)),
      multiPolygonFeature("Sudan", square(5, 5, 1))
    ]
  };
  assert.equal(findCountry(collection, "sudan").properties.name, "Sudan");
  assert.equal(findCountry(collection, "SOUTH sud").properties.name, "South Sudan");
  assert.equal(findCountry(collection, "atlantis"), null);
  assert.equal(findCountry(collection, "   "), null);
  assert.equal(findCountry(null, "Sudan"), null);
});

test("formatPeriod shows years and leaves an open end for null", () => {
  assert.equal(formatPeriod("1908-04-06", "1924-01-01"), "1908 – 1924");
  assert.equal(formatPeriod("1908-04-06", null), "1908 – ");
  assert.equal(formatPeriod(null, null), "? – ");
});
