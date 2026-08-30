// What every creature looks like.
//
// One entry per species, each a list of shapes for `pixelArt.js` to rasterise.
// Read `pixelArt.js` first: it explains the shape language, the outline pass
// and the shading pass.
//
// Three rules hold the look together, and a new creature should follow them:
//
//   1. Every creature is 40 by 40 and faces the viewer. The battle screen draws
//      the player's side flipped, so a front-facing creature works on both
//      sides and needs one drawing instead of two.
//   2. The middle is 19.5, not 20. Mirroring maps x to 39 minus x, so a shape
//      centred on 19.5 lands on itself and `sym: true` pairs come out even.
//   3. Bold flat colour inside a heavy dark contour, the way Adinkra symbols
//      and printed cloth are drawn. Small marks, not fine gradients.

/** Every creature is drawn on this grid. */
export const SPRITE_SIZE = 40;

/** The middle of that grid. Mirroring turns x into 39 minus x. */
export const CENTRE = 19.5;

/** The one dark contour colour the whole game shares. */
export const OUTLINE = "#20140a";

const WHITE = "#fdf6e3";
const SHINE = "#ffffff";

/** A pair of eyes, mirrored. `x` is the left one. */
function eyes({ x, y, r = 3.2, pupil = 1.5, white = WHITE, dark = OUTLINE }) {
  return [
    { k: "ellipse", cx: x, cy: y, rx: r, ry: r, c: white, sym: true },
    { k: "ellipse", cx: x, cy: y + 0.4, rx: pupil, ry: pupil, c: dark, sym: true },
    { k: "px", pts: [[Math.round(x - r * 0.45), Math.round(y - r * 0.45)]], c: SHINE, sym: true },
  ];
}

/** Two narrow eyes, for a creature that is asleep or unimpressed. */
function sleepyEyes({ x, y, w = 5, c = OUTLINE }) {
  return [{ k: "rect", x: Math.round(x - w / 2), y, w, h: 1, c, sym: true }];
}

/** A pair of stubby legs under a body. */
function legs({ x, y, w = 4, h = 5, c }) {
  return [{ k: "rect", x, y, w, h, c, sym: true }];
}

/**
 * Every creature drawing, keyed by species identifier.
 * The values are functions so nothing is rasterised until the game asks.
 */
