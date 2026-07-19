// Pure helpers for the Historical Atlas frontend: no DOM, no MapLibre,
// no fetch. Loaded both by index.html (as a plain script) and by
// `node --test` (see atlas.test.js) -- hence the module.exports guard
// at the bottom.

// Muted pastels in the style of a classic political atlas. Each
// country gets a stable color from its name (hash below), so a
// country keeps its color as the year slider moves.
const PALETTE = [
  "#f4d7a1", "#e9b7a8", "#cfd9a8", "#b8d0c8",
  "#d9c4dd", "#f0c199", "#c8cfe3", "#e3d3b1"
];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// Shoelace formula; degrees squared, only used to compare rings and
// rank countries by size, so the unit never matters.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function ringCentroid(ring) {
  const area = ringArea(ring);
  let cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    cx += (ring[i][0] + ring[i + 1][0]) * cross;
    cy += (ring[i][1] + ring[i + 1][1]) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

// Where to anchor a country's label: the centroid of its largest
// polygon (mainland, not overseas islands), plus a base text size
// derived from area so Russia isn't labelled as small as Andorra.
function featureAnchor(feature) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;

  let largest = null;
  let largestArea = -1;
  for (const polygon of polygons) {
    const area = Math.abs(ringArea(polygon[0]));
    if (area > largestArea) {
      largestArea = area;
      largest = polygon[0];
    }
  }

  const magnitude = Math.log10(Math.max(largestArea, 1e-4));
  const labelSize = Math.min(17, Math.max(8, 10 + 1.6 * (magnitude + 2)));

  return { point: ringCentroid(largest), labelSize };
}

// One point feature per country, for the symbol layer. Computed here
// rather than letting MapLibre label the polygons directly: MapLibre
// tiles GeoJSON sources internally, so large polygons would get one
// label per tile they cross.
function labelPoints(geoJson) {
  const features = geoJson.features.map((feature) => {
    const anchor = featureAnchor(feature);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: anchor.point },
      properties: { name: feature.properties.name, labelSize: anchor.labelSize }
    };
  });
  return { type: "FeatureCollection", features };
}

// Bounding box of all polygons in a feature: [[minLng, minLat], [maxLng, maxLat]].
function featureBounds(feature) {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

// [Feature 7] Which country names appeared and disappeared between
// two FeatureCollections. Fuels the "what changed" toast.
function diffCountries(oldGeoJson, newGeoJson) {
  const oldNames = new Set(oldGeoJson.features.map((f) => f.properties.name));
  const newNames = new Set(newGeoJson.features.map((f) => f.properties.name));
  return {
    added: [...newNames].filter((n) => !oldNames.has(n)).sort(),
    removed: [...oldNames].filter((n) => !newNames.has(n)).sort()
  };
}

// "#1918" -> 1918, clamped to the dataset range so a shared link with
// an out-of-range year still lands somewhere valid. Anything that
// isn't a four-ish digit number -> null (caller keeps its default).
function parseYearHash(hash, min, max) {
  const match = /^#(\d{1,4})$/.exec(hash || "");
  if (!match) {
    return null;
  }
  return Math.min(max, Math.max(min, Number(match[1])));
}

// Case-insensitive lookup; an exact name match wins over a substring
// match ("Sudan" should find Sudan, not South Sudan).
function findCountry(geoJson, query) {
  const needle = (query || "").trim().toLowerCase();
  if (!needle || !geoJson) {
    return null;
  }
  let partial = null;
  for (const feature of geoJson.features) {
    const name = feature.properties.name.toLowerCase();
    if (name === needle) {
      return feature;
    }
    if (partial === null && name.includes(needle)) {
      partial = feature;
    }
  }
  return partial;
}

// "1908-04-06", "1924-01-01" -> "1908 – 1924". A null validTo means
// the border is still current at the end of the dataset.
function formatPeriod(validFrom, validTo) {
  const from = validFrom ? String(validFrom).slice(0, 4) : "?";
  const to = validTo ? String(validTo).slice(0, 4) : "";
  return `${from} – ${to}`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PALETTE, colorFor, ringArea, ringCentroid,
    featureAnchor, featureBounds, labelPoints, parseYearHash, findCountry, formatPeriod,
    diffCountries
  };
}
