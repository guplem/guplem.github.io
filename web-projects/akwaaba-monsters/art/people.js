// The people who walk around the map.
//
// One builder makes every character, so a new villager is a handful of colours
// rather than a new drawing. The builder takes a style and gives back a
// drawing for each of the four directions and each of the two walking frames.
//
// A person is 16 wide and 20 tall, with the feet on the bottom row. The map is
// drawn in 16 by 16 tiles, so the renderer lifts a person four pixels: the head
// sits into the tile above, which is what stops everyone looking squat.
//
// About skin: the player is a visitor and is the only light-skinned person in
// the region. Everybody else is Ghanaian. That is the setting, and it is what
// makes the children shouting "obroni" mean anything. See ROADMAP.md.

/** Every person is drawn on this grid. */
export const PERSON_W = 16;
export const PERSON_H = 20;

/** How far up the renderer lifts a person, so the head overlaps the tile above. */
export const PERSON_LIFT = 4;

/** The one dark contour colour the whole game shares. */
export const OUTLINE = "#20140a";

/** The four directions, and the two frames of a walk. */
export const DIRECTIONS = ["down", "up", "left", "right"];
export const FRAMES = [0, 1];

/** Skin tones. `visitor` is the player, and nobody else uses it. */
export const SKIN = {
  visitor: "#e8b98c",
  deep: "#4a2f1e",
  warm: "#5e3b22",
  rich: "#3d2617",
};

const shade = (c, amount) => {
  const value = parseInt(c.slice(1), 16);
  const clamp = (n) => Math.max(0, Math.min(255, n + amount));
  const r = clamp((value >> 16) & 255);
  const g = clamp((value >> 8) & 255);
  const b = clamp(value & 255);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
};

/** The legs, which are the only part the walking frame changes. */
function legShapes(style, frame, top) {
  const trousers = style.trousers;
  const boot = style.boot ?? shade(trousers, -30);
  if (frame === 0) {
    return [
      { k: "rect", x: 5, y: top, w: 2, h: 4, c: trousers, sym: true },
      { k: "rect", x: 5, y: top + 4, w: 2, h: 1, c: boot, sym: true },
    ];
  }
  // One leg forward, one back. Small at this size, but it reads as a stride.
  return [
    { k: "rect", x: 4, y: top, w: 2, h: 4, c: trousers },
    { k: "rect", x: 4, y: top + 4, w: 3, h: 1, c: boot },
    { k: "rect", x: 9, y: top, w: 2, h: 3, c: trousers },
    { k: "rect", x: 9, y: top + 3, w: 3, h: 1, c: boot },
  ];
}

/**
 * Whatever the character wears on the head.
 *
 * Every style has to stop at the hairline, which is `headY + 1`. Anything that
 * reaches lower covers the eyes, and then all four directions look the same and
 * nobody can tell which way a person is facing. Walking away is the one case
 * that covers the whole skull, because from behind there is no face to show.
 */
