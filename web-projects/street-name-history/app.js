// DOM controller and entry point. Not unit-tested (per web-projects/CLAUDE.md): all the
// logic worth testing lives in the pure modules (urlState.js, names.js, sources.js); this
// file only wires them to the DOM and the network layer (data-source.js).
// Leaflet is loaded as a classic script before this module, as the global `L`.

import { parseUrlState, serializeUrlState } from "./urlState.js";
import { extractNames, collectWikidataIds } from "./names.js";
import { pickBest } from "./sources.js";
import {
  searchStreets,
  reverseStreet,
  lookupStreet,
  fetchWikidata,
  fetchOhmTimeline,
} from "./data-source.js";

const dom = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  button: document.getElementById("search-button"),
  status: document.getElementById("status"),
  candidates: document.getElementById("candidates"),
  detail: document.getElementById("detail"),
  mapHint: document.getElementById("map-hint"),
  copyLink: document.getElementById("copy-link"),
  shareStatus: document.getElementById("share-status"),
};

// Viewer language preferences (base codes), used to pick the best Wikidata label/description
// and to bias Nominatim results toward the viewer's language.
const VIEWER_LANGS = (navigator.languages && navigator.languages.length
  ? navigator.languages
  : [navigator.language || "en"]
).map((l) => l.split("-")[0]);
const ACCEPT_LANGUAGE = (navigator.languages || [navigator.language || "en"]).join(",");

// Nominatim usage policy: no more than ~1 request/second. We call it only on a submit or a map
// tap, and every call (search, tap, link lookup) waits for this one shared slot.
const MIN_NOMINATIM_INTERVAL_MS = 1100;

// Below this map zoom a tap covers many streets, so the tap zooms in instead of picking one.
const MIN_PICK_ZOOM = 15;

const HIGHLIGHT_STYLE = { color: "#5eb0ef", weight: 7, opacity: 0.9 };

let currentQuery = "";
let selectedRef = null;
let lastResults = [];
let nominatimInFlight = false;
let lastNominatimAt = 0;

const map = L.map("map", { worldCopyJump: true }).setView([30, 10], 2);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
const highlightLayer = L.layerGroup().addTo(map);

function esc(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function setStatus(message, kind = "") {
  dom.status.textContent = message || "";
  dom.status.className = `status${kind ? ` status--${kind}` : ""}`;
}

function syncUrl() {
  const qs = serializeUrlState({ q: currentQuery, sel: selectedRef });
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
}

// Wait until Nominatim's ~1 request/second slot is free, then claim it.
async function claimNominatimSlot() {
  nominatimInFlight = true; // set before the wait, so a second tap meanwhile is ignored
  dom.button.disabled = true;
  const wait = MIN_NOMINATIM_INTERVAL_MS - (Date.now() - lastNominatimAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
}

function releaseNominatimSlot() {
  nominatimInFlight = false;
  dom.button.disabled = false;
}

// ---- Map -------------------------------------------------------------------

function streetLabel(candidate) {
  return candidate.tags.name || candidate.displayName.split(",")[0];
}

// Draw the chosen street on the map. `fit` moves the map to it; a tap leaves the view alone,
// because the reader is already looking at that street.
function showOnMap(candidate, { fit }) {
  highlightLayer.clearLayers();
  let shape = null;
  if (candidate.geometry) {
    shape = L.geoJSON(candidate.geometry, {
      style: HIGHLIGHT_STYLE,
      pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { ...HIGHLIGHT_STYLE, radius: 8 }),
    });
  } else if (Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon)) {
    shape = L.circleMarker([candidate.lat, candidate.lon], { ...HIGHLIGHT_STYLE, radius: 8 });
  }
  if (!shape) return;
  shape.bindTooltip(esc(streetLabel(candidate)), { sticky: true }).addTo(highlightLayer);
  if (fit) map.fitBounds(shape.getBounds(), { maxZoom: 17, padding: [24, 24] });
}

