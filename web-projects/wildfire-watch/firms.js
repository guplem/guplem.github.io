// NASA FIRMS active-fire files: which ones the feed copies, and how to read
// them. The files need no key, but they send no CORS header, so a browser
// cannot read them directly. A scheduled GitHub Action copies them into the
// feed that the page reads (ADR 0002).

const BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire";

/** The four satellites that cover Europe, as 48-hour files. */
export const FIRMS_SOURCES = [
  { key: "VIIRS_SNPP", satellite: "Suomi NPP", sensor: "VIIRS", pixelKm: 0.375, url: `${BASE}/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Europe_48h.csv` },
  { key: "VIIRS_NOAA20", satellite: "NOAA-20", sensor: "VIIRS", pixelKm: 0.375, url: `${BASE}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_48h.csv` },
  { key: "VIIRS_NOAA21", satellite: "NOAA-21", sensor: "VIIRS", pixelKm: 0.375, url: `${BASE}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Europe_48h.csv` },
  { key: "MODIS", satellite: "Terra and Aqua", sensor: "MODIS", pixelKm: 1, url: `${BASE}/modis-c6.1/csv/MODIS_C6_1_Europe_48h.csv` },
];

export const sourceByKey = (key) => FIRMS_SOURCES.find((s) => s.key === key);

/** FIRMS gives the UTC date and the time as HHMM, sometimes without the zeros. */
export function firmsTime(date, hhmm) {
  const t = String(hhmm).padStart(4, "0");
  return Date.parse(`${date}T${t.slice(0, 2)}:${t.slice(2)}:00Z`);
}

/**
 * VIIRS writes low / nominal / high (or l / n / h). MODIS writes a percentage;
 * FIRMS calls under 30 low and 80 or more high.
 */
export function firmsConfidence(value) {
  const v = String(value).trim().toLowerCase();
  if (v === "l" || v === "low") return "low";
  if (v === "n" || v === "nominal") return "medium";
  if (v === "h" || v === "high") return "high";
  const pct = Number(v);
  if (Number.isNaN(pct)) return "low";
  if (pct < 30) return "low";
  if (pct < 80) return "medium";
  return "high";
}

/** Read one FIRMS CSV file into detections. Broken rows are skipped. */
export function parseFirmsCsv(text, sourceKey) {
  const lines = String(text).trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(",");
  const col = (name) => head.indexOf(name);
  const iLat = col("latitude"), iLon = col("longitude"), iDate = col("acq_date"), iTime = col("acq_time");
  const iConf = col("confidence"), iFrp = col("frp");
  const out = [];
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    if (f.length !== head.length) continue;
    const lat = Number(f[iLat]);
    const lon = Number(f[iLon]);
    const time = firmsTime(f[iDate], f[iTime]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Number.isNaN(time)) continue;
    out.push({ lat, lon, frp: Number(f[iFrp]) || 0, confidence: firmsConfidence(f[iConf]), time, source: sourceKey });
  }
  return out;
}
