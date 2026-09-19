// The art styles a map can be drawn in, and what each visual tag looks like
// in the styles that draw from code.
//
// The vocabulary names a visual tag (ADR 0003), and that tag is what every
// style reads. The sprite style draws the tag's tile from the Urizen sheet
// (`tileset.js`). The three code styles draw from this table: an emoji, a
// one-character roguelike glyph, and a colour that the glyph and the flat
// block styles share. Switching style redraws the same grid; nothing about
// the world changes.
//
// `tileStyles.test.js` fails when a tag exists in the sheet manifest and not
// here, or the other way round, so the two lists cannot drift apart.

/** Every style, in the order the picker lists them. Ids are stored, so they never change. */
export const VISUAL_STYLES = [
  { id: "urizen", label: "Pixel tiles (Urizen 1-bit)", description: "Hand-drawn 12-pixel tiles, one style for every setting." },
  { id: "emoji", label: "Emoji", description: "One emoji per element type, drawn with your system's emoji font." },
  { id: "roguelike", label: "Roguelike letters", description: "Classic terminal roguelike: a coloured letter per type on black." },
  { id: "blocks", label: "Flat colour blocks", description: "One flat colour per type. Best for reading the structure of a map." },
];

export const DEFAULT_STYLE_ID = "urizen";

export function readStyleId(value) {
  return VISUAL_STYLES.some((one) => one.id === value) ? value : DEFAULT_STYLE_ID;
}

const row = (emoji, glyph, colour) => ({ emoji, glyph, colour });