async function pickStreetAt(latlng) {
  if (nominatimInFlight) return;
  highlightLayer.clearLayers();
  L.circleMarker(latlng, { ...HIGHLIGHT_STYLE, radius: 6 }).addTo(highlightLayer);
  await claimNominatimSlot();
  setStatus("Finding the street here…");
  try {
    const candidate = await reverseStreet(latlng.lat, latlng.lng, { acceptLanguage: ACCEPT_LANGUAGE });
    if (!candidate) {
      highlightLayer.clearLayers();
      setStatus("No street right here. Tap on the line of a street.", "warn");
      return;
    }
    // A tap replaces the search: the query no longer describes what is on screen.
    currentQuery = "";
    lastResults = [candidate];
    renderCandidates(lastResults, candidate.ref);
    selectCandidate(candidate, { fitMap: false });
  } catch (err) {
    highlightLayer.clearLayers();
    setStatus(`Couldn’t find the street: ${err.message}. Please try again in a moment.`, "error");
  } finally {
    releaseNominatimSlot();
  }
}

function onMapTap(event) {
  if (map.getZoom() < MIN_PICK_ZOOM) {
    map.setView(event.latlng, Math.min(map.getZoom() + 4, MIN_PICK_ZOOM));
    return;
  }
  pickStreetAt(event.latlng);
}

function updateMapHint() {
  dom.mapHint.textContent =
    map.getZoom() < MIN_PICK_ZOOM
      ? "Tap the map to zoom in, then tap a street to see its names."
      : "Tap a street to see its names.";
}

// ---- Search & candidate selection ----------------------------------------

async function runSearch(query, { preselectRef = null } = {}) {
  if (!query) return;
  if (nominatimInFlight) return;

  await claimNominatimSlot();
  setStatus("Searching…");
  dom.candidates.hidden = true;
  dom.detail.hidden = true;

  try {
    const results = await searchStreets(query, { acceptLanguage: ACCEPT_LANGUAGE });
    lastResults = results;
    if (results.length === 0) {
      setStatus(`No places found for “${query}”. Try adding a city or region.`, "warn");
      return;
    }
    renderCandidates(results, preselectRef);
    const chosen =
      (preselectRef && results.find((r) => r.ref === preselectRef)) || results[0];
    selectCandidate(chosen);
  } catch (err) {
    setStatus(`Search failed: ${err.message}. Please try again in a moment.`, "error");
  } finally {
    releaseNominatimSlot();
  }
}

// Reopen a shared link that names a street picked on the map: there is no query, so look the
// element up directly.
async function loadSelectedRef(ref) {
  await claimNominatimSlot();
  setStatus("Loading the street…");
  try {
    const candidate = await lookupStreet(ref, { acceptLanguage: ACCEPT_LANGUAGE });
    if (!candidate) {
      setStatus("That street is no longer on OpenStreetMap. Search or tap the map.", "warn");
      return;
    }
    lastResults = [candidate];
    selectCandidate(candidate);
  } catch (err) {
    setStatus(`Couldn’t load the street: ${err.message}. Please try again in a moment.`, "error");
  } finally {
    releaseNominatimSlot();
  }
}

function renderCandidates(results, activeRef) {
  if (results.length <= 1) {
    dom.candidates.hidden = true;
    dom.candidates.innerHTML = "";
    return;
  }
  const active = activeRef || results[0].ref;
  dom.candidates.innerHTML = `
    <h2 class="section-title">${results.length} matches — pick one</h2>
    <ul class="candidate-list">
      ${results
        .map(
          (r) => `
        <li>
          <button type="button" class="candidate${r.ref === active ? " candidate--active" : ""}" data-ref="${esc(r.ref)}">
            <span class="candidate__name">${esc(streetLabel(r))}</span>
            <span class="candidate__meta">${esc(r.displayName)}</span>
            <span class="candidate__kind">${esc(r.type || r.category || "place")}</span>
          </button>
        </li>`
        )
        .join("")}
    </ul>`;
  dom.candidates.hidden = false;
  dom.candidates.querySelectorAll(".candidate").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ref = btn.getAttribute("data-ref");
      const candidate = lastResults.find((r) => r.ref === ref);
      if (candidate) selectCandidate(candidate);
    });
  });
}

