// Map and UI wiring for the Historical Atlas. Pure logic lives in
// atlas.js so it can be unit-tested with `node --test`.

const API_BASE = "http://localhost:8080/api/v1";

// Shown while the very first request is still in flight.
const EMPTY = { type: "FeatureCollection", features: [] };

// Marked as ticks under the year slider -- the moments where the map
// visibly redraws itself.
const KEY_YEARS = [
  { year: 1914, label: "1914 — First World War begins" },
  { year: 1918, label: "1918 — Armistice; new states emerge" },
  { year: 1939, label: "1939 — Second World War begins" },
  { year: 1945, label: "1945 — War ends in Europe" },
  { year: 1960, label: "1960 — Year of Africa: 17 new states" },
  { year: 1991, label: "1991 — Dissolution of the Soviet Union" }
];

const slider = document.getElementById("slider");
const yearLabel = document.getElementById("year");
const playButton = document.getElementById("play");
const speedButton = document.getElementById("speed");
const searchInput = document.getElementById("search");

const YEAR_MIN = Number(slider.min);
const YEAR_MAX = Number(slider.max);

// A shared link like index.html#1918 opens the map at that year.
const initialYear = parseYearHash(location.hash, YEAR_MIN, YEAR_MAX);
if (initialYear !== null) {
  slider.value = initialYear;
  yearLabel.textContent = initialYear;
}

// No basemap tiles -- see PROJECT.md section 5 for why. The
// background layer is just an ocean color; the country polygons
// themselves are the entire map.
const map = new maplibregl.Map({
  container: "map",
  center: [10, 50],
  zoom: 3,
  // The CC BY-NC-SA license wants the attribution visible where the
  // data is shown -- on the map itself, not only on the Sources page.
  attributionControl: {
    compact: false,
    customAttribution:
      '<a href="sources.html">CShapes 2.0 © ETH Zürich · CC BY-NC-SA 4.0</a>'
  },
  style: {
    version: 8,
    projection: { type: "globe" },
    // Symbol layers (the country name labels) need a glyph server
    // to rasterize text from; OpenFreeMap hosts the Noto fonts.
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#a5c3da" } }
    ]
  }
});
window.atlasMap = map; // for debugging and browser-driven tests

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

// The most recently loaded FeatureCollection; country search runs
// against it, so search finds countries that exist in the shown year.
let currentGeoJson = EMPTY;
let lastFetchedZoom = null;

function bordersUrl(year, zoom) {
  return `${API_BASE}/borders?date=${year}-01-01&zoom=${zoom}`;
}

// MapLibre needs the map to finish initializing before you can add
// sources or layers to it -- "load" fires once that's done.
map.on("load", () => {
  // Permanent background layer: the union of every border that has
  // EVER existed in the dataset, regardless of year. Without this,
  // land that hasn't been formalized as a state YET (e.g. much of
  // Africa before the 1890s) is indistinguishable from open ocean --
  // both are just the background color. This is still "the polygons
  // are the map", not an external basemap: it's derived from the
  // exact same CShapes data, just unioned across all time instead of
  // filtered to one date.
  map.addSource("landmass", { type: "geojson", data: "landmass.geojson" });
  map.addLayer({
    id: "landmass-fill",
    type: "fill",
    source: "landmass",
    paint: { "fill-color": "#d8d2c4" }
  });

  // generateId gives every feature a numeric id, which feature-state
  // (the hover highlight below) needs to address countries by.
  map.addSource("borders", { type: "geojson", data: EMPTY, generateId: true });
  map.addSource("labels", { type: "geojson", data: EMPTY });

  map.addLayer({
    id: "borders-fill",
    type: "fill",
    source: "borders",
    paint: { "fill-color": ["get", "fill"] }
  });

  map.addLayer({
    id: "borders-line",
    type: "line",
    source: "borders",
    paint: {
      "line-color": "#7d6b55",
      "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.5, 6, 1.2]
    }
  });

  // Outline of the country under the mouse pointer. Driven by
  // feature-state rather than setFilter: a filter change makes MapLibre
  // re-evaluate the whole layer on the CPU (visible as the outline
  // lagging behind the pointer), while a feature-state flip is a cheap
  // GPU-side update. Each country is one MultiPolygon feature, so all
  // its parts highlight together.
  map.addLayer({
    id: "hover-line",
    type: "line",
    source: "borders",
    paint: {
      "line-color": "#4a3f30",
      "line-width": 2,
      "line-opacity": ["case",
        ["boolean", ["feature-state", "hover"], false], 1, 0]
    }
  });

  map.addLayer({
    id: "country-labels",
    type: "symbol",
    source: "labels",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-transform": "uppercase",
      "text-letter-spacing": 0.12,
      // labelSize encodes country area, so big countries get big
      // labels; zoom scales the whole range up as you approach.
      "text-size": ["interpolate", ["linear"], ["zoom"],
        2, ["*", ["get", "labelSize"], 0.8],
        7, ["*", ["get", "labelSize"], 1.6]
      ]
    },
    paint: {
      "text-color": "#4a3f30",
      "text-halo-color": "rgba(250, 247, 241, 0.85)",
      "text-halo-width": 1.4
    }
  });

  map.on("mousemove", "borders-fill", (event) => {
    map.getCanvas().style.cursor = "pointer";
    setHoveredCountry(event.features[0].id);
  });
  map.on("mouseleave", "borders-fill", () => {
    map.getCanvas().style.cursor = "";
    setHoveredCountry(null);
  });

  map.on("click", "borders-fill", (event) => {
    openCountryPopup(event.features[0].properties, event.lngLat);
  });

  // The backend simplifies geometry for the zoom the request named, so
  // zooming in without touching the slider must refetch -- otherwise
  // you inspect coarse low-zoom geometry up close.
  map.on("zoomend", () => {
    if (Math.round(map.getZoom()) !== lastFetchedZoom) {
      scheduleLoad(200);
    }
  });

  loadYear(slider.value);
});

