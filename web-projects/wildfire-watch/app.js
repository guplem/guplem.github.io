// DOM and Leaflet glue. Every rule the map draws with lives in the pure modules
// (world.js, cluster.js, fireModel.js, alerts.js, geo.js, weather.js,
// sources.js, feed.js, freshness.js); this file only fetches and renders.
// Leaflet is loaded as a classic script before this module, as the global `L`.
//
// Two modes (mode.js): "real" reads live sources, "demo" reads mockData.js.
// Both produce the same fire shape (world.js), so one render path serves both.

import { MTG_ONLY, TOWNS, PROTECTED_AREAS, DEMO_LOCATION, windGrid } from "./mockData.js";
import {
  CONFIDENCE_COLORS, WIND_BANDS, DANGER_LEVELS, confidenceColor, frpToPixels, windBand, fireDanger,
  spreadEllipse, ellipsePolygon, pastRadiusKm, currentRadiusKm,
} from "./fireModel.js";
import { impactAlerts, protectedAreaFact, findTown, formatKm } from "./alerts.js";
import { nearest, nearestIndex } from "./geo.js";
import { formatAge, freshnessLine, realFreshnessLine, clockTime } from "./freshness.js";
import { readMode, modeSearch, feedUrl } from "./mode.js";
import { demoFires, realFires, inBounds, MODE_CONFIG } from "./world.js";
import { readFeed } from "./feed.js";
import { footprintAt } from "./cluster.js";
import { sourceByKey } from "./firms.js";
import { openMeteoUrl, parseOpenMeteo, meanWeather, gridPoints } from "./weather.js";
import {
  EFFIS, naturaQueryUrl, parseNatura, burntAreasUrl, parseBurntAreas, fwiDate, fwiLegendUrl, geocodingUrl, parseGeocoding,
} from "./sources.js";
import { readJson, writeJson, projectKey } from "../cloud-storage/localStore.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { say } from "./i18n.js";

const PROJECT = "wildfire-watch";
const THEME_KEY = projectKey(PROJECT, "theme");
const H = 3_600_000;
const $ = (id) => document.getElementById(id);
const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const people = (n) => `${Number(n).toLocaleString("en")} residents`;

const MODE = readMode(location.search);
const REAL = MODE === "real";
const PAST_STEPS = MODE_CONFIG[MODE].pastSteps;
/** A feed older than this means the copy job is late, and the page says so. */
const STALE_FEED_MS = 2 * H;
/** Real mode draws spread shapes and loads weather for at most this many fires in view. */
const VIEW_LIMIT = 60;

document.body.dataset.mode = MODE;
for (const link of document.querySelectorAll("[data-mode-link]")) {
  link.href = `./${modeSearch(location.search, link.dataset.modeLink)}`;
  if (link.dataset.modeLink === MODE) link.setAttribute("aria-current", "page");
}

// Demo freshness timestamps are fixed relative to page load, so the demo reads the same every visit.
const LOADED = Date.now();
const DEMO_UPDATED = {
  deepfire: LOADED - 30_000,
  mtg: LOADED - 6 * 60_000,
  weather: LOADED - 6 * 60_000,
  elmfire: LOADED - 40 * 60_000,
};
const realAt = { newestPass: null, feedBuilt: null, weather: null };

// ---- Theme -----------------------------------------------------------------

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}
const storedTheme = readJson(localStorage, THEME_KEY, null);
applyTheme(storedTheme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
$("theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  writeJson(localStorage, THEME_KEY, next);
});

// ---- Map -------------------------------------------------------------------

// Real mode can hold over a thousand markers, which a canvas draws faster than SVG.
const map = L.map("map", { preferCanvas: REAL }).setView([41.75, 1.6], REAL ? 7 : 8);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
// Areas sit under the markers, so a hotspot is always clickable on top of its outline.
map.createPane("context").style.zIndex = 300;
map.createPane("spread").style.zIndex = 350;