function hairShapes(style, dir) {
  const { hair, hairStyle = "short", headY } = style;
  const back = dir === "up";
  const shapes = [];
  const crownY = headY - 2.5;

  if (hairStyle === "wrap") {
    // A head wrap: a band of cloth, tied at one side. It changes the outline,
    // so it reads from a distance even at this size.
    const cloth = style.wrap ?? "#c9a227";
    shapes.push({ k: "ellipse", cx: 7.5, cy: back ? headY - 1 : crownY, rx: 5.2, ry: back ? 4.5 : 3.4, c: cloth });
    shapes.push({ k: "rect", x: 2, y: headY - 2, w: 12, h: 2, c: shade(cloth, -28) });
    shapes.push({ k: "poly", pts: [[12, headY - 5], [15, headY - 7], [14, headY - 2]], c: cloth });
  } else if (hairStyle === "locks") {
    shapes.push({ k: "ellipse", cx: 7.5, cy: back ? headY - 1 : crownY, rx: 5.2, ry: back ? 4.6 : 3.4, c: hair });
    // The locks hang down the sides, clear of the face.
    for (const x of [0, 2, 12, 14]) shapes.push({ k: "rect", x, y: headY - 2, w: 2, h: 8, c: hair });
    shapes.push({ k: "px", pts: [[0, headY + 6], [13, headY + 6]], c: "#e0622b" });
  } else if (hairStyle === "afro") {
    shapes.push({ k: "ellipse", cx: 7.5, cy: back ? headY - 1 : crownY - 0.5, rx: 6.5, ry: back ? 5 : 4, c: hair });
  } else if (hairStyle === "cap") {
    const cap = style.cap ?? hair;
    shapes.push({ k: "ellipse", cx: 7.5, cy: back ? headY - 1 : crownY, rx: 5.2, ry: back ? 4.5 : 3.4, c: cap });
    if (!back) shapes.push({ k: "rect", x: 1, y: headY, w: 13, h: 1, c: shade(cap, -35) });
  } else if (hairStyle === "straw") {
    const straw = style.cap ?? "#d8b96a";
    shapes.push({ k: "ellipse", cx: 7.5, cy: crownY - 1, rx: 4, ry: 2.6, c: shade(straw, 16) });
    shapes.push({ k: "ellipse", cx: 7.5, cy: headY - 1, rx: 7.5, ry: 2, c: straw });
  } else if (hairStyle === "crown") {
    shapes.push({ k: "ellipse", cx: 7.5, cy: back ? headY - 1 : crownY, rx: 5.2, ry: back ? 4.5 : 3.4, c: hair });
    shapes.push({ k: "rect", x: 2, y: headY - 6, w: 12, h: 2, c: "#c9a227" });
    shapes.push({ k: "px", pts: [[2, headY - 7], [7, headY - 8], [8, headY - 8], [13, headY - 7]], c: "#f2dd8c" });
  } else if (hairStyle === "bald") {
    // Nothing on top at all.
  } else {
    shapes.push({ k: "ellipse", cx: 7.5, cy: back ? headY - 1 : crownY, rx: 5.2, ry: back ? 4.6 : 3.2, c: hair });
  }
  return shapes;
}

/** The face, which only shows when the person is not walking away. */
function faceShapes(style, dir) {
  const { headY, skin } = style;
  if (dir === "up") return [];
  const eye = OUTLINE;
  const eyeY = headY + 1;
  if (dir === "down") {
    return [
      { k: "px", pts: [[5, eyeY], [5, eyeY + 1]], c: eye, sym: true },
      { k: "px", pts: [[7, eyeY + 3], [8, eyeY + 3]], c: shade(skin, -40) },
    ];
  }
  // In profile only one eye shows, and it sits well forward on the face.
  return [
    { k: "px", pts: [[4, eyeY], [4, eyeY + 1]], c: eye },
    { k: "px", pts: [[3, eyeY + 3], [4, eyeY + 3]], c: shade(skin, -40) },
  ];
}

/** The arms, which hang at the sides facing forward and tuck in from the side. */
function armShapes(style, dir, top) {
  const sleeve = style.shirt;
  const { skin } = style;
  if (dir === "left" || dir === "right") {
    return [
      { k: "rect", x: 6, y: top, w: 3, h: 2, c: sleeve },
      { k: "rect", x: 6, y: top + 2, w: 3, h: 1, c: skin },
    ];
  }
  return [
    { k: "rect", x: 1, y: top, w: 2, h: 2, c: sleeve, sym: true },
    { k: "rect", x: 1, y: top + 2, w: 2, h: 1, c: skin, sym: true },
  ];
}

/**
 * Build every drawing for one character.
 *
 * @param {object} style
 * @param {string} style.skin one of SKIN
 * @param {string} style.hair
 * @param {string} [style.hairStyle] short | afro | locks | wrap | cap | straw | crown | bald
 * @param {string} style.shirt
 * @param {string} style.trousers
 * @param {string} [style.wrap] the cloth colour for the "wrap" head style
 * @param {string} [style.cap] the cap or hat colour
 * @param {boolean} [style.small] a child: shorter, with a bigger head
 * @param {Array} [style.extras] shapes drawn last, such as a pot or a sash
 * @param {Array} [style.chest] shapes drawn on the body, such as a kente sash
 * @returns {{[dir: string]: object[]}} a drawing per direction, per frame
 */
