// Pure URL/query builders and response parsers for the three external data sources.
// No DOM, no `fetch` here -- data-source.js owns the network. Keeping the builders and
// parsers pure means the whole request/response contract is unit-testable without a browser.
//
// Sources:
//   - Nominatim (OpenStreetMap geocoder): free-text street search -> candidate places + tags
//   - Wikidata (wbgetentities REST): multilingual labels/descriptions + "named after" (P138)
//   - OpenHistoricalMap (its own Overpass endpoint): time-versioned historical features nearby

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const WIKIDATA_BASE = "https://www.wikidata.org/w/api.php";
export const OHM_OVERPASS_URL = "https://overpass-api.openhistoricalmap.org/api/interpreter";

// OSM highway types we treat as "street-like" so real streets rank above POIs/areas that
// happen to share the name. Non-streets are still shown, just after streets.
const STREET_TYPES = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
  "residential", "living_street", "pedestrian", "footway", "path", "road",
  "cycleway", "service", "track", "street",
]);

// ---- Nominatim ------------------------------------------------------------

export function buildNominatimUrl(query, { limit = 8, acceptLanguage } = {}) {
  const params = new URLSearchParams({
    q: String(query || "").trim(),
    format: "jsonv2",
    addressdetails: "1",
    namedetails: "1", // returns name, name:*, old_name, alt_name, etc.
    extratags: "1", // returns wikidata, name:etymology:wikidata, wikipedia, etc.
    limit: String(limit),
  });
  if (acceptLanguage) params.set("accept-language", acceptLanguage);
  return `${NOMINATIM_BASE}?${params.toString()}`;
}

export function isStreetLike(candidate) {
  if (!candidate) return false;
  return candidate.category === "highway" || STREET_TYPES.has(candidate.type);
}

// Normalize Nominatim's jsonv2 array into candidate records, merging namedetails + extratags
// into one `tags` bag (the single source of truth the name extractor reads). Street-like
// candidates are sorted first, then by Nominatim's own importance score.
export function parseNominatimResults(json) {
  const arr = Array.isArray(json) ? json : [];
  const candidates = arr
    .filter((r) => r && r.osm_type && r.osm_id != null)
    .map((r) => ({
      osmType: r.osm_type,
      osmId: r.osm_id,
      ref: `${r.osm_type}/${r.osm_id}`,
      displayName: r.display_name || "",
      lat: Number(r.lat),
      lon: Number(r.lon),
      category: r.category || r.class || null,
      type: r.type || null,
      importance: typeof r.importance === "number" ? r.importance : 0,
      address: r.address || {},
      tags: { ...(r.namedetails || {}), ...(r.extratags || {}) },
    }));
  candidates.sort((a, b) => {
    const sa = isStreetLike(a) ? 1 : 0;
    const sb = isStreetLike(b) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return b.importance - a.importance;
  });
  return candidates;
}

// ---- Wikidata -------------------------------------------------------------

export function buildWikidataUrl(ids) {
  const clean = (Array.isArray(ids) ? ids : [])
    .filter((id) => typeof id === "string" && /^Q\d+$/.test(id))
    .filter((id, i, a) => a.indexOf(id) === i);
  if (clean.length === 0) return null;
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: clean.join("|"),
    props: "labels|descriptions|claims",
    format: "json",
    origin: "*", // required for anonymous CORS access
  });
  return `${WIKIDATA_BASE}?${params.toString()}`;
}

function claimIds(entity, property) {
  const claims = (entity.claims && entity.claims[property]) || [];
  return claims
    .map((c) => c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value)
    .filter((v) => v && typeof v.id === "string")
    .map((v) => v.id);
}

// Extract the year from a Wikidata time claim (e.g. inception P571 -> "+1889-00-00T..." -> "1889").
export function formatWikidataTime(entity, property = "P571") {
  const claims = (entity.claims && entity.claims[property]) || [];
  for (const c of claims) {
    const time = c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.time;
    if (typeof time === "string") {
      const m = /^[+-](\d{1,4})/.exec(time);
      if (m) return String(parseInt(m[1], 10));
    }
  }
  return null;
}

export function parseWikidataEntities(json) {
  const out = {};
  const entities = (json && json.entities) || {};
  for (const [id, ent] of Object.entries(entities)) {
    if (ent.missing !== undefined) {
      out[id] = { id, missing: true, labels: {}, descriptions: {}, namedAfter: [], inception: null };
      continue;
    }
    const labels = {};
    for (const [lang, o] of Object.entries(ent.labels || {})) {
      if (o && typeof o.value === "string") labels[lang] = o.value;
    }
    const descriptions = {};
    for (const [lang, o] of Object.entries(ent.descriptions || {})) {
      if (o && typeof o.value === "string") descriptions[lang] = o.value;
    }
    out[id] = {
      id,
      missing: false,
      labels,
      descriptions,
      namedAfter: claimIds(ent, "P138"),
      inception: formatWikidataTime(ent, "P571"),
    };
  }
  return out;
}

// Pick the best available label/description for a viewer, trying preferred languages in order,
// then English, then any available value.
export function pickBest(map, preferred = []) {
  if (!map || typeof map !== "object") return null;
  for (const lang of preferred) {
    if (map[lang]) return { lang, value: map[lang] };
  }
  if (map.en) return { lang: "en", value: map.en };
  const keys = Object.keys(map);
  return keys.length ? { lang: keys[0], value: map[keys[0]] } : null;
}

// ---- OpenHistoricalMap ----------------------------------------------------

// Overpass QL to find historical named roads near a point. OHM tags features with
// start_date / end_date, which is exactly the time dimension OSM proper lacks.
export function buildOhmQuery(lat, lon, radius = 45) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return `[out:json][timeout:25];
(
  way(around:${radius},${la},${lo})["highway"]["name"];
  way(around:${radius},${la},${lo})["highway"]["old_name"];
);
out tags center 40;`;
}

// Turn an OHM Overpass response into a de-duplicated, chronologically sorted timeline.
export function parseOhmTimeline(json) {
  const elements = (json && Array.isArray(json.elements) && json.elements) || [];
  const seen = new Set();
  const rows = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags.old_name;
    if (!name) continue;
    const start = tags.start_date || null;
    const end = tags.end_date || null;
    const key = `${name}|${start}|${end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, start, end, wasOld: !tags.name && Boolean(tags.old_name) });
  }
  rows.sort((a, b) => {
    const ya = a.start ? parseInt(a.start, 10) : Infinity;
    const yb = b.start ? parseInt(b.start, 10) : Infinity;
    if (ya !== yb) return ya - yb;
    return a.name.localeCompare(b.name);
  });
  return rows;
}
