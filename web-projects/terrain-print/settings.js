// Every choice that shapes a model, its default, its limits, and its short
// name in the link. The link holds the whole design (root ADR 0006), so a
// shared link rebuilds the same model; the printer is personal and stays in
// this browser instead.
//
// Values read from a link are text a stranger wrote: each one is checked
// against its list or its range, and a bad one falls back to the default.

import { BODIES, BODY_IDS } from "./bodies.js";
import { SHAPE_IDS } from "./outline.js";

/** Grid spacing of the model surface. 0.3 mm suits a 0.4 mm nozzle. */
export const DETAILS = {
  draft: { name: "Draft", spacing: 0.6 },
  standard: { name: "Standard", spacing: 0.4 },
  fine: { name: "Fine", spacing: 0.3 },
  ultra: { name: "Ultra (0.2 mm nozzle)", spacing: 0.2 },
};

/** Total gap between two puzzle pieces, mm. */
export const GAPS = {
  tight: { name: "Tight", mm: 0.15 },
  standard: { name: "Standard", mm: 0.25 },
  loose: { name: "Loose", mm: 0.4 },
};

/** Gap on each side between the tile and its frame, mm. */
export const FRAME_FITS = {
  tight: { name: "Snug fit", mm: 0.15 },
  standard: { name: "Standard fit", mm: 0.3 },
  loose: { name: "Loose fit", mm: 0.5 },
};

export const PRINTERS = [
  { id: "bambu-a1-mini", name: "Bambu Lab A1 mini", width: 180, height: 180 },
  { id: "bambu-256", name: "Bambu Lab A1, P1S, P2S, X1C", width: 256, height: 256 },
  { id: "bambu-h2s", name: "Bambu Lab H2S", width: 340, height: 320 },
  { id: "bambu-h2d", name: "Bambu Lab H2D", width: 350, height: 320 },
  { id: "prusa-mini", name: "Prusa MINI+", width: 180, height: 180 },
  { id: "prusa-mk4", name: "Prusa MK4S, MK3S+", width: 250, height: 210 },
  { id: "prusa-core-one", name: "Prusa CORE One", width: 250, height: 220 },
  { id: "prusa-xl", name: "Prusa XL", width: 360, height: 360 },
  { id: "creality-220", name: "Creality Ender-3 V3, K1, K1C", width: 220, height: 220 },
  { id: "creality-k1-max", name: "Creality K1 Max", width: 300, height: 300 },
  { id: "creality-k2-plus", name: "Creality K2 Plus", width: 350, height: 350 },
  { id: "elegoo-neptune-4-pro", name: "Elegoo Neptune 4 Pro", width: 225, height: 225 },
  { id: "anycubic-kobra-3", name: "Anycubic Kobra 3", width: 250, height: 250 },
  { id: "voron-350", name: "Voron 2.4 (350)", width: 350, height: 350 },
];

export const DEFAULT_PRINTER = "bambu-256";

export const FILAMENTS = [
  { id: "white", name: "White", hex: "#f1f0ea" },
  { id: "moon-grey", name: "Moon grey", hex: "#b9b8b1" },
  { id: "grey", name: "Grey", hex: "#808285" },
  { id: "charcoal", name: "Charcoal", hex: "#2e3034" },
  { id: "black", name: "Black", hex: "#141414" },
  { id: "mars-red", name: "Mars red", hex: "#b2532c" },
  { id: "terracotta", name: "Terracotta", hex: "#c86d43" },
  { id: "sand", name: "Sand", hex: "#d8c08e" },
  { id: "gold", name: "Gold", hex: "#c9a43a" },
  { id: "brown", name: "Brown", hex: "#6c4a2c" },
  { id: "forest-green", name: "Forest green", hex: "#3f7b3b" },
  { id: "olive", name: "Olive", hex: "#7c8a3c" },
  { id: "ocean-blue", name: "Ocean blue", hex: "#2b62a6" },
  { id: "sky-blue", name: "Sky blue", hex: "#72b3e0" },
  { id: "navy", name: "Navy", hex: "#1e2f55" },
];
const FILAMENT_IDS = FILAMENTS.map((f) => f.id);

export function filamentHex(id) {
  return (FILAMENTS.find((f) => f.id === id) ?? FILAMENTS[1]).hex;
}

/** Where each world opens: a place that shows what the tool does. */
const START = {
  moon: { lat: -43.31, lon: -11.36, km: 160 }, // Tycho
  mars: { lat: 18.65, lon: -133.8, km: 900 }, // Olympus Mons
  earth: { lat: 28.27, lon: -16.64, km: 95 }, // Tenerife: the sea shows
};

const enumOf = (values) => ({ type: "enum", values });
const num = (min, max, digits) => ({ type: "num", min, max, digits });

