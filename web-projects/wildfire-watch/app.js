// DOM and Leaflet glue. Every rule the map draws with lives in the pure modules
// (fireModel.js, alerts.js, geo.js, freshness.js); this file only renders them.
// Leaflet is loaded as a classic script before this module, as the global `L`.

import { FIRES, MTG_ONLY, TOWNS, PROTECTED_AREAS, DEMO_LOCATION, windGrid } from "./mockData.js";
import {
  CONFIDENCE_COLORS, WIND_BANDS, DANGER_LEVELS, confidenceColor, frpToPixels, windBand, fireDanger,
  spreadEllipse, ellipsePolygon, pastRadiusKm, currentRadiusKm,
} from "./fireModel.js";
import { impactAlerts, protectedAreaFact, findTown, formatKm } from "./alerts.js";
import { nearest } from "./geo.js";
import { formatAge, freshnessLine, clockTime } from "./freshness.js";
import { readJson, writeJson, projectKey } from "../cloud-storage/localStore.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { say } from "./i18n.js";

const PROJECT = "wildfire-watch";
const THEME_KEY = projectKey(PROJECT, "theme");
const $ = (id) => document.getElementById(id);
const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Freshness timestamps, fixed relative to page load so the demo reads the same every visit.
const LOADED = Date.now();
const UPDATED = {
  deepfire: LOADED - 30_000,
  mtg: LOADED - 6 * 60_000,
  weather: LOADED - 6 * 60_000,
  elmfire: LOADED - 40 * 60_000,
};

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

const map = L.map("map", { zoomControl: true }).setView([41.75, 1.6], 8);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const layers = {
  fires: L.layerGroup(),
  mtg: L.layerGroup(),
  wind: L.layerGroup(),
  context: L.layerGroup(),
  spread: L.layerGroup(),
};
layers.fires.addTo(map);
// Areas sit under the markers, so a hotspot is always clickable on top of its outline.
map.createPane("context").style.zIndex = 300;
map.createPane("spread").style.zIndex = 350;

let selectedId = null;
let step = 0;
let userMarker = null;
const fireMarkers = new Map();

function fireTooltip(fire) {
  return `<strong>${escapeHtml(fire.name)}</strong><br>${fire.frp} MW · ${fire.confidence} confidence`;
}

function drawFires() {
  layers.fires.clearLayers();
  fireMarkers.clear();
  for (const fire of FIRES) {
    const selected = fire.id === selectedId;
    const marker = L.circleMarker([fire.lat, fire.lon], {
      radius: frpToPixels(fire.frp),
      color: selected ? "#111" : "#fff",
      weight: selected ? 3 : 1.5,
      fillColor: confidenceColor(fire.confidence),
      fillOpacity: step === 0 ? 0.85 : 0.35,
    })
      .bindTooltip(fireTooltip(fire))
      .on("click", () => selectFire(fire.id, false));
    marker.addTo(layers.fires);
    fireMarkers.set(fire.id, marker);
  }
}

function drawMtg() {
  layers.mtg.clearLayers();
  for (const fire of FIRES.filter((f) => f.mtg.confirmed)) {
    L.circleMarker([fire.lat, fire.lon], {
      radius: frpToPixels(fire.frp) + 5, color: "#2e9d52", weight: 2.5, fill: false, interactive: false,
    }).addTo(layers.mtg);
  }
  for (const d of MTG_ONLY) {
    L.circleMarker([d.lat, d.lon], {
      radius: frpToPixels(d.frp), color: "#2e9d52", weight: 2, dashArray: "4 3", fillColor: "#2e9d52", fillOpacity: 0.15,
    })
      .bindTooltip(`<strong>${escapeHtml(d.name)}</strong><br>MTG detection ${d.minAgo} min ago · not yet in Deepfire`)
      .addTo(layers.mtg);
  }
}

