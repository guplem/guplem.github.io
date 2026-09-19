// What the setup screen offers: suggested settings, grid sizes, and the shape
// of a setting.
//
// A setting is three free-text fields: where, when, and the tone or any notes.
// The presets are chips that fill those fields, so a person at a demo can have
// a world in two clicks and still edit every word.

/** @typedef {{location: string, era: string, notes: string}} Setting */

export const SETTING_PRESETS = [
  {
    id: "medieval-village",
    label: "Medieval village",
    location: "A small farming village at the edge of a dark forest, with a river to the east",
    era: "Around the year 1200",
    notes: "Cosy and grounded. A market square, a chapel, fields, a tavern, and something odd in the woods.",
  },
  {
    id: "space-station",
    label: "Space station",
    location: "A research station in orbit around a gas giant",
    era: "The year 2312",
    notes: "Clean sci-fi. Corridors, labs, crew quarters, a hangar, an airlock, and one sealed section nobody talks about.",
  },
  {
    id: "haunted-mansion",
    label: "Haunted mansion",
    location: "An abandoned Victorian mansion on a foggy hill",
    era: "1888",
    notes: "Gothic horror. Dusty rooms, a library, a ballroom, a cellar, portraits that watch, and things that should not move.",
  },
  {
    id: "desert-outpost",
    label: "Desert outpost",
    location: "A trading outpost at a desert oasis on a caravan route",
    era: "The 14th century",
    notes: "Hot, dusty, busy. Tents, wells, market stalls, camels, guards, and dunes all around.",
  },
  {
    id: "cyberpunk-block",
    label: "Cyberpunk city block",
    location: "One city block in a rain-soaked megacity, ground level and rooftops",
    era: "2087",
    notes: "Neon and grime. Noodle bars, hackers, corporate security, alleys, and a hidden clinic.",
  },
  {
    id: "jungle-temple",
    label: "Jungle temple",
    location: "A ruined temple complex swallowed by the jungle",
    era: "Present day, expedition",
    notes: "Adventure. Overgrown stone, traps, a river, wildlife, an explorer's camp, and a chamber that was never opened.",
  },
  {
    id: "arctic-base",
    label: "Arctic research base",
    location: "A remote research base on the Antarctic ice",
    era: "1982",
    notes: "Isolation and cold. Prefab modules, a radio room, a generator, snowmobiles, and something found in the ice.",
  },
  {
    id: "ghana-market",
    label: "Ghanaian market town",
    location: "A busy market town in the Ashanti region of Ghana",
    era: "Present day",
    notes: "Warm and lively. Kente cloth stalls, a lorry park, a chop bar, a church, palm trees, and football on the red dirt.",
  },
];

/** A setting with every field present and trimmed. Anything else becomes an empty string. */
export function cleanSetting(value) {
  const field = (name) => (value && value[name] != null ? String(value[name]).trim() : "");
  return { location: field("location"), era: field("era"), notes: field("notes") };
}

/** Whether there is enough to generate from. A location is the one thing that cannot be blank. */
export function isSettingComplete(setting) {
  return cleanSetting(setting).location !== "";
}

/** The setting as one paragraph for a prompt. Empty fields are left out. */
export function describeSetting(setting) {
  const clean = cleanSetting(setting);
  const parts = [];
  if (clean.location) parts.push(`Location: ${clean.location}.`);
  if (clean.era) parts.push(`Time: ${clean.era}.`);
  if (clean.notes) parts.push(`Tone and notes: ${clean.notes}.`);
  return parts.join(" ");
}

export const GRID_LIMITS = { min: 4, max: 40 };

export const GRID_SIZES = [
  { id: "8x8", width: 8, height: 8, label: "8 × 8 (64 cells, quick)" },
  { id: "12x12", width: 12, height: 12, label: "12 × 12 (144 cells)" },
  { id: "16x16", width: 16, height: 16, label: "16 × 16 (256 cells)" },
  { id: "24x16", width: 24, height: 16, label: "24 × 16 (384 cells, wide)" },
  { id: "24x24", width: 24, height: 24, label: "24 × 24 (576 cells, slow)" },
];

export const DEFAULT_GRID_SIZE_ID = "12x12";

/**
 * A width and height from a size id or a `WxH` text. Anything unreadable or
 * outside the limits gives the default.
 */
export function readGridSize(value) {
  const fallback = GRID_SIZES.find((one) => one.id === DEFAULT_GRID_SIZE_ID);
  const match = typeof value === "string" ? value.trim().match(/^(\d{1,3})\s*[x×]\s*(\d{1,3})$/i) : null;
  if (!match) return { width: fallback.width, height: fallback.height };
  const width = Number(match[1]);
  const height = Number(match[2]);
  const inside = (n) => n >= GRID_LIMITS.min && n <= GRID_LIMITS.max;
  if (!inside(width) || !inside(height)) return { width: fallback.width, height: fallback.height };
  return { width, height };
}
