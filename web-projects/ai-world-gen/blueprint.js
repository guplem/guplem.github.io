// The blueprint: where each structure stands, before any cell is decided.
//
// Six versions of the generator proved one thing (README, "Versions so
// far"): a model that decides one cell from its neighbours cannot draw a
// rectangle. It closes lines into solid blocks, puts doors in fields, and
// never knows where a room ends. A person drawing a map decides where the
// buildings go first and fills them in after. This file is that first step.
//
// The vocabulary declares its structures (a cottage: cottage-wall around
// cottage-floor with one cottage-door; ADR 0002). `planStructures` places
// each one as a rectangle, with a random size and count inside the declared
// limits, a gap between rectangles, and one door in a wall that faces the
// middle of the map. `zoneAt` then tells any cell what part it is: a wall,
// the door, the interior of a named structure, or outside every one.
//
// The model still decides every cell (a wall cell can be a window, an
// interior cell a chest, the outside anything outdoors); the blueprint only
// narrows the question to the part the cell plays. It is pure and seeded, so
// a test case draws the same plan every time.

/** How much of the map the structures may take together, walls included. */
export const MAX_STRUCTURE_SHARE = 0.5;

/** How many random rectangles are tried for one room before it is given up. */
const PLACEMENT_ATTEMPTS = 40;

const SIDES = ["north", "east", "south", "west"];

function between(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Whether two rectangles overlap once `gap` empty cells are kept around the first. */
function overlaps(a, b, gap) {
  return a.x - gap < b.x + b.width && a.x + a.width + gap > b.x && a.y - gap < b.y + b.height && a.y + a.height + gap > b.y;
}

/**
 * The door of a room: a wall cell that is not a corner, on a side that does
 * not touch the map edge, on the side nearest the middle of the map. Null
 * when no side qualifies or the structure is sealed.
 */
function chooseDoor(room, structure, width, height, random) {
  if (structure.door === null) return null;
  const centre = { x: (width - 1) / 2, y: (height - 1) / 2 };
  const sides = [
    { name: "north", open: room.y > 0, distance: Math.abs(room.y - centre.y), cells: () => range(room.x + 1, room.x + room.width - 2).map((x) => ({ x, y: room.y })) },
    { name: "south", open: room.y + room.height < height, distance: Math.abs(room.y + room.height - 1 - centre.y), cells: () => range(room.x + 1, room.x + room.width - 2).map((x) => ({ x, y: room.y + room.height - 1 })) },
    { name: "west", open: room.x > 0, distance: Math.abs(room.x - centre.x), cells: () => range(room.y + 1, room.y + room.height - 2).map((y) => ({ x: room.x, y })) },
    { name: "east", open: room.x + room.width < width, distance: Math.abs(room.x + room.width - 1 - centre.x), cells: () => range(room.y + 1, room.y + room.height - 2).map((y) => ({ x: room.x + room.width - 1, y })) },
  ]
    .filter((side) => side.open)
    .sort((a, b) => a.distance - b.distance || SIDES.indexOf(a.name) - SIDES.indexOf(b.name));
  for (const side of sides) {
    const cells = side.cells();
    if (cells.length > 0) return cells[Math.floor(random() * cells.length)];
  }
  return null;
}

function range(from, to) {
  const values = [];
  for (let value = from; value <= to; value += 1) values.push(value);
  return values;
}

/**
 * Where every structure of the vocabulary stands on a grid of this size.
 *
 * @param {object} options
 * @param {{structures?: object[]}} options.vocabulary
 * @param {number} options.width
 * @param {number} options.height
 * @param {() => number} options.random a seeded generator, so the plan repeats
 * @returns {{rooms: Array<{structure: string, label: string, x: number, y: number, width: number, height: number, door: {x: number, y: number} | null}>}}
 */
export function planStructures({ vocabulary, width, height, random }) {
  const rooms = [];
  let used = 0;
  const budget = Math.floor(width * height * MAX_STRUCTURE_SHARE);
  for (const structure of vocabulary?.structures ?? []) {
    const count = between(random, structure.minCount, structure.maxCount);
    for (let index = 0; index < count; index += 1) {
      let placed = false;
      for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS && !placed; attempt += 1) {
        const roomWidth = between(random, structure.minSize, structure.maxSize);
        const roomHeight = between(random, structure.minSize, structure.maxSize);
        if (roomWidth > width || roomHeight > height || used + roomWidth * roomHeight > budget) continue;
        const room = {
          structure: structure.id,
          label: structure.label,
          x: between(random, 0, width - roomWidth),
          y: between(random, 0, height - roomHeight),
          width: roomWidth,
          height: roomHeight,
          door: null,
        };
        if (rooms.some((other) => overlaps(room, other, 1))) continue;
        room.door = chooseDoor(room, structure, width, height, random);
        rooms.push(room);
        used += roomWidth * roomHeight;
        placed = true;
      }
    }
  }
  return { rooms };
}

/**
 * The part a cell plays in the plan.
 * @returns {{part: "outside"} | {part: "wall" | "door" | "interior", structure: string, label: string, room: number}}
 */
export function zoneAt(plan, x, y) {
  const rooms = plan?.rooms ?? [];
  for (let index = 0; index < rooms.length; index += 1) {
    const room = rooms[index];
    if (x < room.x || y < room.y || x >= room.x + room.width || y >= room.y + room.height) continue;
    const onBorder = x === room.x || y === room.y || x === room.x + room.width - 1 || y === room.y + room.height - 1;
    const part = !onBorder ? "interior" : room.door && room.door.x === x && room.door.y === y ? "door" : "wall";
    return { part, structure: room.structure, label: room.label, room: index };
  }
  return { part: "outside" };
}

/** The structure a zone belongs to, or null outside. */
export function structureOf(vocabulary, zone) {
  if (!zone || zone.part === "outside") return null;
  return (vocabulary?.structures ?? []).find((one) => one.id === zone.structure) ?? null;
}