// Only one popup at a time -- otherwise a search while a click-popup
// is open stacks a second one on top of it.
let popup = null;

// Feature-state bookkeeping for the hover outline: turn the previous
// country off, the new one on. Skips the (frequent) case where the
// mouse moved but stayed inside the same country.
let hoveredId = null;

function setHoveredCountry(id) {
  if (id === hoveredId) {
    return;
  }
  if (hoveredId !== null) {
    map.setFeatureState({ source: "borders", id: hoveredId }, { hover: false });
  }
  if (id !== null) {
    map.setFeatureState({ source: "borders", id }, { hover: true });
  }
  hoveredId = id;
}

function openCountryPopup(properties, lngLat) {
  if (popup) {
    popup.remove();
  }
  const name = document.createElement("div");
  name.className = "popup-name";
  name.textContent = properties.name;

  const meta = document.createElement("div");
  meta.className = "popup-meta";
  meta.textContent = formatPeriod(properties.validFrom, properties.validTo)
    + " · " + properties.source;

  const container = document.createElement("div");
  container.append(name, meta);

  popup = new maplibregl.Popup({ closeButton: false, maxWidth: "280px" })
    .setLngLat(lngLat)
    .setDOMContent(container)
    .addTo(map);
}

// Debounce: without this, dragging the slider fires one HTTP request
// per pixel moved. "pending" holds the scheduled call so we can
// cancel it every time the slider moves again, and only the LAST
// one -- delay ms after the user stops -- actually runs.
let pending;
function scheduleLoad(delay) {
  clearTimeout(pending);
  pending = setTimeout(() => loadYear(slider.value), delay);
}

function setYear(year) {
  const clamped = Math.min(YEAR_MAX, Math.max(YEAR_MIN, Number(year)));
  slider.value = clamped;
  yearLabel.textContent = clamped;
  scheduleLoad(120);
}

slider.addEventListener("input", () => {
  stopPlayback(); // grabbing the slider takes over from autoplay
  yearLabel.textContent = slider.value;
  scheduleLoad(120);
});

// ---- Autoplay ----------------------------------------------------------
// One year per tick until the end of the dataset. Stopped by the
// button, by dragging the slider, or by running out of years. The
// speed button cycles 1x / 2x / 4x.

const BASE_TICK_MS = 300;
const SPEEDS = [1, 2, 4];
let speedIndex = 0;
let playTimer = null;

function stopPlayback() {
  clearInterval(playTimer);
  playTimer = null;
  playButton.innerHTML = "&#9654;";
  playButton.setAttribute("aria-label", "Play");
}