function drawWind() {
  layers.wind.clearLayers();
  for (const g of windGrid()) {
    const color = WIND_BANDS[windBand(g.windKmh)].color;
    // The arrow points where the air goes, which is away from where it comes from.
    const icon = L.divIcon({
      className: "",
      html: `<div class="wind-arrow" style="color:${color};transform:rotate(${(g.windFrom + 180) % 360}deg)">↑</div>`,
      iconSize: [16, 16],
    });
    L.marker([g.lat, g.lon], { icon, interactive: false, keyboard: false }).addTo(layers.wind);
  }
}

function drawContext() {
  layers.context.clearLayers();
  for (const area of PROTECTED_AREAS) {
    L.polygon(area.polygon.map((p) => [p.lat, p.lon]), {
      pane: "context", color: "#3b7d3b", weight: 1, fillColor: "#5fae5f", fillOpacity: 0.15, dashArray: "2 3",
    }).bindTooltip(escapeHtml(area.name)).addTo(layers.context);
  }
  for (const town of TOWNS) {
    L.circleMarker([town.lat, town.lon], {
      pane: "context", radius: 3 + Math.log10(town.population), color: "#374151", weight: 1, fillColor: "#9ca3af", fillOpacity: 0.9,
    }).bindTooltip(`${escapeHtml(town.name)} · ${town.population.toLocaleString("en")} residents`).addTo(layers.context);
  }
}

function drawSpread() {
  layers.spread.clearLayers();
  drawFires();
  if (step === 0) return;
  for (const fire of FIRES) {
    if (step < 0) {
      const r = pastRadiusKm(fire, -step);
      if (!r) continue;
      L.circle([fire.lat, fire.lon], {
        pane: "spread", radius: r * 1000, color: "#2f6fb3", weight: 1.5, fillColor: "#2f6fb3", fillOpacity: 0.25,
      }).bindTooltip(`${escapeHtml(fire.name)}: estimated ${formatKm(r)} radius ${-step}h ago (from MTG series)`).addTo(layers.spread);
      L.circle([fire.lat, fire.lon], {
        pane: "spread", radius: currentRadiusKm(fire) * 1000, color: "#2f6fb3", weight: 1, dashArray: "3 3", fill: false, interactive: false,
      }).addTo(layers.spread);
    } else {
      const e = spreadEllipse(fire, step);
      const ring = (scale) => ellipsePolygon(e, scale).map((p) => [p.lat, p.lon]);
      L.polygon(ring(1.3), { pane: "spread", color: "#e0701a", weight: 1, dashArray: "5 4", fill: false, interactive: false }).addTo(layers.spread);
      L.polygon(ring(1), { pane: "spread", color: "#c2410c", weight: 1.5, fillColor: "#f59e0b", fillOpacity: 0.3 })
        .bindTooltip(`${escapeHtml(fire.name)}: simulated +${step}h spread · ELMFIRE run ${clockTime(UPDATED.elmfire)}`)
        .addTo(layers.spread);
    }
  }
}

// ---- Layer toggles and timeline -------------------------------------------

function setLayer(name, on) {
  const button = document.querySelector(`.pill[data-layer="${name}"]`);
  button.setAttribute("aria-pressed", String(on));
  if (on) layers[name].addTo(map);
  else layers[name].remove();
}

for (const button of document.querySelectorAll(".pill")) {
  button.addEventListener("click", () => setLayer(button.dataset.layer, button.getAttribute("aria-pressed") !== "true"));
}

for (const button of document.querySelectorAll(".timeline button")) {
  button.addEventListener("click", () => {
    step = Number(button.dataset.step);
    for (const b of document.querySelectorAll(".timeline button")) b.setAttribute("aria-pressed", String(b === button));
    if (step !== 0 && !map.hasLayer(layers.spread)) setLayer("spread", true);
    $("timeline-note").textContent =
      step < 0 ? `Estimated from MTG series, ${-step}h ago. Not a live reading.`
      : step > 0 ? `ELMFIRE simulation, +${step}h, model run ${clockTime(UPDATED.elmfire)}. Dashed line: uncertainty.`
      : "";
    drawSpread();
  });
}