export function buildPerson(style) {
  const small = Boolean(style.small);
  // A bigger head sitting lower down leaves rows for eyes and a mouth under
  // the hairline. Get this wrong and every character turns into a blob.
  const headY = small ? 8 : 7;
  const headR = small ? 4.4 : 5;
  const bodyTop = small ? 13 : 12;
  // A child keeps the same feet line as an adult but a shorter torso and a
  // lower head, so it reads as small rather than as a cropped grown-up.
  const legTop = 15;
  const filled = { ...style, headY, skin: style.skin };

  const forDirection = (dir, frame) => {
    const flip = dir === "right";
    const shapes = [
      ...legShapes(filled, frame, legTop),
      // Body.
      {
        k: "rect",
        x: small ? 4 : 3,
        y: bodyTop,
        w: small ? 8 : 10,
        h: legTop - bodyTop,
        c: filled.shirt,
      },
      ...(filled.chest ?? []),
      ...armShapes(filled, dir, bodyTop + 1),
      // Head, then whatever is on it, then the face on top of both.
      { k: "ellipse", cx: 7.5, cy: headY, rx: headR, ry: headR, c: filled.skin },
      ...hairShapes(filled, dir),
      ...faceShapes(filled, dir),
      ...(filled.extras ?? []),
    ];
    return {
      w: PERSON_W,
      h: PERSON_H,
      outline: OUTLINE,
      shade: { light: 18, dark: 20 },
      // "right" is "left" read the other way round, so it needs no drawing of
      // its own. That halves the work for every character in the game.
      shapes: flip ? mirrorAll(shapes) : shapes,
    };
  };

  const out = {};
  for (const dir of DIRECTIONS) out[dir] = FRAMES.map((frame) => forDirection(dir, frame));
  return out;
}

/** Flip a whole list of shapes, so "right" is "left" the other way round. */
function mirrorAll(shapes) {
  const flipX = (x) => PERSON_W - 1 - x;
  return shapes.map((shape) => {
    const copy = { ...shape };
    if (copy.sym) return copy; // a symmetric shape looks the same either way
    if (copy.cx !== undefined) copy.cx = flipX(copy.cx);
    if (copy.k === "rect") copy.x = flipX(copy.x + copy.w - 1);
    else if (copy.x !== undefined) copy.x = flipX(copy.x);
    if (copy.pts) copy.pts = copy.pts.map(([x, y]) => [flipX(x), y]);
    return copy;
  });
}

/**
 * Everyone in the first area.
 *
 * A later agent adds a villager by adding one entry here, then naming it as an
 * NPC's `sprite` in the area file.
 */
