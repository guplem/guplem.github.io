// Terrain Print: page glue. It reads the design from the link, wires the
// controls, the map, the build worker, the 3D preview and the downloads.
// Every rule it applies lives in a tested module; this file holds no maths.

import { browserStorage } from "../cloud-storage/cloudSettings.js";
import { projectKey, readJson, writeJson } from "../cloud-storage/localStore.js";
import { BODIES } from "./bodies.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { escapeHtml, say } from "./deployText.js";
import { chooseSource } from "./elevation.js";
import { distanceOnSphere } from "./geo.js";
import { browserDeflate, fileSlug, threeMfFiles, toStl, zip } from "./exporters.js";
import { createMapView } from "./mapView.js";
import { layoutOffsets, modelGeometry } from "./model.js";
import { SHAPE_IDS, SHAPES } from "./outline.js";
import { PLACES } from "./places.js";
import {
  clampField,
  DEFAULT_PRINTER,
  defaultSettings,
  DETAILS,
  FIELDS,
  FILAMENTS,
  filamentHex,
  FRAME_FITS,
  GAPS,
  PRINTERS,
  readSettings,
  writeSearch,
} from "./settings.js";

const PROJECT = "terrain-print";
const storage = browserStorage();
const KEYS = {
  box: projectKey(PROJECT, "box"),
  printer: projectKey(PROJECT, "printer"),
  customBed: projectKey(PROJECT, "custom-bed"),
  layers: projectKey(PROJECT, "layers"),
};

const $ = (id) => document.getElementById(id);
const body = document.body;

let s = readSettings(location.search);
let screen = new URLSearchParams(location.search).get("view") === "model" ? "model" : "map";
let box = clamp(Number(readJson(storage, KEYS.box, 50)) || 50, 10, 90);
let printerId = readJson(storage, KEYS.printer, DEFAULT_PRINTER);
let customBed = readJson(storage, KEYS.customBed, { width: 300, height: 300 });
let layerChoice = readJson(storage, KEYS.layers, {});
let lastResult = null;
let lastGeomKey = "";

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function bed() {
  if (printerId === "custom") return { width: clamp(Number(customBed.width) || 300, 80, 1000), height: clamp(Number(customBed.height) || 300, 80, 1000) };
  const p = PRINTERS.find((x) => x.id === printerId) ?? PRINTERS.find((x) => x.id === DEFAULT_PRINTER);
  return { width: p.width, height: p.height };
}

// ---------------------------------------------------------------------------
// Static controls