// ---- Sidebar ---------------------------------------------------------------

function legendHtml() {
  const dot = (color, extra = "") => `<span class="swatch" style="background:${color};${extra}"></span>`;
  const ramp = (colors) => `<div class="ramp">${colors.map((c) => `<span style="background:${c}"></span>`).join("")}</div>`;
  return `
    <p class="legend-title">Fires (Deepfire)</p>
    ${["low", "medium", "high"].map((l) => `<div class="legend-row">${dot(CONFIDENCE_COLORS[l])} ${l[0].toUpperCase() + l.slice(1)} confidence</div>`).join("")}
    <div class="legend-row hint">Circle size = fire radiative power (FRP).</div>
    <p class="legend-title">MTG cross-check</p>
    <div class="legend-row">${dot("transparent", "border:2.5px solid #2e9d52")} Confirmed by MTG</div>
    <div class="legend-row">${dot("rgba(46,157,82,.15)", "border:2px dashed #2e9d52")} MTG only, not yet in Deepfire</div>
    <p class="legend-title">Wind speed (km/h)</p>
    ${ramp(WIND_BANDS.map((b) => b.color))}
    <div class="ramp-labels">${WIND_BANDS.map((b) => `<span>${b.label}</span>`).join("")}</div>
    <p class="legend-title">Fire-weather danger</p>
    ${ramp(DANGER_LEVELS.map((l) => l.color))}
    <div class="ramp-labels"><span>Low</span><span>Extreme</span></div>
    <div class="legend-row hint">From wind, temperature and humidity.</div>
    <p class="legend-title">Spread</p>
    <div class="legend-row">${dot("#2f6fb3")} Past size, estimated from MTG</div>
    <div class="legend-row">${dot("#f59e0b", "border:1.5px solid #c2410c")} Simulated spread</div>
    <div class="legend-row hint">The shape follows the wind. The dashed outline is the uncertainty.</div>
    <p class="legend-title">Context</p>
    <div class="legend-row">${dot("rgba(95,174,95,.3)", "border-radius:2px;border:1px dashed #3b7d3b")} Protected area</div>
    <div class="legend-row">${dot("#9ca3af", "border:1px solid #374151")} Town</div>`;
}

function renderAlerts() {
  const alerts = impactAlerts(FIRES, TOWNS, 10);
  $("alerts-panel").hidden = alerts.length === 0;
  $("alerts-list").innerHTML = alerts
    .map((a) => `<li><button type="button" data-fire="${a.fire.id}"><strong>${escapeHtml(a.fire.name)}</strong> — ${formatKm(a.km)} from ${escapeHtml(a.town.name)} (${a.town.population.toLocaleString("en")} residents)</button></li>`)
    .join("");
}

function renderTable() {
  $("fires-body").innerHTML = FIRES.map((f) => `
    <tr data-fire="${f.id}" class="${f.id === selectedId ? "selected" : ""}">
      <td>${escapeHtml(f.name)}</td>
      <td><span class="swatch" style="background:${confidenceColor(f.confidence)}" title="${f.confidence}"></span></td>
      <td>${f.frp}</td>
      <td>${formatAge(f.ageMin * 60_000)}</td>
      <td>${f.mtg.confirmed ? "✓" : "–"}</td>
    </tr>`).join("");
}