const layers = {
  fires: L.layerGroup(),
  mtg: L.layerGroup(),
  wind: L.layerGroup(),
  context: L.layerGroup(),
  spread: L.layerGroup(),
  danger: REAL
    ? L.tileLayer.wms(EFFIS, {
      layers: "mf010.fwi", format: "image/png", transparent: true, version: "1.1.1",
      time: fwiDate(Date.now()), opacity: 0.55,
      attribution: 'Fire danger &copy; <a href="https://effis.jrc.ec.europa.eu/">EFFIS</a>',
    })
    : L.layerGroup(),
};
layers.fires.addTo(map);
// The protected sites of the selected fire (real mode) are always shown.
const selectionLayer = L.layerGroup().addTo(map);

let fires = REAL ? [] : demoFires(LOADED);
let towns = REAL ? [] : TOWNS;
let findNearestTown = REAL ? () => null : null;
let selectedId = null;
let step = 0;
let userMarker = null;
const markers = new Map();

const viewBounds = () => {
  const b = map.getBounds();
  return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
};
/** Real mode lists only the active fires in view; the demo lists them all. */
function firesInView() {
  if (!REAL) return fires;
  const b = viewBounds();
  return fires.filter((f) => f.active && inBounds(f, b));
}

// ---- Status ------------------------------------------------------------------

function setStatus(html, kind = "") {
  const panel = $("status-panel");
  panel.hidden = !html;
  panel.className = `panel status ${kind}`;
  $("status-body").innerHTML = html ?? "";
}

// ---- Drawing -----------------------------------------------------------------

function markerStyle(fire) {
  const selected = fire.id === selectedId;
  const faded = !fire.active || step !== 0;
  return {
    radius: frpToPixels(fire.frp),
    color: selected ? "#111" : "#fff",
    weight: selected ? 3 : 1.2,
    fillColor: confidenceColor(fire.confidence),
    fillOpacity: fire.active ? (step === 0 ? 0.85 : 0.35) : 0.25,
    opacity: faded && !selected ? 0.6 : 1,
  };
}

function fireTooltip(fire) {
  const seen = REAL ? `<br>Last seen ${formatAge(Date.now() - fire.lastSeen)} ago` : "";
  return `<strong>${escapeHtml(fire.name)}</strong><br>${fire.frp} MW · ${fire.confidence} confidence${seen}`;
}

function drawFires() {
  layers.fires.clearLayers();
  markers.clear();
  // Draw inactive fires first, so active ones sit on top.
  const order = [...fires].sort((a, b) => Number(a.active) - Number(b.active) || a.frp - b.frp);
  for (const fire of order) {
    const marker = L.circleMarker([fire.lat, fire.lon], markerStyle(fire))
      .bindTooltip(fireTooltip(fire))
      .on("click", () => selectFire(fire.id, false));
    marker.addTo(layers.fires);
    markers.set(fire.id, marker);
  }
}

function restyleFires() {
  for (const fire of fires) markers.get(fire.id)?.setStyle(markerStyle(fire));
  markers.get(selectedId)?.bringToFront();
}

function drawCrossCheck() {
  layers.mtg.clearLayers();
  for (const fire of fires.filter((f) => f.crossChecked && f.active)) {
    L.circleMarker([fire.lat, fire.lon], {
      radius: frpToPixels(fire.frp) + 5, color: "#2e9d52", weight: 2.5, fill: false, interactive: false,
    }).addTo(layers.mtg);
  }
  if (REAL) return;
  for (const d of MTG_ONLY) {
    L.circleMarker([d.lat, d.lon], {
      radius: frpToPixels(d.frp), color: "#2e9d52", weight: 2, dashArray: "4 3", fillColor: "#2e9d52", fillOpacity: 0.15,
    })
      .bindTooltip(`<strong>${escapeHtml(d.name)}</strong><br>MTG detection ${d.minAgo} min ago · not yet in Deepfire`)
      .addTo(layers.mtg);
  }
}

function windArrow(point) {
  const color = WIND_BANDS[windBand(point.windKmh)].color;
  // The arrow points where the air goes, which is away from where it comes from.
  const icon = L.divIcon({
    className: "",
    html: `<div class="wind-arrow" style="color:${color};transform:rotate(${(point.windFrom + 180) % 360}deg)">↑</div>`,
    iconSize: [16, 16],
  });
  return L.marker([point.lat, point.lon], { icon, keyboard: false })
    .bindTooltip(`${Math.round(point.windKmh)} km/h from ${Math.round(point.windFrom)}°`);
}

