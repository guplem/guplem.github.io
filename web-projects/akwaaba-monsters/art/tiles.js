// What every map tile looks like.
//
// One entry per tile identifier in `world.js`. Each is 16 by 16, and each is one
// of two kinds. `world.js` decides which, and this file has to match it:
//
//   ground   the surface itself: grass, sand, a cave floor, a mud wall. Its art
//            fills the whole square, and it has to sit next to a copy of itself
//            with no seam. That is why ground carries no outline and no shading:
//            both draw a line down the middle of a field of grass.
//
//   a thing  a palm tree, a rock, a sign, a patch of tall grass. Its art has
//            holes in it and the ground shows through, so the same palm tree
//            stands on grass in one map and on sand in the next.
//
// The second kind is the newer one. Before the split every tile filled its own
// square, so a palm tree carried a square of sand with it and left that square
// sitting in the middle of a grass field. `render.js` now draws the ground of
// the screen first and the thing on top, and `world.js` `tileStack` says in
// which order.
//
// Texture comes from `noise`, which takes a seed and therefore scatters the same
// speckles on every load. A tile that changed between reloads would make the
// ground crawl.
//
// Every builder takes a variant number. Ground uses it to shift its seeds, so a
// field is made of four different grass tiles instead of one repeated: one tile
// repeated draws its speckles every 16 pixels, and the eye reads that grid as
// wallpaper. `render.js` picks the variant from the position, so it never
// changes under the player either.

/** Every map tile is drawn on this grid. */
export const TILE_SIZE = 16;

/** How many versions of each tile exist, to break up a repeating texture. */
export const TILE_VARIANTS = 4;

/** Move a noise seed along for a variant, far enough to look unrelated. */
const seedFor = (seed, variant) => seed + variant * 977;

const fill = (c) => ({ k: "rect", x: 0, y: 0, w: TILE_SIZE, h: TILE_SIZE, c });

/** A tile drawing: flat, seamless, no outline. */
const tile = (shapes) => ({ w: TILE_SIZE, h: TILE_SIZE, outline: null, shade: false, shapes });

/**
 * A picture written out as characters, one per pixel.
 *
 * At sixteen pixels across, a palm frond is two pixels wide. A drawing that
 * small is easier to read, and easier to correct, as a picture than as a list of
 * ellipses and lines: a stroked line of that width comes out as a scratch. Each
 * character names a colour in `key`, and a space leaves the ground showing.
 *
 * @param {string[]} rows sixteen strings, sixteen characters each
 * @param {Record<string,string>} key which colour each character means
 */
const drawn = (rows, key) => {
  const points = new Map();
  rows.forEach((row, y) => {
    [...row].forEach((character, x) => {
      const color = key[character];
      if (!color) return;
      if (!points.has(color)) points.set(color, []);
      points.get(color).push([x, y]);
    });
  });
  return [...points].map(([c, pts]) => ({ k: "px", pts, c }));
};

