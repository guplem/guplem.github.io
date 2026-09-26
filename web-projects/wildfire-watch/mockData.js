// Demo mode data (`?mode=demo`). Every fire, detection and weather reading here
// is invented; the towns and protected areas are real places with rough
// outlines. The mode switch and the demo texts say so. See ADR 0001.

import { idw } from "./geo.js";

/** Deepfire hotspots. `ageMin` is the time since Deepfire first detected them. */
export const FIRES = [
  {
    id: "bergueda", name: "Berguedà slope", lat: 42.078, lon: 1.866, frp: 85, confidence: "high", ageMin: 220,
    mtg: { confirmed: true, minAgo: 6 },
    weather: { windFrom: 250, windKmh: 28, tempC: 34, humidity: 18 },
  },
  {
    id: "cardo", name: "Serra de Cardó", lat: 40.93, lon: 0.56, frp: 40, confidence: "medium", ageMin: 95,
    mtg: { confirmed: true, minAgo: 6 },
    weather: { windFrom: 300, windKmh: 35, tempC: 31, humidity: 22 },
  },
  {
    id: "montsant", name: "Montsant ridge", lat: 41.285, lon: 0.83, frp: 22, confidence: "medium", ageMin: 25,
    mtg: { confirmed: false },
    weather: { windFrom: 200, windKmh: 15, tempC: 29, humidity: 30 },
  },
  {
    id: "solsones", name: "Solsonès field", lat: 42.02, lon: 1.545, frp: 9, confidence: "low", ageMin: 7,
    mtg: { confirmed: false },
    weather: { windFrom: 270, windKmh: 12, tempC: 30, humidity: 35 },
  },
  {
    id: "montseny", name: "Montseny foothills", lat: 41.76, lon: 2.37, frp: 55, confidence: "high", ageMin: 300,
    mtg: { confirmed: true, minAgo: 16 },
    weather: { windFrom: 20, windKmh: 22, tempC: 27, humidity: 28 },
  },
  {
    id: "noguera", name: "Noguera scrub", lat: 41.9, lon: 0.85, frp: 14, confidence: "low", ageMin: 50,
    mtg: { confirmed: true, minAgo: 6 },
    weather: { windFrom: 290, windKmh: 18, tempC: 33, humidity: 20 },
  },
];

/** Detections MTG has made that Deepfire has not confirmed yet. */
export const MTG_ONLY = [
  { id: "mtg-garrotxa", name: "Garrotxa (MTG only)", lat: 42.15, lon: 2.52, frp: 12, minAgo: 4 },
  { id: "mtg-priorat", name: "Priorat (MTG only)", lat: 41.18, lon: 0.95, frp: 8, minAgo: 9 },
];

/** Population centres (approximate municipal populations). */
export const TOWNS = [
  { name: "Barcelona", lat: 41.387, lon: 2.17, population: 1620000 },
  { name: "Lleida", lat: 41.617, lon: 0.62, population: 140000 },
  { name: "Tarragona", lat: 41.119, lon: 1.245, population: 136000 },
  { name: "Reus", lat: 41.156, lon: 1.107, population: 106000 },
  { name: "Girona", lat: 41.979, lon: 2.821, population: 103000 },
  { name: "Manresa", lat: 41.728, lon: 1.824, population: 78000 },
  { name: "Vic", lat: 41.93, lon: 2.254, population: 47000 },
  { name: "Figueres", lat: 42.267, lon: 2.961, population: 47000 },
  { name: "Olot", lat: 42.181, lon: 2.49, population: 36000 },
  { name: "Tortosa", lat: 40.812, lon: 0.521, population: 33000 },
  { name: "Berga", lat: 42.104, lon: 1.845, population: 17000 },
  { name: "La Seu d'Urgell", lat: 42.358, lon: 1.456, population: 12000 },
  { name: "Ripoll", lat: 42.201, lon: 2.19, population: 11000 },
  { name: "Solsona", lat: 41.994, lon: 1.518, population: 9000 },
  { name: "Puigcerdà", lat: 42.432, lon: 1.928, population: 9000 },
  { name: "Tremp", lat: 42.167, lon: 0.894, population: 6000 },
  { name: "Gandesa", lat: 41.052, lon: 0.437, population: 3000 },
  { name: "Falset", lat: 41.145, lon: 0.82, population: 2800 },
  { name: "Balaguer", lat: 41.79, lon: 0.81, population: 17000 },
];

const box = (south, west, north, east) => [
  { lat: south, lon: west }, { lat: south, lon: east }, { lat: north, lon: east }, { lat: north, lon: west },
];

/** Protected natural areas, as rough outlines. */
export const PROTECTED_AREAS = [
  { name: "Cadí-Moixeró Natural Park", polygon: box(42.22, 1.6, 42.33, 1.95) },
  { name: "Montseny Natural Park", polygon: box(41.72, 2.3, 41.83, 2.5) },
  { name: "Els Ports Natural Park", polygon: box(40.72, 0.22, 40.9, 0.45) },
  { name: "Garrotxa Volcanic Zone", polygon: box(42.1, 2.45, 42.2, 2.6) },
  { name: "Serra de Montsant Natural Park", polygon: box(41.25, 0.75, 41.32, 0.9) },
  { name: "Sant Llorenç del Munt Natural Park", polygon: box(41.62, 1.95, 41.7, 2.05) },
  { name: "Aigüestortes National Park", polygon: box(42.52, 0.85, 42.62, 1.1) },
];

/** A demo location used when the browser will not share one. */
export const DEMO_LOCATION = { lat: 41.387, lon: 2.17, label: "Barcelona (demo location)" };

/**
 * A coarse wind field over Catalonia, blended from the fire-site readings.
 * Directions are blended as vectors so 350 and 10 average to 0, not 180.
 */
export function windGrid(step = 0.3) {
  const grid = [];
  const samples = FIRES.map((f) => {
    const r = (f.weather.windFrom * Math.PI) / 180;
    return { lat: f.lat, lon: f.lon, u: Math.sin(r) * f.weather.windKmh, v: Math.cos(r) * f.weather.windKmh };
  });
  for (let lat = 40.6; lat <= 42.75; lat += step) {
    for (let lon = 0.2; lon <= 3.3; lon += step) {
      const p = { lat, lon };
      const u = idw(p, samples, (s) => s.u);
      const v = idw(p, samples, (s) => s.v);
      const windFrom = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
      grid.push({ lat, lon, windFrom, windKmh: Math.hypot(u, v) });
    }
  }
  return grid;
}
