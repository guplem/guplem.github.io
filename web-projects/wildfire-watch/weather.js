// Open-Meteo: free, no key, and it sends CORS headers, so the page calls it
// directly. One call covers many points.

const VARS = "wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m";

export function openMeteoUrl(points, { hours = 25 } = {}) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", points.map((p) => +p.lat.toFixed(3)).join(","));
  url.searchParams.set("longitude", points.map((p) => +p.lon.toFixed(3)).join(","));
  url.searchParams.set("current", VARS);
  url.searchParams.set("hourly", VARS);
  url.searchParams.set("forecast_hours", String(hours));
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "GMT");
  return url.toString();
}

const reading = (src, i) => {
  const pick = (name) => (i === undefined ? src[name] : src[name][i]);
  return {
    windFrom: pick("wind_direction_10m"),
    windKmh: pick("wind_speed_10m"),
    tempC: pick("temperature_2m"),
    humidity: pick("relative_humidity_2m"),
  };
};

/** One location comes back as an object, several as a list. */
export function parseOpenMeteo(json) {
  return (Array.isArray(json) ? json : [json]).map((loc) => ({
    current: reading(loc.current),
    hourly: loc.hourly.time.map((t, i) => ({ time: Date.parse(`${t}:00Z`), ...reading(loc.hourly, i) })),
  }));
}

/**
 * The mean weather over `hours` from `start`. Wind direction is averaged as a
 * vector, so 350° and 10° give 0°, not 180°.
 */
export function meanWeather(weather, start, hours) {
  const rows = weather.hourly.filter((h) => h.time >= start && h.time < start + hours * 3_600_000);
  if (!rows.length) return weather.current;
  const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  let u = 0;
  let v = 0;
  for (const r of rows) {
    const rad = (r.windFrom * Math.PI) / 180;
    u += Math.sin(rad) * r.windKmh;
    v += Math.cos(rad) * r.windKmh;
  }
  return {
    windFrom: ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360,
    windKmh: mean("windKmh"),
    tempC: mean("tempC"),
    humidity: mean("humidity"),
  };
}

/** An n-by-n grid of points inside the view, at the centres of the cells. */
export function gridPoints({ south, west, north, east }, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      pts.push({ lat: south + ((i + 0.5) * (north - south)) / n, lon: west + ((j + 0.5) * (east - west)) / n });
    }
  }
  return pts;
}