/** The same picture facing the other way, so one drawing gives two tiles. */
const mirrored = (rows) => rows.map((row) => [...row].reverse().join(""));

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
  path: (v) =>
    tile([
      fill("#c9a06a"),
      speckle("#b98d57", 0.14, seedFor(11, v)),
      speckle("#d8b280", 0.08, seedFor(12, v)),
    ]),

  grass: (v) =>
    tile([
      fill("#5a9440"),
      speckle("#4c8035", 0.16, seedFor(21, v)),
      speckle("#6da84c", 0.1, seedFor(22, v)),
    ]),

  sand: (v) =>
    tile([
      fill("#e0cb92"),
      speckle("#d1b878", 0.12, seedFor(41, v)),
      speckle("#efe0b4", 0.08, seedFor(42, v)),
    ]),

  mud: (v) =>
    tile([
      fill("#7d6244"),
      speckle("#6a523a", 0.18, seedFor(51, v)),
      speckle("#8f7350", 0.09, seedFor(52, v)),
    ]),

  bridge: (v) =>
    tile([
      fill("#9c7442"),
      { k: "rect", x: 0, y: 0, w: 16, h: 1, c: "#7d5a30" },
      { k: "rect", x: 0, y: 7, w: 16, h: 1, c: "#7d5a30" },
      { k: "rect", x: 0, y: 15, w: 16, h: 1, c: "#7d5a30" },
      speckle("#8a6438", 0.1, seedFor(71, v)),
    ]),

  // --- Water --------------------------------------------------------------
  // The ripples move with the variant as well as the speckles. Four identical
  // dashes on a 16 pixel grid read as printed wallpaper, not as a river.
  water: (v) => {
    const ripples = [
      [
        [2, 4, 5],
        [9, 10, 5],
        [4, 12, 3],
      ],
      [
        [7, 3, 5],
        [1, 9, 4],
        [11, 13, 4],
      ],
      [
        [10, 5, 4],
        [3, 8, 5],
        [8, 14, 3],
      ],
      [
        [1, 2, 4],
        [6, 11, 5],
        [12, 7, 3],
      ],
    ][((v % TILE_VARIANTS) + TILE_VARIANTS) % TILE_VARIANTS];
    return tile([
      fill("#2f6fb0"),
      speckle("#2a639e", 0.15, seedFor(91, v)),
      ...ripples.map(([x, y, w], index) => ({
        k: "rect",
        x,
        y,
        w,
        h: 1,
        c: index === 1 ? "#5a9ccc" : "#79b7de",
      })),
    ]);
  },

  // --- Inside a building --------------------------------------------------
  // Swept earth, polished smooth. It used to carry a line down two sides, which
  // drew a grid of ceramic squares across every floor in the game.
  floor: (v) =>
    tile([
      fill("#c9b08a"),
      speckle("#bfa47d", 0.1, seedFor(121, v)),
      speckle("#d4bd9a", 0.07, seedFor(123, v)),
    ]),

  // The gym floor carries an Adinkra mark, but only on one variant in four, so
  // the marks scatter across the room instead of covering every square.
  gymFloor: (v) => {
    const shapes = [fill("#7a5c40"), speckle("#6e5238", 0.1, seedFor(161, v))];
    if (v % TILE_VARIANTS === 0) {
      shapes.push(
        { k: "rect", x: 4, y: 7, w: 8, h: 2, c: "#a8823a" },
        { k: "rect", x: 7, y: 4, w: 2, h: 8, c: "#a8823a" },
        { k: "px", pts: [[5, 5], [10, 5], [5, 10], [10, 10]], c: "#8d6c2f" },
      );
    }
    return tile(shapes);
  },

  // --- Underground --------------------------------------------------------
  cave: (v) =>
    tile([
      fill("#6a5f52"),
      speckle("#5c5246", 0.16, seedFor(131, v)),
      speckle("#7a6e60", 0.08, seedFor(132, v)),
    ]),

  // Rough rock all the way through. A lighter row along the top used to draw a
  // bright rung every 16 pixels down a cave wall, so a wall read as a ladder.
  caveWall: (v) =>
    tile([
      fill("#413a32"),
      speckle("#36302a", 0.18, seedFor(141, v)),
      speckle("#4b4239", 0.1, seedFor(143, v)),
      { k: "px", pts: [[4, 6], [10, 9], [7, 12]], c: "#2d2823" },
    ]),

  // --- Buildings ----------------------------------------------------------
  // Mud brick: courses every eight rows with the joints offset, which repeats
  // cleanly in both directions. A dark row along the top used to stripe every
  // wall, so a hut read as a stack of planks.
  hut: (v) =>
    tile([
      fill("#c08a52"),
      speckle("#b07c46", 0.12, seedFor(101, v)),
      speckle("#cb9761", 0.07, seedFor(103, v)),
      { k: "rect", x: 0, y: 7, w: 16, h: 1, c: "#a3703c" },
      { k: "rect", x: 0, y: 15, w: 16, h: 1, c: "#a3703c" },
      { k: "rect", x: 5, y: 0, w: 1, h: 7, c: "#a3703c" },
      { k: "rect", x: 13, y: 0, w: 1, h: 7, c: "#a3703c" },
      { k: "rect", x: 1, y: 8, w: 1, h: 7, c: "#a3703c" },
      { k: "rect", x: 9, y: 8, w: 1, h: 7, c: "#a3703c" },
      // A lit top edge on each brick, which is what makes it read as raised.
      { k: "rect", x: 0, y: 0, w: 16, h: 1, c: "#cd9860" },
      { k: "rect", x: 0, y: 8, w: 16, h: 1, c: "#cd9860" },
    ]),

  wall: (v) =>
    tile([
      fill("#9c7a5a"),
      speckle("#8f6e4e", 0.1, seedFor(111, v)),
      { k: "rect", x: 0, y: 7, w: 16, h: 1, c: "#7d5f44" },
      { k: "rect", x: 0, y: 15, w: 16, h: 1, c: "#7d5f44" },
      { k: "rect", x: 4, y: 0, w: 1, h: 7, c: "#8a6a4c" },
      { k: "rect", x: 12, y: 0, w: 1, h: 7, c: "#8a6a4c" },
      { k: "rect", x: 0, y: 8, w: 1, h: 7, c: "#8a6a4c" },
      { k: "rect", x: 8, y: 8, w: 1, h: 7, c: "#8a6a4c" },
    ]),

  // A thatched roof. Every building puts this on its top row: without it a hut
  // is a flat brown rectangle and reads as a wall, not as somewhere to live.
  roof: (v) =>
    tile([
      fill("#b8893f"),
      speckle("#a67a33", 0.16, seedFor(151, v)),
      { k: "line", pts: [[0, 5], [5, 0]], c: "#d1a352" },
      { k: "line", pts: [[0, 11], [11, 0]], c: "#d1a352" },
      { k: "line", pts: [[4, 15], [15, 4]], c: "#d1a352" },
      { k: "line", pts: [[10, 15], [15, 10]], c: "#d1a352" },
      { k: "line", pts: [[0, 8], [8, 0]], c: "#94682a" },
      { k: "line", pts: [[7, 15], [15, 7]], c: "#94682a" },
      { k: "rect", x: 0, y: 14, w: 16, h: 2, c: "#7d5620" },
    ]),

  // --- Things that grow ---------------------------------------------------
  // Tall grass. This is the tile that starts battles, so the player has to see
  // it coming, and it used to say so with a flat dark square. A block of them
  // read as a painted rectangle rather than as long grass.
  //
  // Now the shade is a dither, not a fill: it darkens the ground it stands on
  // and lets some of it through, so the edge of a patch breaks up instead of
  // ruling a line, and tall grass on sand looks like tall grass on sand. The
  // blades over the top are what actually name the tile at a glance.
  tall: (v) => {
    // Each variant roots its blades in different places. A single layout put a
    // blade at the same column in every tile, and the blades of the tile above
    // met the blades of the tile below into one unbroken bright stripe running
    // the whole height of the patch.
    //
    // A blade is one pixel wide, which is what a blade of grass looks like, and
    // stops a row short of the bottom, so the ground shows between the tufts.
    const blades = [
      [[1, 2, 3], [5, 4, 6], [8, 9, 1], [12, 11, 4], [14, 15, 7]],
      [[0, 1, 5], [3, 2, 2], [7, 8, 6], [10, 9, 3], [13, 14, 5]],
      [[2, 1, 4], [4, 5, 7], [6, 7, 2], [9, 10, 5], [15, 14, 3]],
      [[1, 0, 6], [4, 3, 3], [7, 6, 5], [9, 10, 1], [13, 12, 7]],
    ][((v % TILE_VARIANTS) + TILE_VARIANTS) % TILE_VARIANTS];
    return tile([
      // The shade is a dither over the whole tile, not a fill. It darkens the
      // ground and lets some of it through, so the edge of a patch breaks up
      // instead of ruling a line, and it darkens sand as readily as grass.
      speckle("#3f7a2e", 0.62, seedFor(31, v)),
      speckle("#2f6321", 0.26, seedFor(33, v)),
      ...blades.map(([baseX, topX, topY], index) => ({
        k: "line",
        pts: [
          [baseX, 14],
          [topX, topY],
        ],
        c: index % 2 === 0 ? "#63b84a" : "#4f9d3a",
      })),
      { k: "px", pts: blades.map(([, topX, topY]) => [topX, topY - 1]), c: "#8ada6c" },
    ]);
  },

  flowers: (v) =>
    tile([
      { k: "line", pts: [[4, 8], [4, 4]], c: "#4f9d3a" },
      { k: "line", pts: [[12, 13], [12, 10]], c: "#4f9d3a" },
      { k: "line", pts: [[8, 15], [8, 13]], c: "#4f9d3a" },
      { k: "px", pts: [[3, 4], [4, 3], [4, 5], [5, 4]], c: "#e0622b" },
      { k: "px", pts: [[11, 10], [12, 9], [12, 11], [13, 10]], c: "#e3c65a" },
      { k: "px", pts: [[8, 13], [7, 12]], c: "#d8607f" },
      { k: "px", pts: [[2, 7], [6, 6], [10, 13], [14, 12]], c: "#6da84c" },
      { k: "px", pts: [[1, 12], [15, 4]], c: "#f0d68a" },
    ]),

  // A coconut palm, written out pixel by pixel. The trunk is two pixels wide,
  // so the crown carries the whole tree and every frond has to count.
  //
  // Two layouts, each also drawn facing the other way, so a row of palms along a
  // beach is not one shape stamped over and over.
  palm: (v) => {
    const shapes = [
      // A tall palm, fronds arching up and out.
      [
        "  ddd      ddd  ",
        " dmLLd    dLLmd ",
        "  dmLLd  dLLmd  ",
        "   dmLLddLLmd   ",
        " ddmLLLLLLLLmdd ",
        "dmLLLLhhhhLLLLmd",
        " dmLLdo oodLLmd ",
        "  ddd  tTS ddd  ",
        "       tTS      ",
        "       tSS      ",
        "       tTS      ",
        "       tTS      ",
        "       tSS      ",
        "       tTS      ",
        "       tTS      ",
        "       tSS      ",
      ],
      // A shorter one, fronds drooping wider.
      [
        "      dddd      ",
        "  ddd dmmd ddd  ",
        " dmLLdmLLmdLLmd ",
        "dmLLLLLhhLLLLLmd",
        " dmLLdo oodLLmd ",
        "  ddd  tTS ddd  ",
        "       tTS      ",
        "       tSS      ",
        "       tTS      ",
        "       tTS      ",
        "       tSS      ",
        "       tTS      ",
        "       tTS      ",
        "       tSS      ",
        "       tTS      ",
        "       tTS      ",
      ],
    ];
    const set = ((v % TILE_VARIANTS) + TILE_VARIANTS) % TILE_VARIANTS;
    const rows = set < 2 ? shapes[set] : mirrored(shapes[set - 2]);
    return tile(
      drawn(rows, {
        // A frond catches the sun, so it is lighter than the grass it stands on,
        // not darker. Dark green along its edge does the work an outline would
        // do, and a tile is not allowed an outline: two palms side by side would
        // draw a line between them.
        d: "#2d5c20",
        m: "#4f9d3a",
        L: "#7ecb5c",
        h: "#a3e07f",
        T: "#8a6438",
        t: "#a87f4c",
        S: "#6f5028",
        o: "#e0c247",
      }),
    );
  },

  // The canopy is wider than the square, so its edges run off all four sides and
  // a row of trees closes into one mass of forest. Only the corners stay clear,
  // and they give the edge of that mass a ragged outline rather than a straight
  // one. A canopy that fitted inside its square drew a row of separate circles.
  //
  // No trunk. Area 1 uses trees only as the wall of jungle round a map, and a
  // trunk under every canopy scattered brown flecks along it.
  tree: (v) => {
    const set = ((v % TILE_VARIANTS) + TILE_VARIANTS) % TILE_VARIANTS;
    const offset = [0, 1, -1, 0][set];
    return tile([
      { k: "ellipse", cx: 8, cy: 7.5, rx: 10, ry: 10, c: "#2d5c20" },
      { k: "ellipse", cx: 8, cy: 6.5, rx: 8, ry: 7, c: "#356a26" },
      { k: "ellipse", cx: 6 + offset, cy: 5, rx: 4.5, ry: 3.5, c: "#4f9d3a" },
      { k: "ellipse", cx: 11 - offset, cy: 11, rx: 4, ry: 3, c: "#26501b" },
      {
        k: "px",
        pts: [[4 + offset, 3], [9 + offset, 2], [3, 7], [12, 4], [7, 9]],
        c: "#63b84a",
      },
    ]);
  },

  crop: (v) =>
    tile([
      // A little tilled earth around the roots, and the rest is stalk.
      speckle("#7d6244", 0.35, seedFor(181, v)),
      { k: "line", pts: [[3, 15], [3, 4]], c: "#4f9d3a", w: 2 },
      { k: "line", pts: [[8, 15], [8, 2]], c: "#4f9d3a", w: 2 },
      { k: "line", pts: [[13, 15], [13, 5]], c: "#4f9d3a", w: 2 },
      { k: "px", pts: [[3, 3], [8, 1], [13, 4]], c: "#e3c65a" },
      { k: "px", pts: [[2, 8], [5, 6], [7, 9], [10, 7], [12, 10]], c: "#63b84a" },
    ]),

  // --- Things in the way --------------------------------------------------
  rock: (v) => {
    const offset = [0, 1, -1, 0][((v % TILE_VARIANTS) + TILE_VARIANTS) % TILE_VARIANTS];
    return tile([
      { k: "ellipse", cx: 8 + offset, cy: 9, rx: 7, ry: 6, c: "#8d8378" },
      { k: "ellipse", cx: 8 + offset, cy: 7, rx: 5, ry: 4, c: "#a49a8d" },
      { k: "px", pts: [[5, 11], [10, 12], [12, 8]], c: "#6f665c" },
      { k: "rect", x: 3, y: 14, w: 10, h: 1, c: "#6f665c" },
    ]);
  },

  oreRock: (v) => {
    const offset = [0, 1, -1, 0][((v % TILE_VARIANTS) + TILE_VARIANTS) % TILE_VARIANTS];
    return tile([
      { k: "ellipse", cx: 8 + offset, cy: 9, rx: 7, ry: 6, c: "#4b4239" },
      { k: "ellipse", cx: 8 + offset, cy: 7, rx: 5, ry: 4, c: "#5c5246" },
      // The gold the miners are after, showing through the rock.
      { k: "px", pts: [[5, 7], [6, 8], [10, 6], [11, 11], [8, 12]], c: "#c9a227" },
      { k: "px", pts: [[6, 7], [10, 7]], c: "#f2dd8c" },
    ]);
  },

  fence: () =>
    tile([
      { k: "rect", x: 0, y: 6, w: 16, h: 2, c: "#8a6438" },
      { k: "rect", x: 0, y: 11, w: 16, h: 2, c: "#8a6438" },
      { k: "rect", x: 6, y: 2, w: 3, h: 13, c: "#7d5a30" },
      { k: "rect", x: 6, y: 2, w: 1, h: 13, c: "#9c7442" },
    ]),

  sign: () =>
    tile([
      { k: "rect", x: 7, y: 9, w: 2, h: 6, c: "#7d5a30" },
      { k: "rect", x: 2, y: 2, w: 12, h: 8, c: "#a37d4c" },
      { k: "rect", x: 2, y: 2, w: 12, h: 1, c: "#c19a63" },
      { k: "rect", x: 3, y: 4, w: 8, h: 1, c: "#5f4324" },
      { k: "rect", x: 3, y: 6, w: 9, h: 1, c: "#5f4324" },
      { k: "rect", x: 2, y: 9, w: 12, h: 1, c: "#5f4324" },
    ]),

  // A step down, with the drop in shadow. It used to fill its square with path
  // colour, which put a tan bar across a green field.
  ledge: () =>
    tile([
      { k: "rect", x: 0, y: 2, w: 16, h: 3, c: "#a8834e" },
      { k: "rect", x: 0, y: 5, w: 16, h: 4, c: "#7d5f3a" },
      { k: "rect", x: 0, y: 9, w: 16, h: 1, c: "#6a5031" },
      { k: "px", pts: [[3, 3], [11, 3]], c: "#c19a63" },
    ]),

  // --- Furniture ----------------------------------------------------------
  mat: () =>
    tile([
      { k: "rect", x: 1, y: 2, w: 14, h: 12, c: "#b8562f" },
      { k: "rect", x: 1, y: 4, w: 14, h: 1, c: "#e3c65a" },
      { k: "rect", x: 1, y: 8, w: 14, h: 1, c: "#1f5c4a" },
      { k: "rect", x: 1, y: 11, w: 14, h: 1, c: "#e3c65a" },
      { k: "px", pts: [[3, 6], [7, 6], [11, 6], [5, 13], [10, 13]], c: "#f0d68a" },
    ]),

  bed: () =>
    tile([
      { k: "rect", x: 1, y: 1, w: 14, h: 14, c: "#3f7a8e" },
      { k: "rect", x: 2, y: 2, w: 12, h: 5, c: "#f0e6d2" },
      { k: "rect", x: 1, y: 9, w: 14, h: 1, c: "#2f5f70" },
      { k: "rect", x: 1, y: 14, w: 14, h: 1, c: "#2f5f70" },
    ]),

  table: () =>
    tile([
      { k: "rect", x: 1, y: 3, w: 14, h: 10, c: "#8a6438" },
      { k: "rect", x: 1, y: 3, w: 14, h: 2, c: "#a37d4c" },
      { k: "rect", x: 1, y: 12, w: 14, h: 1, c: "#6a4c28" },
      { k: "px", pts: [[4, 8], [11, 9]], c: "#7d5a30" },
    ]),

  counter: () =>
    tile([
      { k: "rect", x: 0, y: 2, w: 16, h: 12, c: "#7d5a30" },
      { k: "rect", x: 0, y: 2, w: 16, h: 3, c: "#a37d4c" },
      { k: "rect", x: 0, y: 12, w: 16, h: 2, c: "#5f4324" },
    ]),

  shelf: () =>
    tile([
      { k: "rect", x: 0, y: 1, w: 16, h: 14, c: "#8a6a4c" },
      { k: "rect", x: 0, y: 2, w: 16, h: 5, c: "#7d5f44" },
      { k: "rect", x: 0, y: 10, w: 16, h: 5, c: "#7d5f44" },
      { k: "px", pts: [[3, 4], [7, 4], [11, 4]], c: "#e0622b" },
      { k: "px", pts: [[4, 12], [9, 12], [13, 12]], c: "#3f88c0" },
    ]),

  pot: () =>
    tile([
      { k: "ellipse", cx: 8, cy: 10, rx: 6, ry: 5, c: "#a04a2c" },
      { k: "ellipse", cx: 8, cy: 5, rx: 4, ry: 2, c: "#8a3a20" },
      { k: "rect", x: 3, y: 9, w: 10, h: 1, c: "#c96b46" },
    ]),

  statue: () =>
    tile([
      { k: "poly", pts: [[4, 15], [6, 3], [10, 3], [12, 15]], c: "#7a6a58" },
      { k: "ellipse", cx: 8, cy: 4, rx: 3, ry: 3, c: "#8d7c68" },
      { k: "px", pts: [[6, 4], [9, 4]], c: "#3a2c1e" },
      { k: "rect", x: 3, y: 14, w: 10, h: 2, c: "#6a5c4a" },
    ]),

  // --- Machines the player presses A on -----------------------------------
  // Both stand against a wall, so both leave the two outside columns clear and
  // the ground of the room shows down each side.

  // A healing machine: a wooden cabinet with an enamel tray of six hollows, one
  // for each creature, and a row of lamps that run along the top while it works.
  healer: () =>
    tile([
      { k: "rect", x: 1, y: 4, w: 14, h: 10, c: "#8a6438" },
      { k: "rect", x: 1, y: 4, w: 14, h: 2, c: "#a37d4c" },
      { k: "rect", x: 2, y: 7, w: 12, h: 5, c: "#e8e2d4" },
      { k: "px", pts: [[4, 8], [7, 8], [10, 8], [4, 10], [7, 10], [10, 10]], c: "#9aa4a8" },
      { k: "px", pts: [[3, 5]], c: "#c0392b" },
      { k: "px", pts: [[8, 5]], c: "#e3b23a" },
      { k: "px", pts: [[13, 5]], c: "#4fbf46" },
      { k: "rect", x: 1, y: 13, w: 14, h: 1, c: "#5f4324" },
    ]),

  // A storage computer on its desk. The three bright pixels are the list of
  // creatures on the screen, which is what the box screen shows.
  computer: () =>
    tile([
      { k: "rect", x: 2, y: 2, w: 12, h: 9, c: "#c9c2b0" },
      { k: "rect", x: 2, y: 2, w: 12, h: 1, c: "#ddd6c4" },
      { k: "rect", x: 3, y: 4, w: 10, h: 5, c: "#2b3f52" },
      { k: "rect", x: 4, y: 5, w: 8, h: 3, c: "#3f88c0" },
      { k: "px", pts: [[5, 6], [7, 6], [9, 6]], c: "#8fd0ff" },
      { k: "rect", x: 6, y: 11, w: 4, h: 1, c: "#a89f8c" },
      { k: "rect", x: 1, y: 12, w: 14, h: 2, c: "#8a6438" },
      { k: "rect", x: 1, y: 12, w: 14, h: 1, c: "#a37d4c" },
    ]),

  // --- Ways through -------------------------------------------------------
  door: () =>
    tile([
      { k: "rect", x: 2, y: 2, w: 12, h: 14, c: "#5f4324" },
      { k: "rect", x: 3, y: 3, w: 10, h: 13, c: "#7d5a30" },
      { k: "rect", x: 3, y: 3, w: 10, h: 1, c: "#8f6a3c" },
      { k: "px", pts: [[11, 9], [11, 10]], c: "#e3c65a" },
    ]),

  stairs: () =>
    tile([
      { k: "rect", x: 1, y: 2, w: 14, h: 4, c: "#9c7a5a" },
      { k: "rect", x: 1, y: 2, w: 14, h: 1, c: "#b08e6c" },
      { k: "rect", x: 1, y: 7, w: 14, h: 4, c: "#8a6a4c" },
      { k: "rect", x: 1, y: 7, w: 14, h: 1, c: "#9c7a5a" },
      { k: "rect", x: 1, y: 12, w: 14, h: 3, c: "#7d5f44" },
      { k: "rect", x: 1, y: 12, w: 14, h: 1, c: "#8a6a4c" },
    ]),

  // A hole with a ladder in it. It used to be a square of path colour, which in
  // a dark mine read as a hole in the drawing rather than a way out.
  exit: () =>
    tile([
      { k: "ellipse", cx: 8, cy: 8, rx: 7, ry: 6, c: "#2b2620" },
      { k: "ellipse", cx: 8, cy: 8, rx: 5, ry: 4, c: "#141210" },
      { k: "rect", x: 5, y: 4, w: 1, h: 9, c: "#8a6438" },
      { k: "rect", x: 10, y: 4, w: 1, h: 9, c: "#8a6438" },
      { k: "px", pts: [[6, 6], [7, 6], [8, 6], [9, 6], [6, 9], [7, 9], [8, 9], [9, 9]], c: "#9c7442" },
    ]),
};

/** Every tile this module can draw. */
export const TILE_ART_IDS = Object.keys(TILE_ART);

/**
 * The drawing for one tile.
 *
 * @param {string} tileId the tile to draw
 * @param {number} variant which version of it, wrapping round out of range
 * @returns {object|null} null when the tile has no art yet
 */
export function tileDrawing(tileId, variant = 0) {
  const build = TILE_ART[tileId];
  if (!build) return null;
  const wrapped = ((Math.trunc(variant) % TILE_VARIANTS) + TILE_VARIANTS) % TILE_VARIANTS;
  return build(wrapped);
}