function startPlayback() {
  if (Number(slider.value) >= YEAR_MAX) {
    slider.value = YEAR_MIN;
    yearLabel.textContent = YEAR_MIN;
  }
  clearInterval(playTimer);
  playTimer = setInterval(() => {
    const next = Number(slider.value) + 1;
    if (next > YEAR_MAX) {
      stopPlayback();
      return;
    }
    slider.value = next;
    yearLabel.textContent = next;
    loadYear(next);
    prefetchYear(next + 1);
  }, BASE_TICK_MS / SPEEDS[speedIndex]);
  playButton.innerHTML = "&#10074;&#10074;";
  playButton.setAttribute("aria-label", "Pause");
}

playButton.addEventListener("click", () => {
  if (playTimer) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

speedButton.addEventListener("click", () => {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  speedButton.textContent = SPEEDS[speedIndex] + "×";
  if (playTimer) {
    startPlayback(); // re-arm the interval at the new tempo
  }
});

// Warm the browser's HTTP cache with the year the playback loop needs
// next; the API's immutable cache headers make the real request for it
// a cache hit, so the animation doesn't stutter on the network.
function prefetchYear(year) {
  if (year <= YEAR_MAX) {
    fetch(bordersUrl(year, Math.round(map.getZoom()))).catch(() => {});
  }
}

// ---- Keyboard ----------------------------------------------------------
// Arrows step one year, space toggles playback. Skipped when typing in
// the search box. Space is claimed globally (preventDefault) even when
// a button has focus -- otherwise the browser "clicks" that button
// instead and play/pause only works with nothing focused.

document.addEventListener("keydown", (event) => {
  if (event.target === searchInput) {
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    if (event.target === slider) {
      stopPlayback();
      return; // the slider itself steps and fires "input"
    }
    event.preventDefault();
    stopPlayback();
    setYear(Number(slider.value) + (event.key === "ArrowRight" ? 1 : -1));
  } else if (event.key === " ") {
    event.preventDefault();
    if (playTimer) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }
});

// ---- Country search ----------------------------------------------------

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.value = "";
    searchInput.blur();
    return;
  }
  if (event.key !== "Enter") {
    return;
  }
  const found = findCountry(currentGeoJson, searchInput.value);
  if (!found) {
    searchInput.classList.add("not-found");
    return;
  }
  const anchor = featureAnchor(found);
  map.flyTo({ center: anchor.point, zoom: Math.max(map.getZoom(), 4) });
  openCountryPopup(found.properties,
    { lng: anchor.point[0], lat: anchor.point[1] });
});
searchInput.addEventListener("input", () => {
  searchInput.classList.remove("not-found");
});

// ---- Timeline tick marks -----------------------------------------------

const ticks = document.getElementById("ticks");
for (const { year, label } of KEY_YEARS) {
  const tick = document.createElement("span");
  tick.className = "tick";
  tick.title = label;
  tick.style.left = (100 * (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) + "%";
  ticks.appendChild(tick);
}

// ---- Data loading ------------------------------------------------------

// The year display pulses while any request is in flight (see the
// #controls.loading rule). A counter, not a boolean: quick slider
// moves can have several loads overlapping.
let activeLoads = 0;
const controls = document.getElementById("controls");

async function loadYear(year) {
  const zoom = Math.round(map.getZoom());
  activeLoads++;
  controls.classList.add("loading");
  try {
    const response = await fetch(bordersUrl(year, zoom));
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    const geoJson = await response.json();
    for (const feature of geoJson.features) {
      feature.properties.fill = colorFor(feature.properties.name);
    }
    currentGeoJson = geoJson;
    lastFetchedZoom = zoom;
    // generateId hands out fresh ids on every setData, so a lingering
    // hover state could attach itself to a different country.
    map.removeFeatureState({ source: "borders" });
    hoveredId = null;
    map.getSource("borders").setData(geoJson);
    map.getSource("labels").setData(labelPoints(geoJson));
    // Keep the year in the URL so the current view can be shared or
    // reloaded; replaceState avoids polluting browser history with
    // one entry per year of an autoplay run.
    history.replaceState(null, "", "#" + year);
  } catch (error) {
    console.error("Could not load borders:", error);
  } finally {
    activeLoads--;
    if (activeLoads === 0) {
      controls.classList.remove("loading");
    }
  }
}
