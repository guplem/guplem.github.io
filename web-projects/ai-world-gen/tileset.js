// The tileset manifest: which tile draws which visual tag.
//
// The pictures come from the Urizen 1-bit tileset by vurmux (CC0), one sheet
// for fantasy, modern, sci-fi and horror alike. That is why it was chosen over
// prettier packs: the vocabulary is different for every setting, and one pack
// in one style cannot mismatch itself (ADR 0003).
//
// The vocabulary never names a tile. It names a **visual tag** from the list
// below, and this file maps the tag to one or more sheet positions. That
// indirection is what lets the vocabulary be generated fresh for every world:
// a "cryo pod" and a "sarcophagus" can both say `bed`, and the drawing code
// needs to know neither word.
//
// Sheet geometry, as the artist documents it: 12 by 12 tiles, a 1 pixel margin,
// 1 pixel between tiles, so a tile sits at `1 + index * 13`.

export const TILESET_FILE = "tileset.png";
export const TILE_SIZE = 12;
export const TILE_PITCH = 13;
export const TILE_OFFSET = 1;
export const SHEET_COLUMNS = 206;
export const SHEET_ROWS = 50;

/** The tag a cell falls back to when its type names a tag this file does not know. */
export const UNKNOWN_TAG = "unknown";

/**
 * Visual tag -> `[column, row]` variants on the sheet. When a tag has several,
 * the cell's coordinate hash picks one, so a field does not repeat one drawing.
 *
 * Grouped so a reader can find things; the order carries no meaning.
 */
