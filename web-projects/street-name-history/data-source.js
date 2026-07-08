// The ONLY module that touches the network (mirrors liga-under-tkd/data-source.js).
// It wraps the three external APIs behind small async functions; every builder/parser it
// calls is pure and lives in sources.js. Callers handle errors and render fallbacks.
//
// Usage-policy note (Nominatim): the public endpoint allows ~1 request/second and forbids
// autocomplete-style per-keystroke querying, so app.js only searches on submit and throttles.
// Attribution is shown in the UI. See adr/0001.

import {
  buildNominatimUrl,
  parseNominatimResults,
  buildWikidataUrl,
  parseWikidataEntities,
  buildOhmQuery,
  parseOhmTimeline,
  OHM_OVERPASS_URL,
} from "./sources.js";

async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

// Free-text street search. Returns candidate places (street-like first). Throws on failure.
export async function searchStreets(query, { acceptLanguage } = {}) {
  const url = buildNominatimUrl(query, { acceptLanguage });
  const json = await getJson(url, { headers: { Accept: "application/json" } });
  return parseNominatimResults(json);
}

// Fetch Wikidata entities for the given QIDs. Returns {} when there is nothing to fetch, so a
// street with no wikidata links simply renders no etymology panel rather than erroring.
export async function fetchWikidata(ids) {
  const url = buildWikidataUrl(ids);
  if (!url) return {};
  const json = await getJson(url, { headers: { Accept: "application/json" } });
  return parseWikidataEntities(json);
}

// Best-effort historical timeline from OpenHistoricalMap around a coordinate.
// Returns [] when coordinates are missing or the endpoint yields nothing.
export async function fetchOhmTimeline(lat, lon) {
  const query = buildOhmQuery(lat, lon);
  if (!query) return [];
  const json = await getJson(OHM_OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });
  return parseOhmTimeline(json);
}