function fillSelect(el, entries) {
  el.innerHTML = entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function buildStaticControls() {
  for (const id of ["shape", "shape2"]) fillSelect($(id), SHAPE_IDS.map((k) => [k, SHAPES[k].name]));
  fillSelect($("detail"), Object.entries(DETAILS).map(([k, v]) => [k, `${v.name} (${v.spacing} mm grid)`]));
  fillSelect($("gap"), Object.entries(GAPS).map(([k, v]) => [k, `${v.name} (${v.mm} mm)`]));
  fillSelect($("frameFit"), Object.entries(FRAME_FITS).map(([k, v]) => [k, `${v.name} (${v.mm} mm each side)`]));
  fillSelect($("printer"), [...PRINTERS.map((p) => [p.id, `${p.name} (${p.width} × ${p.height} mm)`]), ["custom", "Custom size"]]);
  for (const holder of document.querySelectorAll("[data-colour]")) {
    holder.setAttribute("role", "radiogroup");
    holder.innerHTML = FILAMENTS.map(
      (f) => `<button type="button" class="swatch" role="radio" data-filament="${f.id}" title="${escapeHtml(f.name)}" aria-label="${escapeHtml(f.name)}" style="background:${f.hex}"></button>`,
    ).join("");
  }
}

function bodyControls() {
  const b = BODIES[s.body];
  // Map layers
  const layers = $("layers");
  layers.innerHTML = b.layers.map((l) => `<button type="button" role="radio" data-layer="${l.id}">${escapeHtml(l.name)}</button>`).join("");
  // Sea ranges and presets
  if (b.sea) {
    for (const id of ["map-sl", "seaLevel"]) {
      $(id).min = b.sea.min;
      $(id).max = b.sea.max;
    }
    for (const id of ["map-sea-presets", "sea-presets"]) {
      $(id).innerHTML = b.sea.presets
        .map((p) => `<button type="button" class="chip" data-sea-level="${p.elevation}" title="${escapeHtml(p.note ?? p.source ?? "")}">${escapeHtml(p.name)} (${formatMetres(p.elevation)})</button>`)
        .join("");
    }
    $("sea-hint").textContent =
      b.id === "mars"
        ? "Mars had no sea in recorded time; these levels are the proposed shorelines of an ancient northern ocean. Heights are against the MOLA datum."
        : "Raise the level to see a flooded coast, or lower it to see the land of the last ice age.";
  }
  const snowRange = { moon: [-9000, 11000], mars: [-8000, 21000], earth: [-500, 8800] }[b.id];
  $("snowLine").min = snowRange[0];
  $("snowLine").max = snowRange[1];
  $("lede").textContent = `Point the box at the piece of ${b.id === "earth" ? "the Earth" : b.id === "moon" ? "the Moon" : "Mars"} you want to print.`;
  $("search").placeholder = { moon: "Try “Tycho”", mars: "Try “Olympus”", earth: "A place or an address" }[b.id];
}

function formatMetres(m) {
  return `${m > 0 ? "+" : m < 0 ? "−" : ""}${Math.abs(Math.round(m)).toLocaleString("en")} m`;
}
function formatKm(km) {
  return km >= 100 ? `${Math.round(km).toLocaleString("en")} km` : km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
}
function formatResolution(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// ---------------------------------------------------------------------------
// Syncing controls with the design

function syncControls() {
  const b = BODIES[s.body];
  body.dataset.screen = screen;
  body.dataset.sea = b.sea ? "1" : "0";
  body.dataset.heightMode = s.heightMode;
  body.dataset.split = s.split;
  body.dataset.frame = s.frame;
  body.dataset.rim = s.rimMode;
  body.dataset.snow = s.snowOn ? "1" : "0";
  body.dataset.printer = printerId;
  body.dataset.pieces = lastResult && lastResult.pieceCount > 1 ? "many" : "one";
  for (const w of document.querySelectorAll(".world")) w.setAttribute("aria-checked", String(w.dataset.body === s.body));
  for (const l of document.querySelectorAll("[data-layer]")) l.setAttribute("aria-checked", String(l.dataset.layer === currentLayer()));
  for (const el of document.querySelectorAll("[data-field]")) {
    const v = s[el.dataset.field];
    if (el.type === "checkbox") el.checked = Boolean(v);
    else if (document.activeElement !== el) el.value = String(v);
  }
  for (const el of document.querySelectorAll("[data-set]")) el.setAttribute("aria-checked", String(String(s[el.dataset.set]) === el.dataset.value));
  for (const holder of document.querySelectorAll("[data-colour]")) {
    for (const sw of holder.children) sw.setAttribute("aria-checked", String(sw.dataset.filament === s[holder.dataset.colour]));
  }
  for (const chip of document.querySelectorAll("[data-sea-level]")) chip.setAttribute("aria-pressed", String(Number(chip.dataset.seaLevel) === s.seaLevel));
  $("box").value = box;
  $("box-out").textContent = `${box}%`;
  $("rot-out").textContent = `${s.rotation}°`;
  $("map-sl-out").textContent = formatMetres(s.seaLevel);
  $("sl-out").textContent = formatMetres(s.seaLevel);
  $("mm-out").textContent = `${s.sizeMm} mm`;
  $("relief-out").textContent = `${s.reliefMm} mm`;
  $("ex-out").textContent = `${s.exaggeration}×`;
  $("base-out").textContent = `${s.baseMm} mm`;
  $("step-out").textContent = `${s.coastStepMm} mm`;
  $("pieces-out").textContent = String(s.pieces);
  $("border-out").textContent = `${s.borderMm} mm`;
  $("floor-out").textContent = `${s.floorMm} mm`;
  $("rim-out").textContent = `${s.rimMm} mm`;
  $("snow-out").textContent = formatMetres(s.snowLine);
  const name = (id) => FILAMENTS.find((f) => f.id === id)?.name ?? "";
  $("c-out").textContent = name(s.terrainColour);
  $("cs-out").textContent = name(s.seaColour);
  $("cw-out").textContent = name(s.snowColour);
  $("cf-out").textContent = name(s.frameColour);
  $("printer").value = printerId;
  $("bed-w").value = customBed.width;
  $("bed-h").value = customBed.height;
  updateAreaReadout();
  updateDetailHint();
}

function currentLayer() {
  const b = BODIES[s.body];
  const id = layerChoice[s.body];
  return b.layers.some((l) => l.id === id) ? id : b.layers[0].id;
}

function updateAreaReadout() {
  $("area-out").textContent = `${formatKm(s.km)} across · centre ${s.lat.toFixed(3)}°, ${s.lon.toFixed(3)}°`;
  $("pole-hint").hidden = BODIES[s.body].projection !== "plate" || Math.abs(s.lat) < 65;
  if (screen === "map") {
    $("hud-title").textContent = "Selection";
    $("dims").textContent = `${formatKm(s.km)} across, printed ${s.sizeMm} mm wide`;
  }
}

function updateDetailHint() {
  const geom = modelGeometry(s);
  const plan = chooseSource(BODIES[s.body], { lats: Float64Array.of(s.lat), lons: Float64Array.of(s.lon), centreLat: s.lat, centreLon: s.lon, spacing: geom.groundSpacing });
  const data = plan ? ` The heights come from data at ${formatResolution(plan.resolution)} per sample.` : "";
  $("detail-hint").textContent = `One ${geom.d} mm step of the model is ${formatResolution(geom.groundSpacing)} on the ground.${data}`;
}

function writeUrl() {
  const search = writeSearch(s) + (screen === "model" ? "&view=model" : "");
  const next = `${location.pathname}${search}${location.hash}`;
  if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, "", next);
}

// ---------------------------------------------------------------------------
// The map

const mapView = createMapView($("map"), {
  onMove: () => scheduleMove(),
  onMoveEnd: () => writeUrl(),
  onPlace: (p) => goToPlace(p),
});

let moveQueued = false;
function scheduleMove() {
  if (moveQueued) return;
  moveQueued = true;
  requestAnimationFrame(() => {
    moveQueued = false;
    if (screen !== "map" || !mapView.visible()) return;
    const c = mapView.centre();
    s.lat = clamp(c.lat, -89.999, 89.999);
    s.lon = ((((c.lon + 180) % 360) + 360) % 360) - 180;
    s.km = clampField("km", mapView.kmForBox(box));
    mapView.setSelection(s);
    updateAreaReadout();
    updateDetailHint();
  });
}

function openBody(bodyId, { fromLink = false } = {}) {
  if (!fromLink && bodyId !== s.body) {
    // Keep the choices that are not about the world; take the rest from its defaults.
    const keep = ["shape", "rotation", "sizeMm", "heightMode", "reliefMm", "exaggeration", "baseMm", "detail", "curvature", "coastStepMm", "frame", "frameFit", "floorMm", "borderMm", "rimMode", "rimMm", "split", "pieces", "joint", "gap", "seed", "frameColour"];
    const next = defaultSettings(bodyId);
    for (const k of keep) next[k] = s[k];
    s = next;
  }
  bodyControls();
  mapView.setBody(s.body, { lat: s.lat, lon: s.lon, zoom: 2 });
  mapView.setView(s.lat, s.lon, mapView.zoomForKm(s.km, box, s.lat));
  mapView.setLayer(currentLayer());
  mapView.setSea({ on: s.seaOn && Boolean(BODIES[s.body].sea), level: s.seaLevel });
  mapView.setPlaces(PLACES[s.body]);
  mapView.setSelection(s);
  renderPlaces();
  syncControls();
  writeUrl();
}

function goToPlace(p) {
  s.km = clampField("km", p.size);
  mapView.setView(p.lat, p.lon, mapView.zoomForKm(s.km, box, p.lat), true);
  if (screen === "model") showScreen("map");
}

// Places list and search
let searchResults = [];
function renderPlaces() {
  const q = $("search").value.trim().toLowerCase();
  const list = PLACES[s.body].filter((p) => !q || `${p.name} ${p.note} ${p.kind}`.toLowerCase().includes(q));
  const items = [...list, ...searchResults];
  $("places").innerHTML = items.length
    ? items
        .map(
          (p, i) =>
            `<li><button type="button" data-place="${i}"><span class="kind">${escapeHtml(p.kind)}</span>${escapeHtml(p.name)}<span class="note">${escapeHtml(p.note ?? "")}</span></button></li>`,
        )
        .join("")
    : `<li class="empty">${s.body === "earth" && q ? "Press Enter to search OpenStreetMap." : "No place by that name."}</li>`;
  $("places").onclick = (e) => {
    const btn = e.target.closest("[data-place]");
    if (btn) goToPlace(items[Number(btn.dataset.place)]);
  };
}

async function searchEarth(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const rows = res.ok ? await res.json() : [];
    searchResults = rows.map((r) => {
      const [south, north, west, east] = r.boundingbox.map(Number);
      const lat = Number(r.lat);
      const spanKm = Math.max(north - south, (east - west) * Math.cos((lat * Math.PI) / 180)) * 111.2;
      return { name: r.display_name.split(",").slice(0, 3).join(","), kind: r.type ?? "place", note: "From OpenStreetMap", lat, lon: Number(r.lon), size: clamp(spanKm * 1.3, 2, 2500) };
    });
  } catch {
    searchResults = [];
    toast("The place search did not answer. Try again, or move the map by hand.");
  }
  renderPlaces();
}