export const VISUAL_TAGS = {
  // Ground and terrain
  floor: [[0, 5], [1, 5], [2, 5]],
  "stone-floor": [[52, 2], [53, 2]],
  "cave-floor": [[0, 7], [1, 7], [2, 7]],
  "metal-floor": [[52, 0], [53, 0], [54, 0]],
  grate: [[55, 0], [63, 0]],
  circuit: [[57, 1], [58, 1]],
  grass: [[14, 5], [15, 5], [19, 6]],
  meadow: [[11, 34], [12, 34], [13, 34], [14, 34]],
  field: [[5, 34], [6, 34], [7, 34]],
  dirt: [[2, 6], [3, 6], [6, 6], [7, 6]],
  path: [[5, 5], [9, 5]],
  sand: [[18, 6], [0, 13], [1, 13]],
  gravel: [[10, 5], [11, 5], [12, 5]],
  rubble: [[5, 3], [10, 5]],
  water: [[9, 41], [4, 41], [9, 41], [5, 41]],
  "deep-water": [[15, 6], [16, 6]],
  "shallow-water": [[17, 5], [18, 5]],
  swamp: [[4, 34]],
  ice: [[9, 34]],
  snow: [[8, 34]],
  lava: [[84, 39]],
  fire: [[84, 39]],
  road: [[53, 3], [52, 3]],
  pavement: [[52, 2], [53, 2]],
  bones: [[19, 34], [5, 38], [9, 38]],
  blood: [[0, 25], [1, 25]],

  // Plants and nature
  tree: [[0, 8], [1, 8], [2, 8], [4, 8]],
  pine: [[2, 34], [3, 34]],
  bush: [[0, 34], [1, 34]],
  "dead-tree": [[4, 10], [5, 10]],
  cactus: [[0, 9]],
  flower: [[11, 9], [12, 9], [13, 9]],
  plant: [[1, 9], [4, 9], [6, 9]],
  mushroom: [[0, 10], [1, 10], [2, 10]],
  mountain: [[15, 34]],
  volcano: [[16, 34]],
  rock: [[80, 20], [81, 20], [82, 20]],
  crystal: [[0, 22], [1, 22], [2, 22]],

  // Walls and structure
  wall: [[11, 0], [13, 0], [14, 0]],
  "stone-wall": [[0, 2], [1, 2], [2, 2], [3, 2]],
  "brick-wall": [[0, 3], [1, 3], [2, 3]],
  "wood-wall": [[0, 4], [1, 4], [2, 4]],
  "dark-wall": [[22, 2], [23, 2], [24, 2]],
  "metal-wall": [[66, 0], [69, 0], [72, 0]],
  "tech-wall": [[53, 1], [54, 1], [55, 1]],
  vent: [[52, 1]],
  door: [[3, 1], [4, 1]],
  "wood-door": [[10, 1], [11, 1], [12, 1]],
  "metal-door": [[65, 0], [67, 0]],
  hatch: [[64, 0]],
  arch: [[0, 1], [1, 1]],
  gate: [[26, 21], [27, 21]],
  fence: [[8, 40], [9, 40], [7, 40]],
  window: [[13, 4], [14, 4], [15, 4]],
  pillar: [[47, 1]],
  tower: [[49, 1], [50, 1], [48, 1]],
  windmill: [[46, 1]],
  stairs: [[0, 39], [1, 39], [2, 39]],
  bridge: [[2, 4]],
  pipe: [[52, 26], [53, 26]],
  trap: [[4, 39]],

  // Buildings, map scale
  house: [[0, 33], [1, 33], [2, 33], [3, 33]],
  hut: [[16, 33], [17, 33], [18, 33]],
  tent: [[23, 33], [24, 33]],
  temple: [[33, 2], [34, 2]],
  castle: [[32, 2]],
  building: [[52, 8], [53, 8], [54, 8]],
  skyscraper: [[60, 8], [61, 8], [62, 8]],
  shop: [[67, 8], [68, 8], [69, 8]],
  factory: [[52, 6], [54, 6]],
  church: [[62, 6], [63, 6]],
  hospital: [[59, 6], [60, 6]],
  station: [[58, 6]],
  antenna: [[57, 6]],
  "solar-panel": [[67, 6], [68, 6]],
  ruin: [[6, 3], [7, 3]],

  // Objects and furniture
  chest: [[26, 19], [27, 19], [28, 19]],
  crate: [[9, 36], [10, 36]],
  barrel: [[11, 36], [12, 36]],
  table: [[0, 35], [1, 35], [15, 35]],
  chair: [[15, 36], [16, 36]],
  bed: [[21, 36], [22, 36]],
  bookshelf: [[0, 40], [1, 40], [2, 40]],
  altar: [[7, 39]],
  grave: [[6, 39], [8, 39]],
  statue: [[47, 1]],
  lamp: [[75, 3], [76, 3]],
  torch: [[75, 4], [76, 4]],
  sign: [[26, 20], [27, 20], [28, 20]],
  campfire: [[84, 39]],
  magic: [[29, 43], [30, 43], [29, 44], [30, 44]],
  machine: [[52, 13], [53, 13], [54, 13]],
  computer: [[69, 21], [70, 21], [71, 21]],
  terminal: [[64, 22], [65, 22], [66, 22]],
  server: [[68, 21], [56, 21]],
  gear: [[52, 38], [53, 38]],
  key: [[0, 45], [1, 45]],
  gold: [[0, 46], [1, 46], [2, 46]],
  gem: [[3, 22], [4, 22]],
  potion: [[26, 4], [28, 4], [30, 4]],
  weapon: [[26, 6], [27, 6]],
  armor: [[26, 11], [27, 11]],
  book: [[0, 37], [1, 37]],
  scroll: [[35, 14]],
  food: [[5, 17], [6, 17], [7, 17]],
  banner: [[26, 46], [27, 46]],
  shield: [[26, 45]],
  skull: [[3, 10]],
  cloud: [[80, 20]],
  moon: [[86, 39]],
  lightning: [[80, 39]],

  // Vehicles
  car: [[52, 7], [58, 7], [72, 7]],
  truck: [[54, 7], [65, 7]],
  bus: [[57, 7], [64, 7]],
  train: [[61, 7], [62, 7]],
  tank: [[68, 7]],
  plane: [[70, 7], [71, 7]],
  helicopter: [[69, 7]],
  boat: [[15, 40], [17, 40], [18, 40]],
  spaceship: [[100, 4], [102, 4]],
  ufo: [[84, 4]],

  // Beings
  person: [[104, 0], [106, 0], [107, 0], [109, 0]],
  villager: [[104, 10], [106, 10], [107, 10]],
  guard: [[105, 0], [108, 0], [113, 0]],
  merchant: [[111, 0]],
  wizard: [[110, 10]],
  worker: [[104, 15], [106, 15]],
  scientist: [[104, 7], [106, 7]],
  soldier: [[105, 6], [108, 6]],
  crew: [[104, 12], [106, 12]],
  astronaut: [[80, 14], [81, 14], [88, 14]],
  robot: [[80, 13], [83, 13], [102, 13]],
  alien: [[80, 11], [81, 11]],
  monster: [[104, 42], [106, 42], [113, 42], [115, 40]],
  demon: [[115, 40], [120, 40]],
  ghost: [[111, 42]],
  zombie: [[105, 41]],
  skeleton: [[82, 12]],
  animal: [[3, 14], [4, 14], [0, 16], [2, 16]],
  bird: [[7, 16], [8, 16]],
  fish: [[12, 14]],
  insect: [[9, 15]],
  cat: [[1, 14]],

  // The fallback
  unknown: [[102, 49]],
};

/** Every tag, alphabetical, for the prompt and the inspector. */
export function visualTagNames() {
  return Object.keys(VISUAL_TAGS).sort();
}

export function isVisualTag(tag) {
  return typeof tag === "string" && Object.hasOwn(VISUAL_TAGS, tag);
}

/**
 * Where on the sheet a tag's tile is, in pixels.
 * @param {string} tag a visual tag, or anything (unknown tags draw the fallback)
 * @param {number} seed a stable number for the cell, which picks the variant
 * @returns {{sx: number, sy: number}}
 */
export function tileFor(tag, seed) {
  const variants = VISUAL_TAGS[isVisualTag(tag) ? tag : UNKNOWN_TAG];
  const [column, row] = variants[Math.abs(seed >>> 0) % variants.length];
  return { sx: TILE_OFFSET + column * TILE_PITCH, sy: TILE_OFFSET + row * TILE_PITCH };
}