function markActiveCandidate(ref) {
  dom.candidates.querySelectorAll(".candidate").forEach((btn) => {
    btn.classList.toggle("candidate--active", btn.getAttribute("data-ref") === ref);
  });
}

function selectCandidate(candidate, { fitMap = true } = {}) {
  selectedRef = candidate.ref;
  markActiveCandidate(candidate.ref);
  syncUrl();
  showOnMap(candidate, { fit: fitMap });
  renderDetail(candidate);
}

// ---- Detail rendering ------------------------------------------------------

function nameRowsHtml(entries, badgeFor) {
  return entries
    .map(
      (e) => `
      <li class="name-row">
        <span class="name-row__value">${esc(e.value)}</span>
        <span class="name-row__badge">${esc(badgeFor(e))}</span>
      </li>`
    )
    .join("");
}

function currentBadge(e) {
  if (e.lang) return e.role === "primary" ? e.langLabel : `${e.langLabel} · ${e.roleLabel}`;
  if (e.variant) return `${e.roleLabel} (${e.variant})`;
  return e.roleLabel;
}

function historicalBadge(e) {
  return e.periodLabel || e.langLabel || "former name";
}

function renderDetail(candidate) {
  const names = extractNames(candidate.tags);
  const heading = names.current[0]?.value || candidate.displayName.split(",")[0];
  const langNote = names.languageCount
    ? `${names.languageCount} language${names.languageCount === 1 ? "" : "s"}`
    : "";

  dom.detail.innerHTML = `
    <header class="detail__head">
      <h2 class="detail__title">${esc(heading)}</h2>
      <p class="detail__place">${esc(candidate.displayName)}</p>
      ${langNote ? `<p class="detail__note">Recorded in ${esc(langNote)} on OpenStreetMap.</p>` : ""}
    </header>

    <section class="panel">
      <h3 class="section-title">Current names</h3>
      ${
        names.current.length
          ? `<ul class="name-list">${nameRowsHtml(names.current, currentBadge)}</ul>`
          : `<p class="empty">This element has no name tags.</p>`
      }
    </section>

    <section class="panel">
      <h3 class="section-title">Former names</h3>
      ${
        names.historical.length
          ? `<ul class="name-list">${nameRowsHtml(names.historical, historicalBadge)}</ul>`
          : `<p class="empty">No former names recorded in OpenStreetMap for this street.</p>`
      }
    </section>

    <section class="panel" id="history-panel">
      <h3 class="section-title">Named after &amp; history</h3>
      <div id="etymology-slot">${
        names.etymology.text
          ? `<p class="etymology-text">${esc(names.etymology.text)}</p>`
          : ""
      }</div>
      <div id="wikidata-slot" class="enrich-slot"></div>
      <div id="ohm-slot" class="enrich-slot"></div>
    </section>`;
  dom.detail.hidden = false;
  setStatus("");

  enrich(candidate, names);
}

async function enrich(candidate, names) {
  const wikidataSlot = dom.detail.querySelector("#wikidata-slot");
  const ohmSlot = dom.detail.querySelector("#ohm-slot");
  const ids = collectWikidataIds(candidate.tags);

  if (ids.length) wikidataSlot.innerHTML = `<p class="loading">Loading Wikidata…</p>`;
  if (Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon)) {
    ohmSlot.innerHTML = `<p class="loading">Checking OpenHistoricalMap…</p>`;
  }

  const [wikidata, ohm] = await Promise.allSettled([
    fetchWikidata(ids),
    fetchOhmTimeline(candidate.lat, candidate.lon),
  ]);

  renderWikidata(wikidataSlot, candidate, names, wikidata);
  renderOhm(ohmSlot, ohm);
}

