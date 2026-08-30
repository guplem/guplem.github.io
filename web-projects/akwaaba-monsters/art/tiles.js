// What every map tile looks like.
//
// One entry per tile identifier in `world.js`. Each is 16 by 16 and has to sit
// next to a copy of itself with no seam, so tiles carry no outline and no
// shading: both would draw a line down the middle of a field of grass.
//
// Texture comes from `noise`, which takes a seed and therefore scatters the
// same speckles on every load. A tile that changed between reloads would make
// the ground crawl.

/** Every map tile is drawn on this grid. */
export const TILE_SIZE = 16;

const fill = (c) => ({ k: "rect", x: 0, y: 0, w: TILE_SIZE, h: TILE_SIZE, c });

/** A tile drawing: flat, seamless, no outline. */
const tile = (shapes) => ({ w: TILE_SIZE, h: TILE_SIZE, outline: null, shade: false, shapes });

/** Speckles across the whole tile. */
const speckle = (c, density, seed) => ({
  k: "noise",
  x: 0,
  y: 0,
  w: TILE_SIZE,
  h: TILE_SIZE,
  c,
  density,
  seed,
});

/** Every tile drawing, keyed by the identifier `world.js` uses. */
export const TILE_ART = {
  // --- Ground you walk on -------------------------------------------------
  path: () =>
    tile([fill("#c9a06a"), speckle("#b98d57", 0.14, 11), speckle("#d8b280", 0.08, 12)]),

  grass: () =>
    tile([fill("#5a9440"), speckle("#4c8035", 0.16, 21), speckle("#6da84c", 0.1, 22)]),

  tall: () =>
    tile([
      fill("#3f7a2e"),
      speckle("#356a26", 0.12, 31),
      // Blades, so tall grass is obvious at a glance. This is the tile that
      // starts battles, and the player has to be able to see it coming.
      { k: "line", pts: [[2, 15], [3, 7]], c: "#63b84a" },
      { k: "line", pts: [[6, 15], [6, 5]], c: "#74c95a" },
      { k: "line", pts: [[10, 15], [11, 6]], c: "#63b84a" },
      { k: "line", pts: [[14, 15], [13, 8]], c: "#74c95a" },
      { k: "px", pts: [[3, 6], [6, 4], [11, 5], [13, 7]], c: "#8ada6c" },
    ]),

  sand: () => tile([fill("#e0cb92"), speckle("#d1b878", 0.12, 41), speckle("#efe0b4", 0.08, 42)]),

  mud: () => tile([fill("#7d6244"), speckle("#6a523a", 0.18, 51), speckle("#8f7350", 0.09, 52)]),

  flowers: () =>
    tile([
      fill("#5a9440"),
      speckle("#4c8035", 0.12, 61),
      { k: "px", pts: [[3, 4], [4, 3], [4, 5], [5, 4]], c: "#e0622b" },
      { k: "px", pts: [[11, 10], [12, 9], [12, 11], [13, 10]], c: "#e3c65a" },
      { k: "px", pts: [[8, 13], [7, 12]], c: "#d8607f" },
    ]),

  bridge: () =>
    tile([
      fill("#9c7442"),
      { k: "rect", x: 0, y: 0, w: 16, h: 1, c: "#7d5a30" },
      { k: "rect", x: 0, y: 7, w: 16, h: 1, c: "#7d5a30" },
      { k: "rect", x: 0, y: 15, w: 16, h: 1, c: "#7d5a30" },
      speckle("#8a6438", 0.1, 71),
    ]),

  ledge: () =>
    tile([
      fill("#c9a06a"),
      { k: "rect", x: 0, y: 0, w: 16, h: 6, c: "#8a6a42" },
      { k: "rect", x: 0, y: 6, w: 16, h: 2, c: "#6f5334" },
      speckle("#b98d57", 0.1, 81),
    ]),

  // --- Water --------------------------------------------------------------
  water: () =>
    tile([
      fill("#2f6fb0"),
      speckle("#2a639e", 0.15, 91),
      { k: "rect", x: 2, y: 4, w: 5, h: 1, c: "#79b7de" },
      { k: "rect", x: 9, y: 10, w: 5, h: 1, c: "#79b7de" },
      { k: "rect", x: 4, y: 12, w: 3, h: 1, c: "#5a9ccc" },
    ]),

  // --- Things in the way --------------------------------------------------
  rock: () =>
    tile([
      fill("#5a9440"),
      { k: "ellipse", cx: 8, cy: 9, rx: 7, ry: 6, c: "#8d8378" },
      { k: "ellipse", cx: 8, cy: 7, rx: 5, ry: 4, c: "#a49a8d" },
      { k: "px", pts: [[5, 11], [10, 12], [12, 8]], c: "#6f665c" },
    ]),

  tree: () =>
    tile([
      fill("#5a9440"),
      { k: "rect", x: 6, y: 10, w: 4, h: 6, c: "#7d5a30" },
      { k: "ellipse", cx: 8, cy: 7, rx: 8, ry: 7, c: "#356a26" },
      { k: "ellipse", cx: 6, cy: 5, rx: 4, ry: 3, c: "#4f9d3a" },
      { k: "px", pts: [[11, 9], [3, 8], [9, 2]], c: "#63b84a" },
    ]),

  palm: () =>
    tile([
      fill("#e0cb92"),
      { k: "rect", x: 7, y: 6, w: 3, h: 10, c: "#8a6438" },
      { k: "px", pts: [[7, 8], [7, 11], [7, 14]], c: "#6f5028" },
      // Fronds arching out from the top of the trunk.
      { k: "line", pts: [[8, 5], [1, 2]], c: "#3f7a2e", w: 2 },
      { k: "line", pts: [[8, 5], [15, 2]], c: "#3f7a2e", w: 2 },
      { k: "line", pts: [[8, 5], [2, 8]], c: "#4f9d3a", w: 2 },
      { k: "line", pts: [[8, 5], [14, 8]], c: "#4f9d3a", w: 2 },
      { k: "px", pts: [[6, 6], [10, 6]], c: "#c9a227" },
    ]),

  crop: () =>
    tile([
      fill("#7d6244"),
      { k: "line", pts: [[3, 15], [3, 4]], c: "#4f9d3a", w: 2 },
      { k: "line", pts: [[8, 15], [8, 2]], c: "#4f9d3a", w: 2 },
      { k: "line", pts: [[13, 15], [13, 5]], c: "#4f9d3a", w: 2 },
      { k: "px", pts: [[3, 3], [8, 1], [13, 4]], c: "#e3c65a" },
    ]),

  fence: () =>
    tile([
      fill("#5a9440"),
      { k: "rect", x: 0, y: 6, w: 16, h: 2, c: "#8a6438" },
      { k: "rect", x: 0, y: 11, w: 16, h: 2, c: "#8a6438" },
      { k: "rect", x: 6, y: 2, w: 3, h: 14, c: "#7d5a30" },
    ]),

  hut: () =>
    tile([
      fill("#c08a52"),
      speckle("#b07c46", 0.12, 101),
      { k: "rect", x: 0, y: 0, w: 16, h: 2, c: "#8a6438" },
      { k: "px", pts: [[3, 6], [11, 10]], c: "#9c6f3c" },
    ]),

  // A thatched roof. Every building puts this on its top row: without it a hut
  // is a flat brown rectangle and reads as a wall, not as somewhere to live.
  roof: () =>
    tile([
      fill("#b8893f"),
      speckle("#a67a33", 0.16, 151),
      { k: "line", pts: [[0, 5], [5, 0]], c: "#d1a352" },
      { k: "line", pts: [[0, 11], [11, 0]], c: "#d1a352" },
      { k: "line", pts: [[4, 15], [15, 4]], c: "#d1a352" },
      { k: "line", pts: [[10, 15], [15, 10]], c: "#d1a352" },
      { k: "line", pts: [[0, 8], [8, 0]], c: "#94682a" },
      { k: "line", pts: [[7, 15], [15, 7]], c: "#94682a" },
      { k: "rect", x: 0, y: 14, w: 16, h: 2, c: "#7d5620" },
    ]),

  wall: () =>
    tile([
      fill("#9c7a5a"),
      { k: "rect", x: 0, y: 0, w: 16, h: 3, c: "#7d5f44" },
      { k: "rect", x: 0, y: 7, w: 16, h: 1, c: "#8a6a4c" },
      { k: "rect", x: 7, y: 8, w: 1, h: 8, c: "#8a6a4c" },
      speckle("#a88a68", 0.08, 111),
    ]),

  // --- Inside a building --------------------------------------------------
  floor: () =>
    tile([
      fill("#c9b08a"),
      { k: "rect", x: 0, y: 0, w: 16, h: 1, c: "#b89c74" },
      { k: "rect", x: 0, y: 0, w: 1, h: 16, c: "#b89c74" },
      speckle("#d4bd9a", 0.06, 121),
    ]),

  mat: () =>
    tile([
      fill("#b8562f"),
      { k: "rect", x: 0, y: 3, w: 16, h: 1, c: "#e3c65a" },
      { k: "rect", x: 0, y: 8, w: 16, h: 1, c: "#1f5c4a" },
      { k: "rect", x: 0, y: 12, w: 16, h: 1, c: "#e3c65a" },
      { k: "px", pts: [[2, 6], [7, 6], [12, 6], [4, 14], [10, 14]], c: "#f0d68a" },
    ]),

  bed: () =>
    tile([
      fill("#c9b08a"),
      { k: "rect", x: 1, y: 1, w: 14, h: 14, c: "#3f7a8e" },
      { k: "rect", x: 2, y: 2, w: 12, h: 5, c: "#f0e6d2" },
      { k: "rect", x: 1, y: 9, w: 14, h: 1, c: "#2f5f70" },
    ]),

  table: () =>
    tile([
      fill("#c9b08a"),
      { k: "rect", x: 1, y: 3, w: 14, h: 9, c: "#8a6438" },
      { k: "rect", x: 1, y: 3, w: 14, h: 2, c: "#a37d4c" },
      { k: "px", pts: [[4, 8], [11, 9]], c: "#7d5a30" },
    ]),

  counter: () =>
    tile([
      fill("#c9b08a"),
      { k: "rect", x: 0, y: 2, w: 16, h: 12, c: "#7d5a30" },
      { k: "rect", x: 0, y: 2, w: 16, h: 3, c: "#a37d4c" },
      { k: "rect", x: 0, y: 12, w: 16, h: 2, c: "#5f4324" },
    ]),

  shelf: () =>
    tile([
      fill("#9c7a5a"),
      { k: "rect", x: 0, y: 2, w: 16, h: 5, c: "#7d5f44" },
      { k: "rect", x: 0, y: 10, w: 16, h: 5, c: "#7d5f44" },
      { k: "px", pts: [[3, 4], [7, 4], [11, 4]], c: "#e0622b" },
      { k: "px", pts: [[4, 12], [9, 12], [13, 12]], c: "#3f88c0" },
    ]),

  pot: () =>
    tile([
      fill("#c9b08a"),
      { k: "ellipse", cx: 8, cy: 10, rx: 6, ry: 5, c: "#a04a2c" },
      { k: "ellipse", cx: 8, cy: 5, rx: 4, ry: 2, c: "#8a3a20" },
      { k: "rect", x: 3, y: 9, w: 10, h: 1, c: "#c96b46" },
    ]),

  statue: () =>
    tile([
      fill("#c9b08a"),
      { k: "poly", pts: [[4, 15], [6, 3], [10, 3], [12, 15]], c: "#7a6a58" },
      { k: "ellipse", cx: 8, cy: 4, rx: 3, ry: 3, c: "#8d7c68" },
      { k: "px", pts: [[6, 4], [9, 4]], c: "#3a2c1e" },
      { k: "rect", x: 3, y: 14, w: 10, h: 2, c: "#6a5c4a" },
    ]),

  sign: () =>
    tile([
      fill("#5a9440"),
      { k: "rect", x: 7, y: 9, w: 2, h: 7, c: "#7d5a30" },
      { k: "rect", x: 2, y: 2, w: 12, h: 8, c: "#a37d4c" },
      { k: "rect", x: 3, y: 4, w: 8, h: 1, c: "#5f4324" },
      { k: "rect", x: 3, y: 6, w: 9, h: 1, c: "#5f4324" },
    ]),

  // --- Underground --------------------------------------------------------
  cave: () => tile([fill("#6a5f52"), speckle("#5c5246", 0.16, 131), speckle("#7a6e60", 0.08, 132)]),

  caveWall: () =>
    tile([
      fill("#413a32"),
      speckle("#36302a", 0.18, 141),
      { k: "rect", x: 0, y: 0, w: 16, h: 2, c: "#4d453c" },
      { k: "px", pts: [[4, 6], [10, 9], [7, 12]], c: "#2d2823" },
    ]),

  oreRock: () =>
    tile([
      fill("#413a32"),
      { k: "ellipse", cx: 8, cy: 9, rx: 7, ry: 6, c: "#5c5246" },
      // The gold the miners are after, showing through the rock.
      { k: "px", pts: [[5, 7], [6, 8], [10, 6], [11, 11], [8, 12]], c: "#c9a227" },
      { k: "px", pts: [[6, 7], [10, 7]], c: "#f2dd8c" },
    ]),

  gymFloor: () =>
    tile([
      fill("#8a6a4c"),
      { k: "rect", x: 0, y: 0, w: 16, h: 16, c: "#7a5c40" },
      // An Adinkra-style mark set into the floor of the gym.
      { k: "rect", x: 3, y: 7, w: 10, h: 2, c: "#c9a227" },
      { k: "rect", x: 7, y: 3, w: 2, h: 10, c: "#c9a227" },
      { k: "px", pts: [[3, 3], [12, 3], [3, 12], [12, 12]], c: "#c9a227" },
    ]),

  // --- Ways through -------------------------------------------------------
  door: () =>
    tile([
      fill("#c08a52"),
      { k: "rect", x: 2, y: 2, w: 12, h: 14, c: "#5f4324" },
      { k: "rect", x: 3, y: 3, w: 10, h: 13, c: "#7d5a30" },
      { k: "px", pts: [[11, 9], [11, 10]], c: "#e3c65a" },
    ]),

  stairs: () =>
    tile([
      fill("#9c7a5a"),
      { k: "rect", x: 0, y: 3, w: 16, h: 3, c: "#7d5f44" },
      { k: "rect", x: 0, y: 8, w: 16, h: 3, c: "#7d5f44" },
      { k: "rect", x: 0, y: 13, w: 16, h: 3, c: "#7d5f44" },
    ]),

  exit: () =>
    tile([
      fill("#c9a06a"),
      { k: "rect", x: 3, y: 3, w: 10, h: 10, c: "#b08a54" },
      { k: "px", pts: [[7, 5], [8, 5], [7, 10], [8, 10]], c: "#8a6a42" },
    ]),
};

/** Every tile this module can draw. */
export const TILE_ART_IDS = Object.keys(TILE_ART);

/**
 * The drawing for one tile.
 * @returns {object|null} null when the tile has no art yet
 */
export function tileDrawing(tileId) {
  const build = TILE_ART[tileId];
  return build ? build() : null;
}