async function drawWind() {
  if (!REAL) {
    layers.wind.clearLayers();
    for (const g of windGrid()) windArrow(g).addTo(layers.wind);
    return;
  }
  const points = gridPoints(viewBounds(), 6);
  try {
    const weather = parseOpenMeteo(await getJson(openMeteoUrl(points, { hours: 1 })));
    layers.wind.clearLayers();
    points.forEach((p, i) => windArrow({ ...p, ...weather[i].current }).addTo(layers.wind));
    realAt.weather = Date.now();
    renderFreshness();
  } catch (error) {
    setStatus(`Could not load the wind from Open-Meteo (${escapeHtml(error.message)}).`, "error");
  }
}

let burntAreasFor = "";
async function drawContext() {
  layers.context.clearLayers();
  if (!REAL) {
    for (const area of PROTECTED_AREAS) {
      L.polygon(area.polygon.map((p) => [p.lat, p.lon]), {
        pane: "context", color: "#3b7d3b", weight: 1, fillColor: "#5fae5f", fillOpacity: 0.15, dashArray: "2 3",
      }).bindTooltip(escapeHtml(area.name)).addTo(layers.context);
    }
  }
  const zoom = map.getZoom();
  const b = viewBounds();
  // Far out, only the larger towns, so the map stays readable.
  const minPopulation = !REAL ? 0 : zoom >= 10 ? 0 : zoom >= 8 ? 5000 : 30000;
  for (const town of towns) {
    if (town.population < minPopulation || (REAL && !inBounds(town, b))) continue;
    L.circleMarker([town.lat, town.lon], {
      pane: "context", radius: 3 + Math.log10(town.population), color: "#374151", weight: 1, fillColor: "#9ca3af", fillOpacity: 0.9,
    }).bindTooltip(`${escapeHtml(town.name)} · ${people(town.population)}`).addTo(layers.context);
  }
  if (REAL) await drawBurntAreas(zoom, b);
}

async function drawBurntAreas(zoom, b) {
  if (zoom < 7) return;
  const url = burntAreasUrl(b);
  burntAreasFor = url;
  try {
    const areas = parseBurntAreas(await getJson(url));
    if (burntAreasFor !== url || !map.hasLayer(layers.context)) return;
    for (const area of areas) {
      const when = Number.isNaN(area.fireDate) ? "" : new Date(area.fireDate).toISOString().slice(0, 10);
      for (const ring of area.polygons) {
        L.polygon(ring.map((p) => [p.lat, p.lon]), {
          pane: "context", color: "#5b3a1e", weight: 1, fillColor: "#7a4e2a", fillOpacity: 0.35,
        }).bindTooltip(`Burnt this season (EFFIS)<br>${escapeHtml(area.place)}<br>${when} · ${area.areaHa.toLocaleString("en")} ha`)
          .addTo(layers.context);
      }
    }
  } catch {
    // The burnt areas are extra context; the page works without them.
  }
}

function drawSpread() {
  layers.spread.clearLayers();
  restyleFires();
  if (step === 0) return;
  const now = Date.now();
  const list = REAL ? firesInView().slice(0, VIEW_LIMIT) : fires;
  for (const fire of list) {
    if (step < 0) drawPast(fire, -step, now);
    else drawFuture(fire, step, now);
  }
}

function drawPast(fire, hours, now) {
  if (REAL) {
    // Real detections: the satellite pixels seen by then, at their true size.
    for (const d of footprintAt(fire, now - hours * H)) {
      const km = sourceByKey(d.source)?.pixelKm ?? 0.375;
      L.circle([d.lat, d.lon], {
        pane: "spread", radius: km * 500, color: "#2f6fb3", weight: 1, fillColor: "#2f6fb3", fillOpacity: 0.45,
      }).bindTooltip(`${escapeHtml(fire.name)}: detected ${formatAge(now - d.time)} ago`).addTo(layers.spread);
    }
    return;
  }
  const r = pastRadiusKm(fire, hours);
  if (!r) return;
  L.circle([fire.lat, fire.lon], {
    pane: "spread", radius: r * 1000, color: "#2f6fb3", weight: 1.5, fillColor: "#2f6fb3", fillOpacity: 0.25,
  }).bindTooltip(`${escapeHtml(fire.name)}: estimated ${formatKm(r)} radius ${hours}h ago (from MTG series)`).addTo(layers.spread);
  L.circle([fire.lat, fire.lon], {
    pane: "spread", radius: currentRadiusKm(fire) * 1000, color: "#2f6fb3", weight: 1, dashArray: "3 3", fill: false, interactive: false,
  }).addTo(layers.spread);
}