// ---------------------------------------------------------------------------
// The build

const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
let buildId = 0;
let previewPromise = null;
let preview = null;
let buildTimer = null;

function loadPreview() {
  if (!previewPromise) {
    previewPromise = import("./preview.js").then((m) => {
      preview = m.createPreview($("viewer"));
      return preview;
    });
  }
  return previewPromise;
}

function requestBuild(delay = 0) {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => {
    buildId++;
    $("updating").hidden = false;
    $("dl-3mf").disabled = true;
    $("dl-stl").disabled = true;
    worker.postMessage({ type: "build", id: buildId, settings: { ...s }, bed: bed() });
  }, delay);
}

const STAGES = ["plan", "read", "mesh", "draw"];
function setStep(step) {
  const at = STAGES.indexOf(step);
  for (const li of $("steps").children) {
    const i = STAGES.indexOf(li.dataset.step);
    li.className = i < at ? "done" : i === at ? "active" : "";
  }
}

worker.onmessage = async (e) => {
  const msg = e.data;
  if (msg.id !== buildId) return;
  if (msg.type === "progress") {
    if (msg.stage === "plan" || msg.stage === "tiles" || msg.stage === "rows") {
      $("busy").hidden = false;
      $("updating").hidden = true;
    }
    const step = msg.stage === "tiles" || msg.stage === "rows" ? "read" : msg.stage;
    setStep(step);
    const frac = msg.total ? msg.done / msg.total : 0;
    const base = { plan: 0, read: 0.05, mesh: 0.75, draw: 0.95 }[step];
    const span = { plan: 0.05, read: 0.7, mesh: 0.2, draw: 0.05 }[step];
    $("meter").style.width = `${Math.round((base + span * frac) * 100)}%`;
    if (msg.stage === "tiles") $("busy-sub").textContent = `Reading elevation tiles: ${msg.done} of ${msg.total}`;
    else if (msg.stage === "rows") $("busy-sub").textContent = `Reading rows of the NASA file: ${msg.done} of ${msg.total}`;
    else if (msg.stage === "mesh") $("busy-sub").textContent = msg.total > 1 ? `Building piece ${msg.done} of ${msg.total}` : "Building the terrain";
    return;
  }
  if (msg.type === "error") {
    $("busy").hidden = true;
    $("updating").hidden = true;
    toast(msg.message);
    return;
  }
  setStep("draw");
  const p = await loadPreview();
  const geomKey = JSON.stringify([s.body, s.lat, s.lon, s.km, s.shape, s.rotation, s.sizeMm]);
  lastResult = msg;
  p.show(msg, s, bed(), { keepCamera: geomKey === lastGeomKey });
  lastGeomKey = geomKey;
  p.setSpread($("spread").checked);
  p.setShowFrame($("show-frame").checked);
  if (screen === "model") p.start();
  $("busy").hidden = true;
  $("updating").hidden = true;
  showResult(msg);
};