export const CREATURE_ART = {
  // --- Grass starter line -------------------------------------------------
  baobo: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Swollen baobab trunk, wide at the foot.
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 10, ry: 9, c: "#a9793f" },
      { k: "rect", x: 15, y: 13, w: 10, h: 9, c: "#a9793f" },
      // Bark rings.
      { k: "rect", x: 12, y: 26, w: 16, h: 1, c: "#8a5f2c" },
      { k: "rect", x: 13, y: 31, w: 14, h: 1, c: "#8a5f2c" },
      // A crown of three leaf clusters.
      { k: "ellipse", cx: CENTRE, cy: 9, rx: 8, ry: 5, c: "#4f9d3a" },
      { k: "ellipse", cx: 11, cy: 12, rx: 5, ry: 4, c: "#41862f", sym: true },
      { k: "ellipse", cx: 15, cy: 7, rx: 4, ry: 3, c: "#63b84a", sym: true },
      // Roots for feet.
      ...legs({ x: 12, y: 34, w: 5, h: 4, c: "#8a5f2c" }),
      ...eyes({ x: 15, y: 24, r: 3.4 }),
      // A seed pod hanging off one branch.
      { k: "ellipse", cx: 7, cy: 15, rx: 2, ry: 3, c: "#c98b3d" },
    ],
  }),

  baobanto: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // A grown tree: broad canopy, thick trunk, buttress roots.
      { k: "ellipse", cx: CENTRE, cy: 10, rx: 15, ry: 7, c: "#41862f" },
      { k: "ellipse", cx: 9, cy: 13, rx: 6, ry: 5, c: "#377a28", sym: true },
      { k: "ellipse", cx: 14, cy: 6, rx: 6, ry: 4, c: "#63b84a", sym: true },
      { k: "rect", x: 13, y: 16, w: 14, h: 14, c: "#a9793f" },
      { k: "ellipse", cx: CENTRE, cy: 31, rx: 13, ry: 7, c: "#a9793f" },
      // Branch arms reaching out.
      { k: "line", pts: [[13, 20], [5, 16]], c: "#a9793f", w: 3, sym: true },
      { k: "px", pts: [[4, 15], [3, 14]], c: "#4f9d3a", sym: true },
      // Bark grain and buttress roots.
      { k: "rect", x: 11, y: 27, w: 18, h: 1, c: "#8a5f2c" },
      { k: "poly", pts: [[6, 38], [11, 30], [14, 38]], c: "#8a5f2c", sym: true },
      ...eyes({ x: 14, y: 23, r: 3.6 }),
      { k: "rect", x: 17, y: 29, w: 6, h: 1, c: "#6f4a20" },
    ],
  }),

  // --- Fire starter line --------------------------------------------------
  ananse: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Eight legs first, so the body sits over them.
      { k: "line", pts: [[14, 24], [4, 18]], c: "#5e2a14", w: 2, sym: true },
      { k: "line", pts: [[14, 26], [3, 26]], c: "#5e2a14", w: 2, sym: true },
      { k: "line", pts: [[14, 28], [5, 34]], c: "#5e2a14", w: 2, sym: true },
      { k: "line", pts: [[15, 30], [10, 37]], c: "#5e2a14", w: 2, sym: true },
      // Abdomen and head.
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 9, ry: 8, c: "#8c3a1e" },
      { k: "ellipse", cx: CENTRE, cy: 16, rx: 7, ry: 6, c: "#a34523" },
      // The ember it keeps on its back.
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 4, ry: 4, c: "#e0622b" },
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 2, ry: 2, c: "#f7c14b" },
      // Four small eyes, spider fashion.
      ...eyes({ x: 15, y: 15, r: 2.4, pupil: 1.1 }),
      { k: "ellipse", cx: 17, cy: 19, rx: 1.4, ry: 1.4, c: WHITE, sym: true },
      // Fangs.
      { k: "px", pts: [[17, 21], [18, 22]], c: "#f0e0c0", sym: true },
    ],
  }),

  ansefo: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      { k: "line", pts: [[13, 22], [2, 14]], c: "#4a1f10", w: 3, sym: true },
      { k: "line", pts: [[13, 26], [1, 27]], c: "#4a1f10", w: 3, sym: true },
      { k: "line", pts: [[14, 30], [4, 37]], c: "#4a1f10", w: 3, sym: true },
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 11, ry: 9, c: "#6d2c16" },
      { k: "ellipse", cx: CENTRE, cy: 14, rx: 8, ry: 7, c: "#8c3a1e" },
      // A spirit mask worn on the face.
      { k: "poly", pts: [[13, 9], [26, 9], [24, 20], [15, 20]], c: "#d8b06a" },
      { k: "rect", x: 18, y: 10, w: 3, h: 10, c: "#8c3a1e" },
      { k: "px", pts: [[15, 12], [15, 13], [15, 16], [15, 17]], c: "#6d2c16", sym: true },
      // Flames along the back.
      { k: "poly", pts: [[14, 22], [16, 16], [18, 22]], c: "#e0622b", sym: true },
      { k: "poly", pts: [[17, 34], [19.5, 26], [22, 34]], c: "#e0622b" },
      { k: "ellipse", cx: CENTRE, cy: 30, rx: 3, ry: 3, c: "#f7c14b" },
      ...eyes({ x: 16, y: 14, r: 2.2, pupil: 1, white: "#f7c14b" }),
    ],
  }),

  // --- Water starter line -------------------------------------------------
  volti: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // A river calf: smooth, round, no corners anywhere.
      { k: "ellipse", cx: CENTRE, cy: 25, rx: 12, ry: 10, c: "#3f88c0" },
      { k: "ellipse", cx: CENTRE, cy: 30, rx: 9, ry: 6, c: "#79b7de" },
      { k: "ellipse", cx: CENTRE, cy: 15, rx: 8, ry: 7, c: "#4a93c9" },
      // Flippers.
      { k: "ellipse", cx: 7, cy: 27, rx: 4, ry: 3, c: "#357aae", sym: true },
      // Tail fin.
      { k: "poly", pts: [[16, 36], [19.5, 32], [23, 36]], c: "#357aae" },
      ...eyes({ x: 15, y: 14, r: 3.2 }),
      // Nostrils and a small smile.
      { k: "px", pts: [[17, 19]], c: OUTLINE, sym: true },
      { k: "rect", x: 17, y: 20, w: 6, h: 1, c: "#2b6a99" },
      // Water bead on the brow.
      { k: "ellipse", cx: CENTRE, cy: 8, rx: 2, ry: 2.5, c: "#a8d8f0" },
    ],
  }),

  voltamo: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 15, ry: 11, c: "#2f7fc4" },
      { k: "ellipse", cx: CENTRE, cy: 32, rx: 12, ry: 6, c: "#79b7de" },
      { k: "ellipse", cx: CENTRE, cy: 14, rx: 11, ry: 9, c: "#3f88c0" },
      // A broad muzzle, the way a hippo carries it.
      { k: "ellipse", cx: CENTRE, cy: 18, rx: 8, ry: 5, c: "#5ba3d4" },
      { k: "px", pts: [[16, 17], [17, 17]], c: "#20140a", sym: true },
      // Tusks.
      { k: "poly", pts: [[14, 21], [16, 21], [15, 24]], c: "#f0e6cc", sym: true },
      { k: "ellipse", cx: 4, cy: 29, rx: 4, ry: 3, c: "#2b6a99", sym: true },
      { k: "poly", pts: [[14, 38], [19.5, 33], [25, 38]], c: "#2b6a99" },
      ...eyes({ x: 13, y: 11, r: 3 }),
      // Ridge of river stones along the back.
      { k: "ellipse", cx: 12, cy: 20, rx: 2, ry: 1.5, c: "#8a6a4a", sym: true },
    ],
  }),

  // --- The seven ----------------------------------------------------------
  hinoko: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Body and tail first, then the locks, then the face on top.
      { k: "ellipse", cx: CENTRE, cy: 31, rx: 8, ry: 7, c: "#c98b3d" },
      ...legs({ x: 13, y: 35, w: 4, h: 4, c: "#b1762f" }),
      { k: "line", pts: [[26, 31], [34, 27]], c: "#b1762f", w: 2 },
      { k: "ellipse", cx: 36, cy: 25, rx: 2.5, ry: 3, c: "#4f9d3a" },
      // The mane, drawn one lock at a time. This is the whole point of the
      // creature, so it must never be a single filled blob: each rope hangs on
      // its own, and the ones at the bottom fall past the shoulders.
      { k: "line", pts: [[15, 8], [12, 0]], c: "#356b26", w: 3, sym: true },
      { k: "line", pts: [[12, 10], [5, 3]], c: "#4f9d3a", w: 3, sym: true },
      { k: "line", pts: [[10, 14], [1, 10]], c: "#356b26", w: 3, sym: true },
      { k: "line", pts: [[10, 18], [1, 19]], c: "#4f9d3a", w: 3, sym: true },
      { k: "line", pts: [[11, 21], [3, 29]], c: "#356b26", w: 3, sym: true },
      { k: "line", pts: [[13, 24], [8, 35]], c: "#4f9d3a", w: 3, sym: true },
      { k: "line", pts: [[16, 25], [14, 38]], c: "#356b26", w: 3, sym: true },
      // Beads knotted into the ends of the locks.
      { k: "px", pts: [[2, 20], [4, 30], [9, 34], [15, 37], [5, 3]], c: "#e0622b", sym: true },
      // Face, set inside the mane.
      { k: "ellipse", cx: CENTRE, cy: 17, rx: 8, ry: 7.5, c: "#e0a95c" },
      ...eyes({ x: 15, y: 15, r: 3 }),
      { k: "poly", pts: [[17, 19], [22, 19], [19.5, 22]], c: "#8a5f2c" },
      { k: "rect", x: 16, y: 22, w: 7, h: 1, c: "#8a5f2c" },
    ],
  }),

  polete: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Small body, huge ears, a tail shaped like a bolt.
      { k: "poly", pts: [[24, 26], [33, 20], [29, 26], [36, 22], [30, 32]], c: "#e3b23a" },
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 8, ry: 7, c: "#d8a63a" },
      { k: "ellipse", cx: CENTRE, cy: 30, rx: 5, ry: 4, c: "#f0d68a" },
      { k: "ellipse", cx: CENTRE, cy: 17, rx: 8, ry: 7, c: "#e3b23a" },
      // Ears, big and round, with a dark rim.
      { k: "ellipse", cx: 11, cy: 8, rx: 5, ry: 6, c: "#e3b23a", sym: true },
      { k: "ellipse", cx: 11, cy: 8, rx: 2.5, ry: 3.5, c: "#8a5f2c", sym: true },
      ...legs({ x: 13, y: 32, w: 4, h: 4, c: "#c1902c" }),
      ...eyes({ x: 15, y: 16, r: 3 }),
      // Cheeks, where the charge sits.
      { k: "ellipse", cx: 12, cy: 20, rx: 2.5, ry: 2, c: "#e0622b", sym: true },
      { k: "rect", x: 18, y: 20, w: 4, h: 1, c: "#8a5f2c" },
    ],
  }),

  nacho: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // As wide as the frame allows. Almost no legs. Fast asleep.
      { k: "ellipse", cx: CENTRE, cy: 28, rx: 18, ry: 11, c: "#8d7f63" },
      { k: "ellipse", cx: CENTRE, cy: 31, rx: 14, ry: 7, c: "#c4b48c" },
      { k: "ellipse", cx: CENTRE, cy: 15, rx: 12, ry: 10, c: "#8d7f63" },
      { k: "ellipse", cx: CENTRE, cy: 19, rx: 9, ry: 6, c: "#a09070" },
      // Tiny ears and tiny feet on a very large animal.
      { k: "ellipse", cx: 9, cy: 8, rx: 3, ry: 2.5, c: "#7a6d54", sym: true },
      { k: "ellipse", cx: 8, cy: 37, rx: 4, ry: 2.5, c: "#7a6d54", sym: true },
      ...sleepyEyes({ x: 13, y: 14, w: 6 }),
      // Open mouth, and the nostrils above it.
      { k: "ellipse", cx: CENTRE, cy: 21, rx: 4, ry: 2.5, c: "#5e3b33" },
      { k: "px", pts: [[16, 17], [17, 17]], c: "#20140a", sym: true },
      // One snoring bubble.
      { k: "ellipse", cx: 33, cy: 7, rx: 3, ry: 2.5, c: "#dfeaf2" },
    ],
  }),

  seryi: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Smoke first, so it sits behind everything.
      { k: "ellipse", cx: 32, cy: 8, rx: 3.5, ry: 3, c: "#8d8478" },
      { k: "ellipse", cx: 35, cy: 13, rx: 2.5, ry: 2, c: "#a49b8d" },
      { k: "ellipse", cx: 31, cy: 16, rx: 2, ry: 1.5, c: "#a49b8d" },
      // A raffia skirt that never stops moving.
      { k: "poly", pts: [[8, 38], [13, 26], [26, 26], [31, 38]], c: "#c9a349" },
      { k: "line", pts: [[12, 28], [9, 38]], c: "#a8843a", w: 2, sym: true },
      { k: "line", pts: [[17, 28], [16, 38]], c: "#a8843a", w: 2, sym: true },
      // The carved mask, which is the creature itself.
      { k: "poly", pts: [[11, 8], [28, 8], [25, 27], [14, 27]], c: "#7a4a24" },
      { k: "poly", pts: [[13, 10], [26, 10], [24, 24], [15, 24]], c: "#a9723a" },
      // Mask marks: a centre ridge and rows of scoring down each cheek.
      { k: "rect", x: 18, y: 9, w: 3, h: 17, c: "#5e3517" },
      { k: "px", pts: [[15, 19], [15, 21], [15, 23], [16, 20], [16, 22]], c: "#5e3517", sym: true },
      ...eyes({ x: 16, y: 14, r: 2.6, pupil: 1.2, white: "#f7c14b" }),
      // The long pipe, held out to one side.
      { k: "line", pts: [[26, 20], [31, 15]], c: "#4a3018", w: 2 },
      { k: "ellipse", cx: 32, cy: 13, rx: 2, ry: 2, c: "#e0622b" },
      // A ring of small flames at the feet, from the dancing.
      { k: "px", pts: [[10, 36], [30, 36], [19, 39]], c: "#e0622b" },
    ],
  }),

  carsla: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // A tall, squared, immovable figure. Everything is straight lines.
      { k: "poly", pts: [[9, 38], [12, 18], [27, 18], [30, 38]], c: "#7d6a3a" },
      { k: "rect", x: 12, y: 18, w: 16, h: 3, c: "#c9a227" },
      // Folded arms across the front.
      { k: "rect", x: 11, y: 24, w: 18, h: 4, c: "#9c834a" },
      { k: "ellipse", cx: 11, cy: 26, rx: 3, ry: 2.5, c: "#8d7647", sym: true },
      // Head and the heavy gold crown.
      { k: "ellipse", cx: CENTRE, cy: 12, rx: 8, ry: 8, c: "#8d7647" },
      { k: "rect", x: 11, y: 3, w: 18, h: 4, c: "#c9a227" },
      { k: "poly", pts: [[11, 3], [14, 0], [17, 3]], c: "#e3c65a", sym: true },
      { k: "poly", pts: [[17, 3], [19.5, -1], [22, 3]], c: "#e3c65a" },
      // A stern, level stare: narrow eyes, no smile at all.
      { k: "rect", x: 13, y: 11, w: 5, h: 2, c: WHITE, sym: true },
      { k: "px", pts: [[15, 11], [15, 12]], c: OUTLINE, sym: true },
      { k: "rect", x: 17, y: 16, w: 6, h: 1, c: "#5e4a24" },
      // The mark of office on the chest.
      { k: "ellipse", cx: CENTRE, cy: 32, rx: 3.5, ry: 3.5, c: "#c9a227" },
      { k: "px", pts: [[19, 31], [19, 33], [20, 32]], c: "#5e4a24" },
    ],
  }),

  gis: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Long legs, held very straight. Nothing touches the ground it dislikes.
      { k: "line", pts: [[17, 30], [16, 39]], c: "#4a4a4a", w: 2, sym: true },
      // Body and a long neck that leans back.
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 10, ry: 7, c: "#c8ced6" },
      { k: "poly", pts: [[15, 33], [24, 33], [30, 38], [14, 37]], c: "#aeb6c0" },
      { k: "line", pts: [[19.5, 24], [19.5, 12]], c: "#c8ced6", w: 5 },
      { k: "ellipse", cx: CENTRE, cy: 11, rx: 5, ry: 5, c: "#dfe4ea" },
      // The crown of stiff golden feathers.
      { k: "line", pts: [[19.5, 6], [14, 1]], c: "#e3c65a", w: 2 },
      { k: "line", pts: [[19.5, 6], [19.5, 0]], c: "#e3c65a", w: 2 },
      { k: "line", pts: [[19.5, 6], [25, 1]], c: "#e3c65a", w: 2 },
      { k: "px", pts: [[13, 0], [19, -1], [26, 0]], c: "#f2dd8c" },
      // A red cheek patch, the way a crowned crane carries one.
      { k: "ellipse", cx: 15, cy: 13, rx: 2, ry: 1.5, c: "#c0392b" },
      // Beak, long and fine.
      { k: "poly", pts: [[24, 10], [32, 12], [24, 13]], c: "#8d7647" },
      ...eyes({ x: 17, y: 10, r: 2.2, pupil: 1 }),
      // A tail held up, well clear of the dust.
      { k: "poly", pts: [[8, 24], [1, 20], [10, 29]], c: "#aeb6c0" },
    ],
  }),

  poya: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Low, heavy and wide. The head is the biggest thing on it.
      { k: "ellipse", cx: CENTRE, cy: 29, rx: 15, ry: 9, c: "#5b4632" },
      ...legs({ x: 8, y: 34, w: 6, h: 5, c: "#48372a" }),
      { k: "ellipse", cx: CENTRE, cy: 18, rx: 12, ry: 10, c: "#6b543c" },
      { k: "ellipse", cx: CENTRE, cy: 23, rx: 7, ry: 5, c: "#8a6e4e" },
      // The horns: a short boss across the brow, then a heavy crescent that
      // sweeps out and curls down past the jaw on each side.
      { k: "rect", x: 13, y: 9, w: 14, h: 3, c: "#3a2c1e" },
      { k: "line", pts: [[13, 10], [5, 6]], c: "#3a2c1e", w: 4, sym: true },
      { k: "line", pts: [[5, 6], [1, 13]], c: "#3a2c1e", w: 4, sym: true },
      { k: "line", pts: [[1, 13], [3, 19]], c: "#2b2016", w: 3, sym: true },
      { k: "px", pts: [[4, 21], [5, 22]], c: "#d8ccb0", sym: true },
      // Small angry eyes under the horns.
      { k: "ellipse", cx: 14, cy: 16, rx: 2.4, ry: 2, c: "#e8c96a", sym: true },
      { k: "px", pts: [[14, 16]], c: OUTLINE, sym: true },
      // Nostrils, flared, with dust coming out.
      { k: "px", pts: [[17, 22], [18, 22]], c: OUTLINE, sym: true },
      { k: "ellipse", cx: 8, cy: 24, rx: 2, ry: 1.5, c: "#b3a48c", sym: true },
      { k: "rect", x: 16, y: 25, w: 8, h: 1, c: "#4a3a28" },
    ],
  }),

  // --- Wild creatures -----------------------------------------------------
  sumsu: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // A small weaver bird, and a scrap of the nest it just abandoned.
      { k: "ellipse", cx: CENTRE, cy: 23, rx: 9, ry: 8, c: "#e0c840" },
      { k: "ellipse", cx: CENTRE, cy: 26, rx: 6, ry: 5, c: "#f2e08c" },
      { k: "ellipse", cx: CENTRE, cy: 14, rx: 6, ry: 6, c: "#e0c840" },
      { k: "ellipse", cx: 10, cy: 24, rx: 4.5, ry: 5.5, c: "#b8971f", sym: true },
      { k: "line", pts: [[7, 20], [12, 29]], c: "#8a6f14", w: 1, sym: true },
      { k: "px", pts: [[6, 27], [8, 29], [10, 30]], c: "#8a6f14", sym: true },
      { k: "poly", pts: [[16, 30], [23, 30], [19.5, 37]], c: "#c9ad2c" },
      { k: "poly", pts: [[23, 14], [30, 16], [23, 18]], c: "#c0812b" },
      { k: "px", pts: [[17, 32], [22, 32]], c: "#c0812b" },
      ...eyes({ x: 16, y: 13, r: 2.4, pupil: 1.1 }),
      // A dark cap over the crown, which is how you tell one from a finch.
      { k: "ellipse", cx: CENTRE, cy: 9, rx: 5, ry: 3, c: "#6b4a1c" },
    ],
  }),

  gori: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // The tail is the first thing you see, curled up behind.
      { k: "line", pts: [[27, 30], [36, 24]], c: "#4a3a2c", w: 3 },
      { k: "line", pts: [[36, 24], [33, 14]], c: "#4a3a2c", w: 3 },
      { k: "ellipse", cx: CENTRE, cy: 27, rx: 9, ry: 8, c: "#5b4735" },
      { k: "ellipse", cx: CENTRE, cy: 29, rx: 6, ry: 5, c: "#a89070" },
      { k: "ellipse", cx: CENTRE, cy: 15, rx: 8, ry: 7, c: "#5b4735" },
      { k: "ellipse", cx: 10, cy: 14, rx: 3, ry: 3.5, c: "#4a3a2c", sym: true },
      // A pale face inside the dark fur.
      { k: "ellipse", cx: CENTRE, cy: 17, rx: 6, ry: 5, c: "#c0a785" },
      ...eyes({ x: 16, y: 15, r: 2.4, pupil: 1.1 }),
      { k: "px", pts: [[18, 18], [21, 18]], c: OUTLINE },
      { k: "rect", x: 17, y: 20, w: 6, h: 1, c: "#6b4a2c" },
      ...legs({ x: 13, y: 33, w: 4, h: 4, c: "#4a3a2c" }),
    ],
  }),

  kanku: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Coiled, wide and flat, exactly where you were about to step.
      { k: "ellipse", cx: CENTRE, cy: 30, rx: 16, ry: 8, c: "#8a7a3a" },
      { k: "ellipse", cx: CENTRE, cy: 30, rx: 10, ry: 5, c: "#a89a52" },
      { k: "ellipse", cx: CENTRE, cy: 30, rx: 5, ry: 2.5, c: "#8a7a3a" },
      // The banded markings that warn you off.
      { k: "ellipse", cx: 8, cy: 28, rx: 2.5, ry: 2, c: "#5e4a20", sym: true },
      { k: "ellipse", cx: 14, cy: 34, rx: 2.5, ry: 2, c: "#5e4a20", sym: true },
      // Head raised out of the coil, hood spread wide. The hood has to be much
      // wider than the head or the whole shape reads as a lump with a face.
      { k: "poly", pts: [[6, 21], [33, 21], [26, 6], [13, 6]], c: "#9a8a45" },
      { k: "poly", pts: [[10, 20], [29, 20], [24, 9], [15, 9]], c: "#b3a45c" },
      // The pale mark every hood carries, which is the warning.
      { k: "ellipse", cx: CENTRE, cy: 15, rx: 4, ry: 3, c: "#5e4a20" },
      { k: "ellipse", cx: CENTRE, cy: 15, rx: 2, ry: 1.5, c: "#d8c98a" },
      { k: "ellipse", cx: CENTRE, cy: 9, rx: 5, ry: 4, c: "#c0b06a" },
      ...eyes({ x: 16, y: 8, r: 2.2, pupil: 1, white: "#e8c96a" }),
      // Forked tongue, flicked out below the head.
      { k: "line", pts: [[19.5, 12], [19.5, 17]], c: "#c0392b", w: 1 },
      { k: "px", pts: [[18, 18], [21, 18]], c: "#c0392b" },
    ],
  }),

  krabo: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Legs down each side, then the shell over them.
      { k: "line", pts: [[13, 27], [4, 32]], c: "#a03a24", w: 2, sym: true },
      { k: "line", pts: [[13, 30], [5, 37]], c: "#a03a24", w: 2, sym: true },
      { k: "line", pts: [[15, 32], [12, 39]], c: "#a03a24", w: 2, sym: true },
      // Two big claws held up, which is most of the creature.
      { k: "ellipse", cx: 7, cy: 16, rx: 6, ry: 5, c: "#c04a2c", sym: true },
      { k: "poly", pts: [[2, 13], [10, 15], [2, 18]], c: "#e0603a", sym: true },
      { k: "line", pts: [[12, 20], [9, 18]], c: "#a03a24", w: 3, sym: true },
      // Shell.
      { k: "ellipse", cx: CENTRE, cy: 26, rx: 12, ry: 9, c: "#c04a2c" },
      { k: "ellipse", cx: CENTRE, cy: 28, rx: 8, ry: 5, c: "#e0603a" },
      { k: "px", pts: [[13, 23], [26, 23], [15, 31], [24, 31]], c: "#8a2f1c" },
      // Eyes on stalks.
      { k: "line", pts: [[16, 20], [15, 15]], c: "#c04a2c", w: 2, sym: true },
      ...eyes({ x: 15, y: 14, r: 2.2, pupil: 1 }),
    ],
  }),

  dungu: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Half rolled up, so the scales face out.
      { k: "ellipse", cx: CENTRE, cy: 25, rx: 15, ry: 13, c: "#8a7248" },
      // Rows of overlapping plates.
      { k: "ellipse", cx: 12, cy: 16, rx: 5, ry: 3.5, c: "#a68b57", sym: true },
      { k: "ellipse", cx: 9, cy: 24, rx: 5, ry: 3.5, c: "#a68b57", sym: true },
      { k: "ellipse", cx: 13, cy: 31, rx: 5, ry: 3.5, c: "#a68b57", sym: true },
      { k: "ellipse", cx: CENTRE, cy: 20, rx: 5, ry: 3.5, c: "#c0a066" },
      { k: "ellipse", cx: CENTRE, cy: 28, rx: 5, ry: 3.5, c: "#c0a066" },
      // The head poking out of the ball.
      { k: "ellipse", cx: 30, cy: 32, rx: 6, ry: 5, c: "#6f5c3a" },
      { k: "poly", pts: [[33, 30], [39, 33], [33, 35]], c: "#6f5c3a" },
      { k: "ellipse", cx: 29, cy: 31, rx: 1.6, ry: 1.6, c: WHITE },
      { k: "px", pts: [[29, 31]], c: OUTLINE },
      // Claws.
      { k: "px", pts: [[7, 37], [9, 38], [11, 37]], c: "#e0d6b8" },
    ],
  }),

  tsetse: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // Wings behind, held flat over the back the way a tsetse does.
      { k: "ellipse", cx: 10, cy: 22, rx: 9, ry: 5, c: "#b9c4c8", sym: true },
      { k: "line", pts: [[3, 22], [18, 22]], c: "#8d989c", sym: true },
      // Body in three parts.
      { k: "ellipse", cx: CENTRE, cy: 28, rx: 6, ry: 8, c: "#6b5a3a" },
      { k: "ellipse", cx: CENTRE, cy: 20, rx: 5, ry: 4, c: "#7d6a45" },
      { k: "ellipse", cx: CENTRE, cy: 13, rx: 6, ry: 5, c: "#6b5a3a" },
      // Banded abdomen.
      { k: "rect", x: 14, y: 26, w: 11, h: 1, c: "#4a3d26" },
      { k: "rect", x: 15, y: 30, w: 9, h: 1, c: "#4a3d26" },
      // The long proboscis pointing straight forward.
      { k: "line", pts: [[19.5, 17], [19.5, 8]], c: "#3a2c1e", w: 1 },
      // Big compound eyes, the reddest thing on it.
      { k: "ellipse", cx: 15, cy: 12, rx: 3, ry: 3, c: "#a03a24", sym: true },
      { k: "px", pts: [[14, 11]], c: SHINE, sym: true },
      { k: "line", pts: [[17, 32], [13, 38]], c: "#4a3d26", w: 1, sym: true },
    ],
  }),

  sasabon: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // A shape in the canopy with its legs hanging down. Almost no detail,
      // because nobody who has seen one agrees on any.
      { k: "ellipse", cx: CENTRE, cy: 16, rx: 13, ry: 12, c: "#3b3350" },
      { k: "poly", pts: [[9, 24], [30, 24], [26, 39], [13, 39]], c: "#332c46" },
      // Long thin legs hanging, which is the part people remember.
      { k: "line", pts: [[15, 30], [13, 39]], c: "#241e33", w: 3, sym: true },
      // Ragged edge along the bottom, so it never looks solid.
      { k: "px", pts: [[13, 38], [16, 39], [20, 38], [24, 39], [27, 38]], c: "#241e33" },
      // A crown of twisted horns.
      { k: "poly", pts: [[10, 8], [6, 0], [14, 5]], c: "#241e33", sym: true },
      // Only the eyes and the teeth are bright.
      { k: "ellipse", cx: 14, cy: 15, rx: 3.4, ry: 3, c: "#f2dd8c", sym: true },
      { k: "px", pts: [[14, 15], [15, 15]], c: OUTLINE, sym: true },
      { k: "rect", x: 15, y: 21, w: 10, h: 2, c: "#f2dd8c" },
      { k: "px", pts: [[17, 21], [20, 21], [23, 21]], c: "#3b3350" },
    ],
  }),

  siko: () => ({
    w: SPRITE_SIZE,
    h: SPRITE_SIZE,
    outline: OUTLINE,
    shapes: [
      // A lump of river gold, all facets, no curves.
      { k: "poly", pts: [[8, 30], [12, 14], [27, 14], [32, 30], [20, 36]], c: "#c9a227" },
      { k: "poly", pts: [[12, 14], [19.5, 20], [27, 14]], c: "#f2dd8c" },
      { k: "poly", pts: [[8, 30], [19.5, 20], [19.5, 36]], c: "#9c7a14" },
      { k: "poly", pts: [[19.5, 20], [32, 30], [19.5, 36]], c: "#d6b23c" },
      // The edges between the facets. Without these the whole thing flattens
      // into one yellow lump and stops reading as metal.
      { k: "line", pts: [[12, 14], [19.5, 20]], c: "#7d600e", w: 1, sym: true },
      { k: "line", pts: [[8, 30], [19.5, 20]], c: "#7d600e", w: 1, sym: true },
      { k: "line", pts: [[19.5, 20], [19.5, 36]], c: "#7d600e", w: 1 },
      // Short heavy legs.
      ...legs({ x: 12, y: 33, w: 5, h: 5, c: "#8d7014" }),
      // Eyes set into the metal, and a bright glint.
      { k: "ellipse", cx: 15, cy: 22, rx: 2.4, ry: 2.4, c: "#3a2c1e", sym: true },
      { k: "px", pts: [[14, 21]], c: SHINE, sym: true },
      { k: "px", pts: [[25, 17], [26, 16], [27, 17], [26, 18]], c: "#fff6c8" },
      // Flecks of the river it came out of.
      { k: "px", pts: [[11, 27], [29, 24]], c: "#6b5a2c" },
    ],
  }),
};

/** Every species this module can draw. */
export const CREATURE_ART_IDS = Object.keys(CREATURE_ART);

/**
 * The drawing for one species.
 * @returns {object|null} null when the species has no art yet
 */
export function creatureDrawing(speciesId) {
  const build = CREATURE_ART[speciesId];
  return build ? build() : null;
}