function drawFuture(fire, hours, now) {
  if (REAL && !fire.weatherData) return;
  const weather = REAL ? meanWeather(fire.weatherData, now, hours) : fire.weather;
  const e = spreadEllipse(fire, hours, weather);
  const ring = (scale) => ellipsePolygon(e, scale).map((p) => [p.lat, p.lon]);
  const label = REAL
    ? `${escapeHtml(fire.name)}: rough +${hours}h shape from forecast wind. Not an official forecast.`
    : `${escapeHtml(fire.name)}: simulated +${hours}h spread · ELMFIRE run ${clockTime(DEMO_UPDATED.elmfire)}`;
  L.polygon(ring(1.3), { pane: "spread", color: "#e0701a", weight: 1, dashArray: "5 4", fill: false, interactive: false }).addTo(layers.spread);
  L.polygon(ring(1), { pane: "spread", color: "#c2410c", weight: 1.5, fillColor: "#f59e0b", fillOpacity: 0.3 })
    .bindTooltip(label)
    .addTo(layers.spread);
}

// ---- Layer toggles and timeline -------------------------------------------

const onLayerShown = { wind: drawWind, context: drawContext, spread: drawSpread };

function setLayer(name, on) {
  document.querySelector(`.pill[data-layer="${name}"]`).setAttribute("aria-pressed", String(on));
  if (on) {
    layers[name].addTo(map);
    onLayerShown[name]?.();
  } else {
    layers[name].remove();
  }
}

for (const button of document.querySelectorAll(".pill")) {
  button.addEventListener("click", () => setLayer(button.dataset.layer, button.getAttribute("aria-pressed") !== "true"));
}

document.querySelectorAll(".timeline [data-past]").forEach((button) => {
  const hours = PAST_STEPS[Number(button.dataset.past)];
  button.dataset.step = String(hours);
  button.textContent = `${hours}h`;
});

function timelineNote() {
  if (step === 0) return "";
  if (REAL) {
    return step < 0
      ? `Satellite pixels seen up to ${-step}h ago. Real detections, not an estimate.`
      : `Rough shape from the forecast wind (Open-Meteo), +${step}h. Not a fire-behaviour model. Dashed line: uncertainty.`;
  }
  return step < 0
    ? `Estimated from MTG series, ${-step}h ago. Not a live reading.`
    : `ELMFIRE simulation, +${step}h, model run ${clockTime(DEMO_UPDATED.elmfire)}. Dashed line: uncertainty.`;
}

for (const button of document.querySelectorAll(".timeline button")) {
  button.addEventListener("click", async () => {
    step = Number(button.dataset.step);
    for (const b of document.querySelectorAll(".timeline button")) b.setAttribute("aria-pressed", String(b === button));
    if (step !== 0 && !map.hasLayer(layers.spread)) setLayer("spread", true);
    $("timeline-note").textContent = timelineNote();
    if (REAL && step > 0) await loadWeather(firesInView().slice(0, VIEW_LIMIT));
    drawSpread();
  });
}

// ---- Live data -----------------------------------------------------------------

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Load Open-Meteo weather for the fires that have none yet, in one call. */
async function loadWeather(list) {
  const need = list.filter((f) => !f.weatherData).slice(0, VIEW_LIMIT);
  if (!need.length) return;
  try {
    const weather = parseOpenMeteo(await getJson(openMeteoUrl(need)));
    need.forEach((fire, i) => {
      fire.weatherData = weather[i];
      fire.weather = weather[i].current;
    });
    realAt.weather = Date.now();
    renderFreshness();
  } catch (error) {
    setStatus(`Could not load the weather from Open-Meteo (${escapeHtml(error.message)}). Danger badges and spread shapes need it.`, "error");
  }
}