// field -> how it is checked and its key in the link
export const FIELDS = {
  lat: { key: "lat", ...num(-90, 90, 5) },
  lon: { key: "lon", ...num(-180, 180, 5) },
  km: { key: "km", ...num(0.2, 12000, 3) },
  shape: { key: "shape", ...enumOf(SHAPE_IDS) },
  rotation: { key: "rot", ...num(0, 359, 0) },
  sizeMm: { key: "mm", ...num(40, 1200, 0) },
  heightMode: { key: "hm", ...enumOf(["relief", "exaggeration"]) },
  reliefMm: { key: "relief", ...num(0.5, 80, 1) },
  exaggeration: { key: "ex", ...num(0.1, 200, 2) },
  baseMm: { key: "base", ...num(0.8, 20, 1) },
  detail: { key: "q", ...enumOf(Object.keys(DETAILS)) },
  curvature: { key: "curve", type: "bool" },
  seaOn: { key: "sea", type: "bool" },
  seaLevel: { key: "sl", ...num(-11000, 9000, 0) },
  flood: { key: "flood", ...enumOf(["all", "connected"]) },
  coastStepMm: { key: "step", ...num(0, 3, 1) },
  frame: { key: "frame", ...enumOf(["none", "tray"]) },
  frameFit: { key: "fit", ...enumOf(Object.keys(FRAME_FITS)) },
  floorMm: { key: "floor", ...num(0.8, 10, 1) },
  borderMm: { key: "border", ...num(2, 30, 1) },
  rimMode: { key: "rim", ...enumOf(["lowest", "highest", "custom"]) },
  rimMm: { key: "rimmm", ...num(0, 80, 1) },
  split: { key: "split", ...enumOf(["single", "bed", "puzzle"]) },
  pieces: { key: "pieces", ...num(2, 400, 0) },
  joint: { key: "joint", ...enumOf(["knob", "straight"]) },
  gap: { key: "gap", ...enumOf(Object.keys(GAPS)) },
  seed: { key: "seed", ...num(1, 999999, 0) },
  terrainColour: { key: "c", ...enumOf(FILAMENT_IDS) },
  frameColour: { key: "cf", ...enumOf(FILAMENT_IDS) },
  seaColour: { key: "cs", ...enumOf(FILAMENT_IDS) },
  snowOn: { key: "snow", type: "bool" },
  snowLine: { key: "snowm", ...num(-11000, 11000, 0) },
  snowColour: { key: "cw", ...enumOf(FILAMENT_IDS) },
};

/** The full default design for one world. */
export function defaultSettings(bodyId = "moon") {
  const body = BODIES[bodyId] ?? BODIES.moon;
  const start = START[body.id];
  return {
    body: body.id,
    ...start,
    shape: "circle",
    rotation: 0,
    sizeMm: 150,
    heightMode: "relief",
    reliefMm: body.id === "earth" ? 12 : 10,
    exaggeration: 1,
    baseMm: 3,
    detail: "fine",
    curvature: false,
    seaOn: body.sea ? body.sea.defaultOn : false,
    seaLevel: body.sea ? body.sea.level : 0,
    flood: body.sea ? body.sea.flood : "all",
    coastStepMm: 0.4,
    frame: "none",
    frameFit: "standard",
    floorMm: 2,
    borderMm: 6,
    rimMode: "lowest",
    rimMm: 4,
    split: "single",
    pieces: 24,
    joint: "knob",
    gap: "standard",
    seed: 1,
    terrainColour: body.colours.terrain,
    frameColour: body.colours.frame,
    seaColour: body.colours.sea ?? "ocean-blue",
    snowOn: false,
    snowLine: 3000,
    snowColour: "white",
  };
}

function parseField(spec, text) {
  if (text == null) return undefined;
  if (spec.type === "enum") return spec.values.includes(text) ? text : undefined;
  if (spec.type === "bool") return text === "1" ? true : text === "0" ? false : undefined;
  if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
  const v = Number(text);
  if (!Number.isFinite(v) || v < spec.min || v > spec.max) return undefined;
  return spec.digits === 0 ? Math.round(v) : v;
}

/** Read a design from a link's query string. */
export function readSettings(search) {
  const params = new URLSearchParams(search);
  const bodyId = BODY_IDS.includes(params.get("b")) ? params.get("b") : "moon";
  const s = defaultSettings(bodyId);
  for (const [field, spec] of Object.entries(FIELDS)) {
    const v = parseField(spec, params.get(spec.key));
    if (v !== undefined) s[field] = v;
  }
  return s;
}

function formatField(spec, v) {
  if (spec.type === "bool") return v ? "1" : "0";
  if (spec.type === "num") return String(Number(v.toFixed(spec.digits)));
  return String(v);
}

/** The query string for a design: the world, the place, and every changed choice. */
export function writeSearch(s) {
  const defaults = defaultSettings(s.body);
  const params = new URLSearchParams();
  params.set("b", s.body);
  for (const [field, spec] of Object.entries(FIELDS)) {
    const always = field === "lat" || field === "lon" || field === "km";
    const text = formatField(spec, s[field]);
    if (always || text !== formatField(spec, defaults[field])) params.set(spec.key, text);
  }
  return `?${params.toString()}`;
}

/** Clamp one numeric field into its range (for sliders and typed numbers). */
export function clampField(field, value) {
  const spec = FIELDS[field];
  if (!spec || spec.type !== "num") return value;
  const v = Math.min(spec.max, Math.max(spec.min, Number(value)));
  return spec.digits === 0 ? Math.round(v) : v;
}