async function renderWikidata(slot, candidate, names, settled) {
  if (settled.status === "rejected") {
    slot.innerHTML = `<p class="enrich-error">Couldn’t reach Wikidata.</p>`;
    return;
  }
  let entities = settled.value || {};
  const streetId = names.wikidata;
  const etymId = names.etymology.wikidata;
  const parts = [];

  const street = streetId ? entities[streetId] : null;
  if (street && !street.missing) {
    const desc = pickBest(street.descriptions, VIEWER_LANGS);
    if (desc) parts.push(`<p class="wd-desc">${esc(desc.value)}</p>`);
    if (street.inception) parts.push(`<p class="wd-fact"><strong>Established:</strong> ${esc(street.inception)}</p>`);
  }

  // The honoree: prefer the explicit etymology entity, else the street's "named after" (P138).
  let honoreeId = etymId;
  if (!honoreeId && street && street.namedAfter.length) {
    honoreeId = street.namedAfter[0];
    // P138 target wasn't in the first batch — fetch it best-effort.
    try {
      const extra = await fetchWikidata([honoreeId]);
      entities = { ...entities, ...extra };
    } catch {
      /* leave honoree unresolved */
    }
  }
  const honoree = honoreeId ? entities[honoreeId] : null;
  if (honoree && !honoree.missing) {
    const label = pickBest(honoree.labels, VIEWER_LANGS);
    const desc = pickBest(honoree.descriptions, VIEWER_LANGS);
    if (label) {
      parts.push(
        `<p class="wd-fact"><strong>Named after:</strong> ` +
          `<a href="https://www.wikidata.org/wiki/${esc(honoree.id)}" target="_blank" rel="noopener">${esc(label.value)}</a>` +
          (desc ? ` — ${esc(desc.value)}` : "") +
          `</p>`
      );
    }
  }

  if (streetId) {
    parts.push(
      `<p class="wd-link"><a href="https://www.wikidata.org/wiki/${esc(streetId)}" target="_blank" rel="noopener">View on Wikidata →</a></p>`
    );
  }

  slot.innerHTML = parts.join("");
}

function renderOhm(slot, settled) {
  if (settled.status === "rejected") {
    slot.innerHTML = `<p class="enrich-error">Couldn’t reach OpenHistoricalMap.</p>`;
    return;
  }
  const rows = settled.value || [];
  if (rows.length === 0) {
    slot.innerHTML = "";
    return;
  }
  slot.innerHTML = `
    <h4 class="subsection-title">OpenHistoricalMap timeline</h4>
    <ul class="timeline">
      ${rows
        .map((r) => {
          const period =
            r.start || r.end ? `${esc(r.start || "?")} – ${esc(r.end || "present")}` : "undated";
          return `<li class="timeline__row">
            <span class="timeline__name">${esc(r.name)}</span>
            <span class="timeline__period">${period}</span>
          </li>`;
        })
        .join("")}
    </ul>`;
}

// ---- URL state & wiring ----------------------------------------------------

function loadFromUrl() {
  const state = parseUrlState(location.search);
  currentQuery = state.q;
  selectedRef = state.sel;
  if (state.q) {
    dom.input.value = state.q;
    runSearch(state.q, { preselectRef: state.sel });
  } else if (state.sel) {
    loadSelectedRef(state.sel);
  }
}

function init() {
  map.on("click", onMapTap);
  map.on("zoomend", updateMapHint);
  updateMapHint();

  dom.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = dom.input.value.trim();
    if (!q) return;
    currentQuery = q;
    selectedRef = null; // a fresh query invalidates any prior selection
    syncUrl();
    runSearch(q);
  });

  dom.copyLink.addEventListener("click", async () => {
    syncUrl();
    try {
      await navigator.clipboard.writeText(location.href);
      dom.shareStatus.textContent = "Link copied!";
    } catch {
      dom.shareStatus.textContent = "Couldn’t copy — use the address bar.";
    }
    setTimeout(() => {
      dom.shareStatus.textContent = "";
    }, 2000);
  });

  loadFromUrl();
}

init();