function showResult(r) {
  const all = r.parts.map((p) => p.bounds);
  const frame = r.parts.find((p) => p.kind === "frame");
  const outer = frame ? frame.bounds : [Math.min(...all.map((b) => b[0])), Math.min(...all.map((b) => b[1])), 0, Math.max(...all.map((b) => b[3])), Math.max(...all.map((b) => b[4])), 0];
  const top = Math.max(...all.map((b) => b[5])) + (frame ? s.floorMm : 0);
  const pieces = r.parts.filter((p) => p.kind === "piece").length;
  $("hud-title").textContent = "Model size";
  $("dims").innerHTML = `X ${(outer[3] - outer[0]).toFixed(1)} mm · Y ${(outer[4] - outer[1]).toFixed(1)} mm · Z ${top.toFixed(1)} mm<br>${pieces} piece${pieces === 1 ? "" : "s"}${frame ? " + frame" : ""}`;
  const st = r.stats;
  const ground = st.anyWater
    ? `Highest point ${formatMetres(st.maxM)}; the sea is flat at ${formatMetres(s.seaLevel)}.`
    : `Ground from ${formatMetres(st.minM)} to ${formatMetres(st.maxM)}.`;
  const times = st.exaggeration >= 10 ? st.exaggeration.toFixed(0) : st.exaggeration.toFixed(1);
  $("scale-out").textContent =
    s.heightMode === "relief"
      ? `${st.reliefMm.toFixed(1)} mm of relief = ${times}× true scale. ${ground}`
      : `${s.exaggeration}× true scale gives ${st.reliefMm.toFixed(1)} mm of relief. ${ground}`;
  const cell = Math.min(r.geom.width / r.grid.cols, r.geom.height / r.grid.rows);
  $("pieces-readout").textContent = r.pieceCount > 1 ? `${r.pieceCount} pieces, cut on a ${r.grid.cols} × ${r.grid.rows} grid, each about ${Math.round(cell)} mm across.` : "";
  // Colour plan
  const fil = (id) => FILAMENTS.find((f) => f.id === id);
  const plan = r.colours;
  let html = "";
  if (plan.swaps.length) {
    html = `<b>Colour by height with one nozzle</b><ol><li><span class="dot" style="background:${filamentHex(plan.bands[0].colour)}"></span>Start with ${escapeHtml(fil(plan.bands[0].colour).name)} (${escapeHtml(plan.bands[0].label.toLowerCase())}).</li>`;
    for (const sw of plan.swaps) {
      html += `<li><span class="dot" style="background:${filamentHex(sw.colour)}"></span>Change to ${escapeHtml(fil(sw.colour).name)} at ${sw.atMm.toFixed(2)} mm (layer ${sw.layer} at 0.2 mm layers), for the ${escapeHtml(sw.label.toLowerCase())}.</li>`;
    }
    html += "</ol>";
  } else if (st.curved && s.seaOn) {
    html = "With the curve of the globe kept, the sea is not flat, so there is no single layer to change colour at.";
  }
  $("colour-plan").innerHTML = html;
  $("warnings").innerHTML = r.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("");
  const src = r.source;
  const calibrated = src.scale !== 1 ? ` This copy stores heights × ${(1 / src.scale).toFixed(2)}; it was measured against the NASA file and scaled back.` : "";
  $("source-out").textContent = `${src.label}. Read at ${formatResolution(src.resolution)} per sample (${src.requests} ${src.kind === "strip" ? "rows" : "tiles"}); one model step is ${formatResolution(r.geom.groundSpacing)} on the ground.${calibrated}`;
  $("dl-3mf").disabled = false;
  $("dl-stl").disabled = false;
  syncControls();
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 9000);
}

