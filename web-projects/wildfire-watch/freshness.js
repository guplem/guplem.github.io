// The footer's per-source freshness line. Each layer says how stale it is, so a
// reader never mistakes a model run or a static layer for a live reading.

export function formatAge(ms) {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "<1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** Minutes until the next scan of a source that scans every `cadenceMin`. */
export function nextScanMinutes(sinceLastMs, cadenceMin) {
  const left = cadenceMin - Math.floor(sinceLastMs / 60_000);
  return Math.max(1, left);
}

export function clockTime(ms, timeZone) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(ms);
}

/** @param {{deepfire:number, mtg:number, weather:number, elmfire:number}} updated timestamps */
export function freshnessLine(now, updated, timeZone) {
  return [
    `Deepfire: updated ${formatAge(now - updated.deepfire)} ago`,
    `MTG: next scan in ${nextScanMinutes(now - updated.mtg, 10)}m`,
    `WeatherNext: updated ${formatAge(now - updated.weather)} ago`,
    `ELMFIRE: model run ${clockTime(updated.elmfire, timeZone)}`,
  ];
}

/**
 * Real mode. The FIRMS age is the newest satellite pass, which is what the
 * reader cares about; the copy's age says whether the feed itself is stuck.
 * @param {{newestPass:number, feedBuilt:number, weather:number|null, fwiDay:string}} at
 */
export function realFreshnessLine(now, at) {
  return [
    at.newestPass
      ? `NASA FIRMS: newest satellite pass ${formatAge(now - at.newestPass)} ago (copy refreshed ${formatAge(now - at.feedBuilt)} ago)`
      : "NASA FIRMS: not loaded",
    at.weather ? `Open-Meteo: updated ${formatAge(now - at.weather)} ago` : "Open-Meteo: not loaded yet",
    `EFFIS fire danger: forecast for ${at.fwiDay}`,
  ];
}