async function loadFeed() {
  setStatus("Loading the satellite fire data…");
  try {
    const res = await fetch(feedUrl(location.search, location.hostname), { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status === 404 ? "the feed has not been published yet" : `HTTP ${res.status}`);
    const feed = readFeed(await res.json());
    towns = feed.places;
    findNearestTown = nearestIndex(towns);
    fires = realFires(feed.detections, Date.now(), findNearestTown);
    realAt.feedBuilt = feed.generatedAt;
    realAt.newestPass = Math.max(0, ...Object.values(feed.newestBySource)) || null;
    const problems = [];
    const age = Date.now() - feed.generatedAt;
    if (age > STALE_FEED_MS) {
      problems.push(`The satellite copy is ${formatAge(age)} old; the update job is late. <a href="https://firms.modaps.eosdis.nasa.gov/map/" target="_blank" rel="noopener">Check NASA FIRMS directly</a>.`);
    }
    const failed = feed.sources.filter((s) => !s.ok).map((s) => sourceByKey(s.key)?.satellite ?? s.key);
    if (failed.length) problems.push(`The last copy could not read ${escapeHtml(failed.join(", "))}.`);
    setStatus(problems.join(" "));
  } catch (error) {
    setStatus(`Could not load the satellite fire data (${escapeHtml(error.message)}). Wind and fire danger still work. Try again later, or <a href="./?mode=demo">open the demo</a>.`, "error");
  }
}

// ---- Sidebar ---------------------------------------------------------------

function legendHtml() {
  const dot = (color, extra = "") => `<span class="swatch" style="background:${color};${extra}"></span>`;
  const ramp = (colors) => `<div class="ramp">${colors.map((c) => `<span style="background:${c}"></span>`).join("")}</div>`;
  const confidence = ["low", "medium", "high"]
    .map((l) => `<div class="legend-row">${dot(CONFIDENCE_COLORS[l])} ${l[0].toUpperCase() + l.slice(1)} confidence</div>`).join("");
  const cross = REAL
    ? `<p class="legend-title">Satellite cross-check</p>
       <div class="legend-row">${dot("transparent", "border:2.5px solid #2e9d52")} Seen by 2 or more satellites</div>`
    : `<p class="legend-title">MTG cross-check</p>
       <div class="legend-row">${dot("transparent", "border:2.5px solid #2e9d52")} Confirmed by MTG</div>
       <div class="legend-row">${dot("rgba(46,157,82,.15)", "border:2px dashed #2e9d52")} MTG only, not yet in Deepfire</div>`;
  const danger = REAL
    ? `<p class="legend-title">Fire danger (EFFIS Fire Weather Index, today)</p>
       <img class="legend-img" src="${fwiLegendUrl()}" alt="EFFIS fire danger classes from very low to extreme" loading="lazy" />
       <p class="legend-title">Danger badge (the page's simple index)</p>`
    : `<p class="legend-title">Fire-weather danger</p>`;
  const spread = REAL
    ? `<div class="legend-row">${dot("#2f6fb3")} Satellite pixels seen by then</div>
       <div class="legend-row">${dot("#f59e0b", "border:1.5px solid #c2410c")} Rough shape from forecast wind</div>`
    : `<div class="legend-row">${dot("#2f6fb3")} Past size, estimated from MTG</div>
       <div class="legend-row">${dot("#f59e0b", "border:1.5px solid #c2410c")} Simulated spread</div>`;
  const context = REAL
    ? `<div class="legend-row">${dot("#9ca3af", "border:1px solid #374151")} Town (GeoNames)</div>
       <div class="legend-row">${dot("rgba(122,78,42,.5)", "border-radius:2px;border:1px solid #5b3a1e")} Burnt this season (EFFIS)</div>
       <div class="legend-row">${dot("rgba(95,174,95,.3)", "border-radius:2px;border:1px dashed #3b7d3b")} Natura 2000 site near the selected fire</div>`
    : `<div class="legend-row">${dot("rgba(95,174,95,.3)", "border-radius:2px;border:1px dashed #3b7d3b")} Protected area</div>
       <div class="legend-row">${dot("#9ca3af", "border:1px solid #374151")} Town</div>`;
  return `
    <p class="legend-title">${REAL ? "Fires (NASA FIRMS satellite hotspots)" : "Fires (Deepfire)"}</p>
    ${confidence}
    <div class="legend-row hint">Circle size = fire radiative power (FRP).${REAL ? " Faded = last seen 24 to 48 hours ago." : ""}</div>
    ${cross}
    <p class="legend-title">Wind speed (km/h)</p>
    ${ramp(WIND_BANDS.map((b) => b.color))}
    <div class="ramp-labels">${WIND_BANDS.map((b) => `<span>${b.label}</span>`).join("")}</div>
    ${danger}
    ${ramp(DANGER_LEVELS.map((l) => l.color))}
    <div class="ramp-labels"><span>Low</span><span>Extreme</span></div>
    <div class="legend-row hint">From wind, temperature and humidity.</div>
    <p class="legend-title">Spread</p>
    ${spread}
    <div class="legend-row hint">The shape follows the wind. The dashed outline is the uncertainty.</div>
    <p class="legend-title">Context</p>
    ${context}`;
}

function alertsFor(list) {
  if (!REAL) return impactAlerts(list, TOWNS, 10);
  return list.filter((f) => f.town && f.town.km <= 10)
    .map((f) => ({ fire: f, town: f.town.item, km: f.town.km }))
    .sort((a, b) => a.km - b.km);
}

function renderAlerts() {
  const alerts = alertsFor(firesInView());
  $("alerts-panel").hidden = alerts.length === 0;
  $("alerts-hint").textContent = REAL
    ? "Fires seen in the past 24 hours within 10 km of a town, in this map view."
    : "Fires within 10 km of a town.";
  const shown = alerts.slice(0, 12);
  $("alerts-list").innerHTML = shown
    .map((a) => `<li><button type="button" data-fire="${escapeHtml(a.fire.id)}"><strong>${escapeHtml(a.fire.name)}</strong>: ${formatKm(a.km)} from ${escapeHtml(a.town.name)} (${people(a.town.population)})</button></li>`)
    .join("") + (alerts.length > shown.length ? `<li class="hint">…and ${alerts.length - shown.length} more in this view.</li>` : "");
}

function renderTable() {
  const now = Date.now();
  const list = firesInView();
  const rows = list.slice(0, REAL ? 25 : list.length);
  $("cross-head").textContent = REAL ? "2+ sat." : "MTG";
  $("age-head").textContent = REAL ? "Seen" : "Age";
  $("fires-body").innerHTML = rows.map((f) => `
    <tr data-fire="${escapeHtml(f.id)}" class="${f.id === selectedId ? "selected" : ""}">
      <td>${escapeHtml(f.name)}</td>
      <td><span class="swatch" style="background:${confidenceColor(f.confidence)}" title="${f.confidence}"></span></td>
      <td>${f.frp}</td>
      <td>${formatAge(REAL ? now - f.lastSeen : now - f.firstSeen)}</td>
      <td>${f.crossChecked ? "✓" : "–"}</td>
    </tr>`).join("");
  $("fires-more").textContent = !rows.length
    ? (REAL && fires.length ? "No fire seen in the past 24 hours in this view. Zoom out to see more." : "")
    : list.length > rows.length ? `…and ${list.length - rows.length} more in this view.` : "";
}

const naturaCache = new Map();
async function naturaFor(fire) {
  if (!naturaCache.has(fire.id)) {
    naturaCache.set(fire.id, Promise.all([0, 1].map((layer) => getJson(naturaQueryUrl(fire, 20, layer))))
      .then((answers) => parseNatura(...answers))
      .catch(() => null));
  }
  return naturaCache.get(fire.id);
}

function protectedFactHtml(fact, source) {
  if (!fact) return "None within 20 km";
  const name = escapeHtml(fact.area.name);
  return fact.inside ? `Inside ${name}${source}` : `${name}${source}, ${formatKm(fact.km)}`;
}

async function renderDetail() {
  const fire = fires.find((f) => f.id === selectedId);
  if (!fire) return;
  const now = Date.now();
  const danger = fire.weather ? fireDanger(fire.weather) : null;
  const town = REAL ? fire.town ?? findNearestTown(fire, 50) : nearest(fire, TOWNS);
  const weatherRows = fire.weather
    ? `<dt>Wind</dt><dd>${Math.round(fire.weather.windKmh)} km/h from ${Math.round(fire.weather.windFrom)}°</dd>
       <dt>Temp / RH</dt><dd>${Math.round(fire.weather.tempC)} °C · ${Math.round(fire.weather.humidity)}%</dd>`
    : `<dt>Weather</dt><dd>Loading…</dd>`;
  const timeRows = REAL
    ? `<dt>First seen</dt><dd>${formatAge(now - fire.firstSeen)} ago</dd>
       <dt>Last seen</dt><dd>${formatAge(now - fire.lastSeen)} ago</dd>
       <dt>Satellites</dt><dd>${escapeHtml(fire.crossText)}</dd>
       <dt>Hot pixels</dt><dd>${fire.detections.length}</dd>`
    : `<dt>Detected</dt><dd>${formatAge(now - fire.firstSeen)} ago (Deepfire)</dd>
       <dt>MTG</dt><dd>${escapeHtml(fire.crossText)}</dd>`;
  const townText = town ? `${escapeHtml(town.item.name)}, ${formatKm(town.km)}${town.item.population ? ` (${people(town.item.population)})` : ""}` : "None within 50 km";
  let protectedRow = REAL ? "Loading…" : protectedFactHtml(protectedAreaFact(fire, PROTECTED_AREAS), "");
  const html = (protectedText) => `
    <p><strong>${escapeHtml(fire.name)}</strong></p>
    <span class="badge" style="background:${confidenceColor(fire.confidence)}">${fire.confidence} confidence</span>
    ${danger ? `<span class="badge" style="background:${danger.color}" title="${REAL ? "The page's simple index from wind, heat and dryness. Not the official index." : ""}">${danger.label} danger</span>` : ""}
    ${REAL ? `<p class="caveat">Satellite hotspot. It can be a wildfire, a farm burn or an industrial heat source.</p>` : ""}
    <dl class="facts">
      <dt>FRP</dt><dd>${fire.frp} MW${REAL ? " (latest pass)" : ""}</dd>
      ${timeRows}
      ${weatherRows}
      <dt>Nearest town</dt><dd>${townText}</dd>
      <dt>Protected area</dt><dd>${protectedText}</dd>
      <dt>Coordinates</dt><dd>${fire.lat.toFixed(3)}, ${fire.lon.toFixed(3)}</dd>
    </dl>
    ${REAL ? `<p class="links">
      <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${fire.lon.toFixed(3)},${fire.lat.toFixed(3)},12.0z" target="_blank" rel="noopener">Open in NASA FIRMS</a>
      <a href="https://forest-fire.emergency.copernicus.eu/apps/effis_current_situation/" target="_blank" rel="noopener">EFFIS current situation</a>
    </p>` : ""}`;
  $("detail").innerHTML = html(protectedRow);
  if (!REAL) return;

  const id = fire.id;
  if (!fire.weatherData) {
    await loadWeather([fire]);
    if (selectedId === id) return renderDetail();
  }
  const areas = await naturaFor(fire);
  if (selectedId !== id) return;
  selectionLayer.clearLayers();
  if (areas === null) {
    protectedRow = "Could not load (EEA Natura 2000)";
  } else {
    const rings = areas.flatMap((a) => a.polygons.map((polygon) => ({ name: a.name, polygon })));
    protectedRow = protectedFactHtml(rings.length ? protectedAreaFact(fire, rings) : null, " (Natura 2000)");
    for (const r of rings) {
      L.polygon(r.polygon.map((p) => [p.lat, p.lon]), {
        pane: "context", color: "#3b7d3b", weight: 1, fillColor: "#5fae5f", fillOpacity: 0.15, dashArray: "2 3",
      }).bindTooltip(`${escapeHtml(r.name)} (Natura 2000)`).addTo(selectionLayer);
    }
  }
  $("detail").innerHTML = html(protectedRow);
}

function selectFire(id, pan = true) {
  selectedId = id;
  const fire = fires.find((f) => f.id === id);
  if (pan && fire) map.setView([fire.lat, fire.lon], Math.max(map.getZoom(), 10));
  selectionLayer.clearLayers();
  restyleFires();
  renderTable();
  renderDetail();
}

function onRowClick(event) {
  const target = event.target.closest("[data-fire]");
  if (target) selectFire(target.dataset.fire);
}
$("fires-body").addEventListener("click", onRowClick);
$("alerts-list").addEventListener("click", onRowClick);
$("nearest-body").addEventListener("click", onRowClick);

// ---- Search and location ---------------------------------------------------

$("search").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = $("search-input").value;
  if (!REAL) {
    const town = findTown(query, TOWNS);
    $("search-note").textContent = town ? "" : "No town found. The demo covers towns in Catalonia.";
    if (town) map.setView([town.lat, town.lon], 11);
    return;
  }
  if (!query.trim()) return;
  $("search-note").textContent = "Searching…";
  try {
    const [place] = parseGeocoding(await getJson(geocodingUrl(query)));
    $("search-note").textContent = place ? place.label : "No place found.";
    if (place) map.setView([place.lat, place.lon], 11);
  } catch (error) {
    $("search-note").textContent = `Search failed (${error.message}).`;
  }
});

function showNearest(where, label) {
  const candidates = fires.filter((f) => f.active);
  const hit = nearest(where, candidates);
  if (userMarker) userMarker.remove();
  userMarker = L.circleMarker([where.lat, where.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
    .bindTooltip(escapeHtml(label)).addTo(map);
  map.setView([where.lat, where.lon], 9);
  $("nearest-panel").hidden = false;
  $("nearest-body").innerHTML = hit
    ? `From ${escapeHtml(label)}: <button type="button" class="ghost" data-fire="${escapeHtml(hit.item.id)}">${escapeHtml(hit.item.name)}</button> is ${formatKm(hit.km)} away.${REAL ? ` Last seen ${formatAge(Date.now() - hit.item.lastSeen)} ago.` : ""}`
    : "No active fire in the data.";
}

$("locate").addEventListener("click", () => {
  const fallback = () => {
    if (!REAL) return showNearest(DEMO_LOCATION, DEMO_LOCATION.label);
    $("nearest-panel").hidden = false;
    $("nearest-body").textContent = "Your browser did not share a location. Search a town instead.";
  };
  if (!navigator.geolocation) return fallback();
  navigator.geolocation.getCurrentPosition(
    (pos) => showNearest({ lat: pos.coords.latitude, lon: pos.coords.longitude }, "your location"),
    fallback,
    { timeout: 8000 },
  );
});
$("nearest-close").addEventListener("click", () => { $("nearest-panel").hidden = true; });

// ---- Dialog and footer -----------------------------------------------------

$("sources-open").addEventListener("click", () => $("sources-dialog").showModal());

function renderFreshness() {
  const now = Date.now();
  const line = REAL
    ? realFreshnessLine(now, { ...realAt, fwiDay: fwiDate(now) })
    : freshnessLine(now, DEMO_UPDATED);
  $("freshness").textContent = line.join(" · ");
}

// ---- View changes (real mode) ------------------------------------------------

let viewTimer = 0;
function onViewChange() {
  clearTimeout(viewTimer);
  viewTimer = setTimeout(async () => {
    renderAlerts();
    renderTable();
    if (map.hasLayer(layers.wind)) drawWind();
    if (map.hasLayer(layers.context)) drawContext();
    if (step > 0) await loadWeather(firesInView().slice(0, VIEW_LIMIT));
    if (step !== 0) drawSpread();
  }, 350);
}

// ---- Start -----------------------------------------------------------------

async function start() {
  $("legend").innerHTML = legendHtml();
  renderFreshness();
  setInterval(renderFreshness, 30_000);
  renderDeployLine($("deploy-line"), readStamp(document), "en", say, escapeHtml, `web-projects/${PROJECT}`);
  if (REAL) await loadFeed();
  drawFires();
  drawCrossCheck();
  renderAlerts();
  renderTable();
  renderFreshness();
  if (REAL) map.on("moveend", onViewChange);
}

start();