export const PEOPLE = {
  playerBoy: {
    skin: SKIN.visitor,
    hair: "#3a2415",
    hairStyle: "cap",
    cap: "#c0392b",
    shirt: "#2f7fc4",
    trousers: "#3a4a5e",
  },
  playerGirl: {
    skin: SKIN.visitor,
    hair: "#3a2415",
    hairStyle: "short",
    shirt: "#c0392b",
    trousers: "#3a4a5e",
  },
  professor: {
    skin: SKIN.deep,
    hair: "#1c1008",
    hairStyle: "wrap",
    wrap: "#3f7a8e",
    shirt: "#f0e6d2",
    trousers: "#6a6055",
    chest: [{ k: "rect", x: 7, y: 12, w: 2, h: 3, c: "#d8d0bc" }],
  },
  villagerMan: {
    skin: SKIN.warm,
    hair: "#1c1008",
    hairStyle: "short",
    shirt: "#3f8e6a",
    trousers: "#4a4034",
    chest: [{ k: "px", pts: [[4, 13], [8, 14], [11, 13]], c: "#e3c65a" }],
  },
  villagerWoman: {
    skin: SKIN.deep,
    hair: "#1c1008",
    hairStyle: "wrap",
    wrap: "#c04a2c",
    shirt: "#c9a227",
    trousers: "#a8541f",
    chest: [{ k: "rect", x: 3, y: 14, w: 10, h: 1, c: "#8a3a20" }],
  },
  child: {
    skin: SKIN.rich,
    hair: "#1c1008",
    hairStyle: "short",
    shirt: "#e3b23a",
    trousers: "#4a6a3a",
    small: true,
  },
  mamaSopa: {
    skin: SKIN.deep,
    hair: "#1c1008",
    hairStyle: "wrap",
    wrap: "#8a4fa8",
    shirt: "#7a3f8e",
    trousers: "#4a2f5e",
    chest: [{ k: "rect", x: 4, y: 13, w: 8, h: 2, c: "#e0d6c0" }],
    // She carries the pot everywhere, which is how you know her from a distance.
    extras: [
      { k: "ellipse", cx: 13, cy: 4, rx: 3.5, ry: 3, c: "#5e3b33" },
      { k: "ellipse", cx: 13, cy: 2, rx: 3, ry: 1.4, c: "#8a5f4a" },
      { k: "px", pts: [[12, 0], [14, -1]], c: "#c8c0b0" },
    ],
  },
  grunt: {
    skin: SKIN.warm,
    hair: "#1c1008",
    hairStyle: "cap",
    cap: "#3a4a2e",
    shirt: "#5e6a3a",
    trousers: "#3f3a2c",
    boot: "#2a2620",
    chest: [{ k: "rect", x: 3, y: 14, w: 10, h: 1, c: "#7d6244" }],
  },
  boss: {
    skin: SKIN.deep,
    hair: "#1c1008",
    hairStyle: "cap",
    cap: "#c9a227",
    shirt: "#3a3a3a",
    trousers: "#2a2a2a",
    chest: [
      { k: "rect", x: 5, y: 13, w: 6, h: 1, c: "#c9a227" },
      { k: "px", pts: [[7, 14], [8, 14]], c: "#f2dd8c" },
    ],
  },
  gymLeader: {
    skin: SKIN.warm,
    hair: "#1c1008",
    hairStyle: "crown",
    shirt: "#1f5c4a",
    trousers: "#7d5a30",
    // A kente sash across the chest: gold, green and red stripes.
    chest: [
      { k: "rect", x: 3, y: 12, w: 10, h: 1, c: "#c9a227" },
      { k: "rect", x: 3, y: 13, w: 10, h: 1, c: "#c0392b" },
      { k: "rect", x: 3, y: 14, w: 10, h: 1, c: "#c9a227" },
    ],
  },
  nurse: {
    skin: SKIN.deep,
    hair: "#1c1008",
    hairStyle: "wrap",
    wrap: "#f0e6d2",
    shirt: "#f0e6d2",
    trousers: "#3f8e6a",
    chest: [{ k: "px", pts: [[7, 13], [8, 13], [7, 14], [8, 14]], c: "#c0392b" }],
  },
  shopkeeper: {
    skin: SKIN.warm,
    hair: "#1c1008",
    hairStyle: "short",
    shirt: "#2f7fc4",
    trousers: "#3a4a5e",
    chest: [{ k: "rect", x: 4, y: 13, w: 8, h: 2, c: "#e0d6c0" }],
  },
  fisherman: {
    skin: SKIN.rich,
    hair: "#1c1008",
    hairStyle: "straw",
    shirt: "#4a7a8e",
    trousers: "#5e5242",
  },
  elder: {
    skin: SKIN.deep,
    hair: "#d8d0c4",
    hairStyle: "afro",
    shirt: "#7a4a8e",
    trousers: "#4a3a5e",
    extras: [
      // A walking stick, and the white beard that goes with the white hair.
      { k: "rect", x: 13, y: 9, w: 1, h: 10, c: "#7d5a30" },
      { k: "px", pts: [[5, 11], [6, 12], [7, 12], [8, 12], [9, 11]], c: "#d8d0c4" },
    ],
  },
};

/** Every character this module can draw. */
export const PEOPLE_IDS = Object.keys(PEOPLE);

const cache = new Map();

/**
 * The drawing for one character, facing one way, on one walking frame.
 * @returns {object|null} null when the character has no art
 */
export function personDrawing(id, dir = "down", frame = 0) {
  if (!PEOPLE[id]) return null;
  if (!cache.has(id)) cache.set(id, buildPerson(PEOPLE[id]));
  const byDirection = cache.get(id);
  const list = byDirection[dir] ?? byDirection.down;
  return list[frame % list.length];
}
