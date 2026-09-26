// The fire-behaviour rules the map draws with: colours, sizes, the fire-weather
// danger level, the past-size estimate and the forecast spread shape.
//
// These are simple stand-ins, not the real models. The spread shape copies the
// idea of ELMFIRE's output (a fire grows fastest downwind, so its outline is a
// wind-stretched ellipse), not its physics. See ADR 0001.

import { destination } from "./geo.js";

export const CONFIDENCE_COLORS = { low: "#f2c230", medium: "#f07b1f", high: "#d62828" };

export function confidenceColor(level) {
  return CONFIDENCE_COLORS[level] ?? CONFIDENCE_COLORS.low;
}

/** Marker radius in pixels: the area grows with fire radiative power (MW), up to a cap. */
export function frpToPixels(frp) {
  return Math.min(24, 6 + Math.sqrt(Math.max(0, frp)) * 1.6);
}

/** Wind speed bands (km/h) and their colours, calm to gale. */
export const WIND_BANDS = [
  { max: 10, color: "#9ecae1", label: "<10" },
  { max: 20, color: "#4292c6", label: "10-20" },
  { max: 30, color: "#2171b5", label: "20-30" },
  { max: 40, color: "#6a3d9a", label: "30-40" },
  { max: Infinity, color: "#b0178a", label: "40+" },
];

export function windBand(kmh) {
  return WIND_BANDS.findIndex((b) => kmh < b.max);
}

export const DANGER_LEVELS = [
  { id: "low", label: "Low", max: 20, color: "#4caf50" },
  { id: "moderate", label: "Moderate", max: 40, color: "#c0ca33" },
  { id: "high", label: "High", max: 60, color: "#ffa000" },
  { id: "very-high", label: "Very high", max: 80, color: "#e64a19" },
  { id: "extreme", label: "Extreme", max: Infinity, color: "#8e0000" },
];

/**
 * A fire-weather danger score from wind, temperature and humidity. Each term
 * only pushes the score up as conditions get windier, hotter or drier.
 */
export function fireDanger({ windKmh, tempC, humidity }) {
  const score =
    Math.max(0, windKmh) * 0.8 + Math.max(0, tempC - 15) * 1.2 + Math.max(0, 60 - humidity) * 0.8;
  const level = DANGER_LEVELS.find((l) => score < l.max);
  return { score, level: level.id, label: level.label, color: level.color };
}

/** Wind is reported as the direction it comes from; a fire runs the other way. */
export function downwindBearing(windFrom) {
  return (windFrom + 180) % 360;
}

/**
 * Burning radius now. A real fire carries the radius measured from its
 * satellite pixels; a demo fire gets an estimate from its radiative power.
 */
export function currentRadiusKm(fire) {
  return fire.radiusKm ?? Math.sqrt(fire.frp) * 0.12;
}

/**
 * Estimated radius `hoursAgo` in the past, rebuilt from the MTG scan series.
 * Null when MTG has not seen the fire (there is no series), zero before the
 * fire was first detected.
 */
export function pastRadiusKm(fire, hoursAgo) {
  if (!fire.mtg?.confirmed) return null;
  const left = 1 - (hoursAgo * 60) / fire.ageMin;
  if (left <= 0) return 0;
  return currentRadiusKm(fire) * Math.sqrt(left);
}

/**
 * The forecast outline after `hours`: an ellipse whose long axis follows the
 * wind. The head runs downwind, the back creeps upwind, the flanks spread
 * slower as the wind gets stronger. `weather` defaults to the fire's current
 * reading; real mode passes the forecast mean for the window.
 */
export function spreadEllipse(fire, hours, weather = fire.weather) {
  const { windFrom, windKmh } = weather;
  const danger = fireDanger(weather).score;
  const rate = (0.1 + 0.03 * windKmh) * (0.6 + danger / 100) * Math.pow(Math.max(fire.frp, 1) / 50, 0.3);
  const start = currentRadiusKm(fire);
  const head = start + rate * hours;
  const back = start + rate * hours * (1 / (1 + windKmh / 8));
  const semiMajorKm = (head + back) / 2;
  const semiMinorKm = start + (rate * hours) / (1 + windKmh / 15);
  const bearing = downwindBearing(windFrom);
  const centre = destination(fire, bearing, (head - back) / 2);
  return { centre, semiMajorKm, semiMinorKm, bearing };
}

/** The ellipse as a ring of points, optionally scaled for the uncertainty band. */
export function ellipsePolygon(ellipse, scale = 1, steps = 48) {
  const ring = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const along = ellipse.semiMajorKm * scale * Math.cos(t);
    const across = ellipse.semiMinorKm * scale * Math.sin(t);
    const km = Math.hypot(along, across);
    const angle = (Math.atan2(across, along) * 180) / Math.PI;
    ring.push(km === 0 ? ellipse.centre : destination(ellipse.centre, ellipse.bearing + angle, km));
  }
  return ring;
}
