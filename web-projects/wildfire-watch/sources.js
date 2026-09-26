// URL builders and readers for the other live sources. All of them are free,
// need no key and send CORS headers, so the page calls them directly:
// - EEA Natura 2000 (protected sites), an ArcGIS REST service
// - EFFIS (burnt areas this season, and the Fire Weather Index map)
// - Open-Meteo place search

const NATURA = "https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer";
export const EFFIS = "https://maps.effis.emergency.copernicus.eu/effis";

/** Natura 2000 has three layers: Habitats sites (0), Birds sites (1) and both (2). */
export function naturaQueryUrl(point, km, layer) {
  const url = new URL(`${NATURA}/${layer}/query`);
  const p = url.searchParams;
  p.set("geometry", `${point.lon},${point.lat}`);
  p.set("geometryType", "esriGeometryPoint");
  p.set("inSR", "4326");
  p.set("spatialRel", "esriSpatialRelIntersects");
  p.set("distance", String(km));
  p.set("units", "esriSRUnit_Kilometer");
  p.set("outFields", "SITENAME,SITECODE");
  p.set("returnGeometry", "true");
  // About 200 m: enough for "inside or how far", and it keeps the answer small.
  p.set("maxAllowableOffset", "0.002");
  p.set("outSR", "4326");
  p.set("f", "geojson");
  return url.toString();
}

const ringToPoints = (ring) => ring.map(([lon, lat]) => ({ lat, lon }));

/** Outer rings only: holes are rare in these sites and do not change the answer much. */
function outerRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [ringToPoints(geometry.coordinates[0])];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((poly) => ringToPoints(poly[0]));
  return [];
}

/** Read one or more Natura 2000 answers; a site in two layers appears once. */
export function parseNatura(...answers) {
  const seen = new Map();
  for (const answer of answers) {
    for (const f of answer?.features ?? []) {
      const code = f.properties?.SITECODE;
      if (!code || seen.has(code)) continue;
      seen.set(code, { name: f.properties.SITENAME, code, polygons: outerRings(f.geometry) });
    }
  }
  return [...seen.values()];
}

export function burntAreasUrl({ south, west, north, east }) {
  const url = new URL(EFFIS);
  const p = url.searchParams;
  p.set("service", "WFS");
  p.set("version", "1.1.0");
  p.set("request", "GetFeature");
  p.set("typename", "modis.ba.poly.season");
  p.set("bbox", `${south},${west},${north},${east},EPSG:4326`);
  p.set("maxfeatures", "500");
  p.set("outputformat", "geojson");
  return url.toString();
}

/** EFFIS writes UTC times as "YYYY-MM-DD hh:mm:ss". */
const effisTime = (text) => (text ? Date.parse(`${String(text).slice(0, 19).replace(" ", "T")}Z`) : NaN);

export function parseBurntAreas(answer) {
  return (answer?.features ?? []).map((f) => {
    const p = f.properties ?? {};
    const where = [p.COMMUNE, p.PROVINCE].filter(Boolean).join(", ");
    return {
      id: p.id,
      fireDate: effisTime(p.FIREDATE),
      lastUpdate: effisTime(p.LASTUPDATE),
      areaHa: Number(p.AREA_HA) || 0,
      place: p.COUNTRY ? `${where} (${p.COUNTRY})` : where,
      polygons: outerRings(f.geometry),
    };
  });
}

/** The EFFIS Fire Weather Index map is drawn per UTC day. */
export function fwiDate(now) {
  return new Date(now).toISOString().slice(0, 10);
}

export function fwiLegendUrl() {
  return `${EFFIS}?language=eng&version=1.1.1&service=WMS&request=GetLegendGraphic&layer=mf010.fwi&format=image/png&STYLE=default`;
}

export function geocodingUrl(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  return url.toString();
}

export function parseGeocoding(answer) {
  return (answer?.results ?? []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    population: r.population ?? 0,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  }));
}