function renderDetail() {
  const fire = FIRES.find((f) => f.id === selectedId);
  if (!fire) return;
  const danger = fireDanger(fire.weather);
  const town = nearest(fire, TOWNS);
  const park = protectedAreaFact(fire, PROTECTED_AREAS);
  const mtg = fire.mtg.confirmed ? `Confirmed ${fire.mtg.minAgo} min ago` : "Not yet confirmed";
  $("detail").innerHTML = `
    <p><strong>${escapeHtml(fire.name)}</strong></p>
    <span class="badge" style="background:${confidenceColor(fire.confidence)}">${fire.confidence} confidence</span>
    <span class="badge" style="background:${danger.color}">${danger.label} danger</span>
    <dl class="facts">
      <dt>FRP</dt><dd>${fire.frp} MW</dd>
      <dt>Detected</dt><dd>${formatAge(fire.ageMin * 60_000)} ago (Deepfire)</dd>
      <dt>MTG</dt><dd>${mtg}</dd>
      <dt>Wind</dt><dd>${fire.weather.windKmh} km/h from ${fire.weather.windFrom}°</dd>
      <dt>Temp / RH</dt><dd>${fire.weather.tempC} °C · ${fire.weather.humidity}%</dd>
      <dt>Nearest town</dt><dd>${escapeHtml(town.item.name)}, ${formatKm(town.km)}</dd>
      <dt>Protected area</dt><dd>${park.inside ? `Inside ${escapeHtml(park.area.name)}` : `${escapeHtml(park.area.name)}, ${formatKm(park.km)}`}</dd>
      <dt>Coordinates</dt><dd>${fire.lat.toFixed(3)}, ${fire.lon.toFixed(3)}</dd>
    </dl>`;
}

function selectFire(id, pan = true) {
  selectedId = id;
  const fire = FIRES.find((f) => f.id === id);
  if (pan && fire) map.setView([fire.lat, fire.lon], Math.max(map.getZoom(), 10));
  drawFires();
  renderTable();
  renderDetail();
}

$("fires-body").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-fire]");
  if (row) selectFire(row.dataset.fire);
});
$("alerts-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-fire]");
  if (button) selectFire(button.dataset.fire);
});

// ---- Search and location ---------------------------------------------------

$("search").addEventListener("submit", (event) => {
  event.preventDefault();
  const town = findTown($("search-input").value, TOWNS);
  $("search-note").textContent = town ? "" : "No town found. The demo covers towns in Catalonia.";
  if (town) map.setView([town.lat, town.lon], 11);
});

function showNearest(where, label) {
  const hit = nearest(where, FIRES);
  if (userMarker) userMarker.remove();
  userMarker = L.circleMarker([where.lat, where.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
    .bindTooltip(escapeHtml(label)).addTo(map);
  map.setView([where.lat, where.lon], 9);
  $("nearest-panel").hidden = false;
  $("nearest-body").innerHTML = `From ${escapeHtml(label)}: <button type="button" class="ghost" data-fire="${hit.item.id}">${escapeHtml(hit.item.name)}</button> is ${formatKm(hit.km)} away.`;
}

$("locate").addEventListener("click", () => {
  const fallback = () => showNearest(DEMO_LOCATION, DEMO_LOCATION.label);
  if (!navigator.geolocation) return fallback();
  navigator.geolocation.getCurrentPosition(
    (pos) => showNearest({ lat: pos.coords.latitude, lon: pos.coords.longitude }, "your location"),
    fallback,
    { timeout: 8000 },
  );
});
$("nearest-close").addEventListener("click", () => { $("nearest-panel").hidden = true; });
$("nearest-body").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-fire]");
  if (button) selectFire(button.dataset.fire);
});

// ---- Dialog and footer -----------------------------------------------------

$("sources-open").addEventListener("click", () => $("sources-dialog").showModal());

function renderFreshness() {
  $("freshness").textContent = freshnessLine(Date.now(), UPDATED).join(" · ");
}

// ---- Start -----------------------------------------------------------------

$("legend").innerHTML = legendHtml();
drawFires();
drawMtg();
drawWind();
drawContext();
renderAlerts();
renderTable();
renderFreshness();
setInterval(renderFreshness, 30_000);
renderDeployLine($("deploy-line"), readStamp(document), "en", say, escapeHtml, `web-projects/${PROJECT}`);