/** Visual tag -> how the code styles draw it. */
export const STYLE_GLYPHS = {
  // Ground and terrain
  floor: row("⬛", ".", "#3a3a40"),
  "stone-floor": row("🪨", ".", "#6b6b70"),
  "cave-floor": row("🕳️", ".", "#2e2a26"),
  "metal-floor": row("🔲", ".", "#7a8590"),
  grate: row("🧱", "≡", "#8a9099"),
  circuit: row("🔌", ":", "#2aa198"),
  grass: row("🟩", '"', "#3f9b3f"),
  meadow: row("🌿", '"', "#5cb85c"),
  field: row("🌾", '"', "#c9a227"),
  dirt: row("🟫", ".", "#7a5230"),
  path: row("👣", ".", "#9c7a4e"),
  sand: row("🏖️", ".", "#d8c27a"),
  gravel: row("⚪", ",", "#8c8c8c"),
  rubble: row("🧱", ";", "#8b6b5a"),
  water: row("🌊", "~", "#2f6fd6"),
  "deep-water": row("🌊", "≈", "#1b3f8f"),
  "shallow-water": row("💧", "~", "#5aa8e8"),
  swamp: row("🐸", "~", "#4f7a3a"),
  ice: row("🧊", "-", "#a8d8f0"),
  snow: row("❄️", ".", "#e8f0f8"),
  lava: row("🌋", "~", "#e0521a"),
  fire: row("🔥", "^", "#f0862a"),
  road: row("🛣️", "=", "#4a4a4f"),
  pavement: row("⬜", ".", "#9a9a9f"),
  bones: row("🦴", "%", "#d8d0b8"),
  blood: row("🩸", "%", "#a01818"),

  // Plants and nature
  tree: row("🌳", "T", "#2e7d32"),
  pine: row("🌲", "T", "#1f5e2a"),
  bush: row("🌳", "*", "#4c9a3c"),
  "dead-tree": row("🪾", "T", "#6e5a48"),
  cactus: row("🌵", "Y", "#5c9c4a"),
  flower: row("🌸", "*", "#e07aa8"),
  plant: row("🌱", '"', "#6ab04c"),
  mushroom: row("🍄", ",", "#c04a4a"),
  mountain: row("⛰️", "^", "#7a7a80"),
  volcano: row("🌋", "^", "#b03a20"),
  rock: row("🪨", "o", "#8a8a8a"),
  crystal: row("💎", "*", "#5ad8e8"),

  // Walls and structure
  wall: row("🧱", "#", "#8a7a66"),
  "stone-wall": row("🪨", "#", "#8c8c94"),
  "brick-wall": row("🧱", "#", "#b04a3a"),
  "wood-wall": row("🪵", "#", "#8a5a2a"),
  "dark-wall": row("⬛", "#", "#4a4a52"),
  "metal-wall": row("🔩", "#", "#9aa0aa"),
  "tech-wall": row("🖥️", "#", "#5a6a8a"),
  vent: row("🌬️", "#", "#7a8a9a"),
  door: row("🚪", "+", "#d08a3a"),
  "wood-door": row("🚪", "+", "#b8742a"),
  "metal-door": row("🚪", "+", "#aab4c0"),
  hatch: row("🔘", "+", "#3ad0e0"),
  arch: row("⛩️", "∩", "#c08a5a"),
  gate: row("🚧", "|", "#a0a0a8"),
  fence: row("🪵", "|", "#a07a4a"),
  window: row("🪟", "'", "#8ac0e8"),
  pillar: row("🏛️", "I", "#d8d8d0"),
  tower: row("🗼", "I", "#c8c0b0"),
  windmill: row("🌬️", "X", "#c0a070"),
  stairs: row("🪜", ">", "#d0d0c8"),
  bridge: row("🌉", "=", "#a07a4a"),
  pipe: row("🔧", "-", "#c08050"),
  trap: row("⚠️", "^", "#e0a020"),

  // Buildings, map scale
  house: row("🏠", "H", "#d05040"),
  hut: row("🛖", "h", "#c07a3a"),
  tent: row("⛺", "A", "#c8a060"),
  temple: row("🛕", "T", "#e0b040"),
  castle: row("🏰", "C", "#d0c040"),
  building: row("🏢", "B", "#9a9aa8"),
  skyscraper: row("🏙️", "B", "#7a8aa8"),
  shop: row("🏪", "S", "#e07050"),
  factory: row("🏭", "F", "#a08a7a"),
  church: row("⛪", "+", "#d0b060"),
  hospital: row("🏥", "H", "#e05050"),
  station: row("⛽", "G", "#d06040"),
  antenna: row("📡", "Y", "#a0a0a0"),
  "solar-panel": row("🔆", "=", "#40c0e0"),
  ruin: row("🏚️", "%", "#a06050"),

  // Objects and furniture
  chest: row("📦", "$", "#c09040"),
  crate: row("📦", "▪", "#a07a4a"),
  barrel: row("🛢️", "o", "#8a5a2a"),
  table: row("🪑", "π", "#8a5a2a"),
  chair: row("🪑", "h", "#8a5a2a"),
  bed: row("🛏️", "=", "#d05070"),
  bookshelf: row("📚", "≡", "#8a5a2a"),
  altar: row("🕯️", "_", "#c0c0c0"),
  grave: row("🪦", "†", "#a0a0a8"),
  statue: row("🗿", "&", "#d0d0c8"),
  lamp: row("🪔", "!", "#f0d040"),
  torch: row("🔥", "!", "#f09030"),
  sign: row("🪧", "?", "#c09050"),
  campfire: row("🔥", "^", "#f08030"),
  magic: row("✨", "*", "#c060f0"),
  machine: row("⚙️", "&", "#9aa0a8"),
  computer: row("🖥️", "&", "#60b0e0"),
  terminal: row("💻", ">", "#40e070"),
  server: row("🗄️", "#", "#40c060"),
  gear: row("⚙️", "*", "#e0a050"),
  key: row("🗝️", "-", "#e0b040"),
  gold: row("🪙", "$", "#f0c020"),
  gem: row("💎", "*", "#40e0e0"),
  potion: row("🧪", "!", "#c040e0"),
  weapon: row("🗡️", ")", "#c0c0c8"),
  armor: row("🛡️", "[", "#a0a0a8"),
  book: row("📖", "?", "#d8c8a0"),
  scroll: row("📜", "?", "#e0d0a0"),
  food: row("🍖", "%", "#e08040"),
  banner: row("🚩", "|", "#d03030"),
  shield: row("🛡️", "]", "#d04040"),
  skull: row("💀", "%", "#e0e0d8"),
  cloud: row("☁️", "~", "#c0c0c8"),
  moon: row("🌙", "(", "#f0e0b0"),
  lightning: row("⚡", "/", "#f0e040"),

  // Vehicles
  car: row("🚗", "c", "#e0e0e8"),
  truck: row("🚚", "c", "#d09040"),
  bus: row("🚌", "c", "#4060d0"),
  train: row("🚆", "c", "#9040c0"),
  tank: row("🪖", "t", "#6a7a4a"),
  plane: row("✈️", "^", "#a0c0e0"),
  helicopter: row("🚁", "*", "#8aa08a"),
  boat: row("⛵", "v", "#c0a070"),
  spaceship: row("🚀", "^", "#e0e0f0"),
  ufo: row("🛸", "o", "#80e0c0"),

  // Beings
  person: row("🧍", "@", "#f0f0f0"),
  villager: row("🧑‍🌾", "@", "#e0c090"),
  guard: row("💂", "@", "#c0c0d0"),
  merchant: row("🧑‍💼", "@", "#e0b060"),
  wizard: row("🧙", "@", "#a060e0"),
  worker: row("👷", "@", "#c08040"),
  scientist: row("🧑‍🔬", "@", "#60d0e0"),
  soldier: row("🪖", "@", "#d04040"),
  crew: row("🧑‍🚀", "@", "#6090e0"),
  astronaut: row("🧑‍🚀", "@", "#a0e0f0"),
  robot: row("🤖", "R", "#8aa0b0"),
  alien: row("👽", "A", "#60e060"),
  monster: row("👾", "M", "#a0d040"),
  demon: row("😈", "D", "#e03030"),
  ghost: row("👻", "G", "#f0f0ff"),
  zombie: row("🧟", "Z", "#70b090"),
  skeleton: row("💀", "Z", "#d8d8d0"),
  animal: row("🐾", "a", "#c08050"),
  bird: row("🐦", "b", "#e0c060"),
  fish: row("🐟", "f", "#60b0e0"),
  insect: row("🐞", "i", "#c0a040"),
  cat: row("🐈", "c", "#c0c0c0"),

  // The fallback
  unknown: row("❓", "?", "#f040f0"),
};

/** The row for a tag, or the fallback row. */
export function glyphFor(tag) {
  return Object.hasOwn(STYLE_GLYPHS, tag) ? STYLE_GLYPHS[tag] : STYLE_GLYPHS.unknown;
}