// ---------------------------------------------------------------------------
// Downloads

function baseName() {
  let best = null;
  for (const p of PLACES[s.body]) {
    const d = distanceOnSphere(s.lat, s.lon, p.lat, p.lon, BODIES[s.body].radius) / 1000;
    if (d < s.km / 2 && (!best || d < best.d)) best = { d, p };
  }
  const where = best ? best.p.name : `${Math.abs(s.lat).toFixed(2)}${s.lat >= 0 ? "n" : "s"} ${Math.abs(s.lon).toFixed(2)}${s.lon >= 0 ? "e" : "w"}`;
  return fileSlug(`${s.body} ${where}`);
}

function save(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function exportParts() {
  const r = lastResult;
  const cell = Math.min(r.geom.width / r.grid.cols, r.geom.height / r.grid.rows);
  const parts = r.parts.map((p) => ({ name: p.name, kind: p.kind, bounds: p.bounds, colour: p.colour, mesh: { positions: p.positions, indices: p.indices } }));
  const offsets = layoutOffsets(parts, cell, 4);
  return parts.map((p, i) => ({ ...p, offset: offsets[i] }));
}

async function download3mf() {
  const parts = exportParts();
  const title = `${BODIES[s.body].name}: ${baseName()}`;
  const bytes = await zip(threeMfFiles(parts, title), browserDeflate());
  save(bytes, `${baseName()}.3mf`, "model/3mf");
}

function printNotes() {
  const r = lastResult;
  const lines = [
    `Terrain Print: ${BODIES[s.body].name}, centre ${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}, ${formatKm(s.km)} across.`,
    `Design link: ${location.origin}${location.pathname}${writeSearch(s)}`,
    `Heights: ${r.source.label}, ${formatResolution(r.source.resolution)} per sample.`,
    `Model: ${s.sizeMm} mm, ${r.stats.reliefMm.toFixed(1)} mm relief (${r.stats.exaggeration.toFixed(2)}x true scale), base ${s.baseMm} mm.`,
    "",
  ];
  if (r.colours.swaps.length) {
    lines.push(`Colour plan: start with ${r.colours.bands[0].colour}.`);
    for (const sw of r.colours.swaps) lines.push(`  At ${sw.atMm.toFixed(2)} mm (layer ${sw.layer} at 0.2 mm layers): change to ${sw.colour} (${sw.label}).`);
  }
  return new TextEncoder().encode(lines.join("\n") + "\n");
}

async function downloadStl() {
  const parts = exportParts();
  const name = baseName();
  if (parts.length === 1) {
    save(toStl(parts[0].mesh, name), `${name}.stl`, "model/stl");
    return;
  }
  const files = parts.map((p) => ({ name: `${name}-${fileSlug(p.name)}.stl`, data: toStl(p.mesh, `${name} ${p.name}`) }));
  files.push({ name: "print-notes.txt", data: printNotes() });
  save(await zip(files, browserDeflate()), `${name}-stl.zip`, "application/zip");
}

// ---------------------------------------------------------------------------
// Screens and events

function showScreen(next) {
  screen = next;
  syncControls();
  writeUrl();
  if (screen === "model") {
    loadPreview().then((p) => p.start());
    requestBuild();
  } else {
    preview?.stop();
    setTimeout(() => {
      mapView.invalidate();
      mapView.setView(s.lat, s.lon, mapView.zoomForKm(s.km, box, s.lat));
      mapView.setSelection(s);
    });
  }
}

function onField(field, el) {
  const spec = FIELDS[field];
  let v;
  if (el.type === "checkbox") v = el.checked;
  else if (spec?.type === "num") {
    if (el.value === "" || !Number.isFinite(Number(el.value))) return;
    v = clampField(field, Number(el.value));
  } else v = el.value;
  s[field] = v;
  if (field === "shape" || field === "rotation") mapView.setSelection(s);
  if (field === "seaOn" || field === "seaLevel") mapView.setSea({ on: s.seaOn, level: s.seaLevel });
  if (field === "sizeMm" || field === "detail") updateDetailHint();
  syncControls();
  writeUrl();
  if (screen === "model") requestBuild(field === "seaLevel" || field === "reliefMm" ? 350 : 250);
}

function wire() {
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset?.field && el.type === "range") onField(el.dataset.field, el);
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset?.field) onField(el.dataset.field, el);
  });
  document.addEventListener("click", (e) => {
    const set = e.target.closest("[data-set]");
    if (set) {
      const field = set.dataset.set;
      s[field] = set.dataset.value;
      syncControls();
      writeUrl();
      if (screen === "model") requestBuild();
      return;
    }
    const sw = e.target.closest("[data-filament]");
    if (sw) {
      const field = sw.parentElement.dataset.colour;
      s[field] = sw.dataset.filament;
      syncControls();
      writeUrl();
      if (screen === "model" && lastResult) requestBuild();
      return;
    }
    const chip = e.target.closest("[data-sea-level]");
    if (chip) {
      s.seaLevel = Number(chip.dataset.seaLevel);
      s.seaOn = true;
      mapView.setSea({ on: true, level: s.seaLevel });
      syncControls();
      writeUrl();
      if (screen === "model") requestBuild();
      return;
    }
    const world = e.target.closest("[data-body]");
    if (world && world.classList.contains("world")) {
      if (world.dataset.body !== s.body) {
        searchResults = [];
        $("search").value = "";
        openBody(world.dataset.body);
      }
      return;
    }
    const layer = e.target.closest("[data-layer]");
    if (layer) {
      layerChoice = { ...layerChoice, [s.body]: layer.dataset.layer };
      writeJson(storage, KEYS.layers, layerChoice);
      mapView.setLayer(layer.dataset.layer);
      syncControls();
    }
  });
  $("box").addEventListener("input", () => {
    box = Number($("box").value);
    writeJson(storage, KEYS.box, box);
    s.km = clampField("km", mapView.kmForBox(box));
    mapView.setSelection(s);
    syncControls();
  });
  $("box").addEventListener("change", () => writeUrl());
  $("search").addEventListener("input", () => {
    searchResults = [];
    renderPlaces();
  });
  $("search").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = $("search").value.trim();
    const local = PLACES[s.body].filter((p) => `${p.name} ${p.note}`.toLowerCase().includes(q.toLowerCase()));
    if (local.length) goToPlace(local[0]);
    else if (s.body === "earth" && q) searchEarth(q);
  });
  $("coords").addEventListener("submit", (e) => {
    e.preventDefault();
    const lat = Number($("go-lat").value);
    const lon = Number($("go-lon").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || $("go-lat").value === "" || $("go-lon").value === "") {
      toast("Type a latitude from −90 to 90 and a longitude from −180 to 180.");
      return;
    }
    mapView.setView(lat, lon, mapView.zoomForKm(s.km, box, lat), true);
  });
  $("make").addEventListener("click", () => showScreen("model"));
  $("back").addEventListener("click", () => showScreen("map"));
  $("busy-cancel").addEventListener("click", () => {
    buildId++;
    $("busy").hidden = true;
    $("updating").hidden = true;
    if (!lastResult) showScreen("map");
  });
  $("shuffle").addEventListener("click", () => {
    s.seed = 1 + Math.floor(Math.random() * 999998);
    writeUrl();
    requestBuild();
  });
  $("printer").addEventListener("change", () => {
    printerId = $("printer").value;
    writeJson(storage, KEYS.printer, printerId);
    syncControls();
    if (screen === "model") requestBuild();
  });
  for (const id of ["bed-w", "bed-h"]) {
    $(id).addEventListener("change", () => {
      customBed = { width: clamp(Number($("bed-w").value) || 300, 80, 1000), height: clamp(Number($("bed-h").value) || 300, 80, 1000) };
      writeJson(storage, KEYS.customBed, customBed);
      syncControls();
      if (screen === "model") requestBuild();
    });
  }
  $("spread").addEventListener("change", () => preview?.setSpread($("spread").checked));
  $("show-frame").addEventListener("change", () => preview?.setShowFrame($("show-frame").checked));
  $("view-back").addEventListener("click", () => {
    const below = preview?.toggleBack();
    $("view-back").textContent = below ? "View the top" : "View the back";
  });
  $("dl-3mf").addEventListener("click", () => download3mf().catch((err) => toast(`The 3MF file could not be made: ${err.message}`)));
  $("dl-stl").addEventListener("click", () => downloadStl().catch((err) => toast(`The STL file could not be made: ${err.message}`)));
}

// ---------------------------------------------------------------------------
// Start

function start() {
  if (typeof L === "undefined") {
    toast("The map library did not load. Check the connection and reload the page.");
    return;
  }
  buildStaticControls();
  wire();
  openBody(s.body, { fromLink: true });
  renderDeployLine($("deploy-line"), readStamp(document), "en", say, escapeHtml, `web-projects/${PROJECT}`);
  if (screen === "model") showScreen("model");
}

start();
