import { describe, expect, test } from "bun:test";
import { MAX_STRUCTURE_SHARE, planStructures, structureOf, zoneAt } from "./blueprint.js";
import { mulberry32 } from "./random.js";

const vocabulary = {
  structures: [
    { id: "cottage", label: "Cottage", wall: "cottage-wall", floor: "cottage-floor", door: "cottage-door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 3 },
    { id: "vault", label: "Vault", wall: "stone-wall", floor: "vault-floor", door: null, minSize: 3, maxSize: 3, minCount: 1, maxCount: 1 },
  ],
};

const cellsOf = (room) => {
  const cells = [];
  for (let y = room.y; y < room.y + room.height; y += 1) for (let x = room.x; x < room.x + room.width; x += 1) cells.push(`${x},${y}`);
  return cells;
};

describe("planStructures", () => {
  test("a world without structures has an empty plan, and every cell is outside", () => {
    const plan = planStructures({ vocabulary: { structures: [] }, width: 8, height: 8, random: mulberry32(1) });
    expect(plan.rooms).toEqual([]);
    expect(zoneAt(plan, 3, 3)).toEqual({ part: "outside" });
    expect(zoneAt(null, 3, 3)).toEqual({ part: "outside" });
  });

  test("places each structure inside its count and size limits, inside the grid, with a gap between rooms", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const plan = planStructures({ vocabulary, width: 16, height: 16, random: mulberry32(seed) });
      const cottages = plan.rooms.filter((one) => one.structure === "cottage");
      expect(cottages.length).toBeGreaterThanOrEqual(1);
      expect(cottages.length).toBeLessThanOrEqual(3);
      expect(plan.rooms.filter((one) => one.structure === "vault").length).toBe(1);
      const taken = new Set();
      for (const room of plan.rooms) {
        expect(room.width).toBeGreaterThanOrEqual(3);
        expect(room.height).toBeLessThanOrEqual(4);
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.y).toBeGreaterThanOrEqual(0);
        expect(room.x + room.width).toBeLessThanOrEqual(16);
        expect(room.y + room.height).toBeLessThanOrEqual(16);
        for (const key of cellsOf(room)) {
          expect(taken.has(key)).toBe(false);
          taken.add(key);
        }
      }
      // A gap of one cell: no two rooms touch, even at a corner.
      for (const room of plan.rooms) {
        for (const other of plan.rooms) {
          if (room === other) continue;
          const touch = room.x <= other.x + other.width && room.x + room.width >= other.x && room.y <= other.y + other.height && room.y + room.height >= other.y;
          expect(touch).toBe(false);
        }
      }
    }
  });

  test("the same seed gives the same plan", () => {
    const a = planStructures({ vocabulary, width: 12, height: 12, random: mulberry32(7) });
    const b = planStructures({ vocabulary, width: 12, height: 12, random: mulberry32(7) });
    expect(a).toEqual(b);
  });

  test("a door sits in a wall that is not a corner and not on the map edge; a sealed structure has none", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const plan = planStructures({ vocabulary, width: 10, height: 10, random: mulberry32(seed) });
      for (const room of plan.rooms) {
        if (room.structure === "vault") {
          expect(room.door).toBeNull();
          continue;
        }
        expect(room.door).not.toBeNull();
        const { x, y } = room.door;
        expect(zoneAt(plan, x, y).part).toBe("door");
        const onVertical = x === room.x || x === room.x + room.width - 1;
        const onHorizontal = y === room.y || y === room.y + room.height - 1;
        expect(onVertical !== onHorizontal).toBe(true); // a side, not a corner
        expect(x > 0 && y > 0 && x < 9 && y < 9).toBe(true);
      }
    }
  });

  test("structures never take more than half the map, and a small grid gets fewer rooms rather than an error", () => {
    const small = planStructures({ vocabulary, width: 4, height: 4, random: mulberry32(3) });
    const area = small.rooms.reduce((sum, room) => sum + room.width * room.height, 0);
    expect(area).toBeLessThanOrEqual(16 * MAX_STRUCTURE_SHARE);
    expect(small.rooms.length).toBeLessThanOrEqual(1);
    const tiny = planStructures({ vocabulary, width: 2, height: 2, random: mulberry32(3) });
    expect(tiny.rooms).toEqual([]);
  });
});

describe("zoneAt and structureOf", () => {
  const plan = { rooms: [{ structure: "cottage", label: "Cottage", x: 2, y: 1, width: 4, height: 3, door: { x: 3, y: 3 } }] };

  test("tells a wall, the door, the interior and the outside apart", () => {
    expect(zoneAt(plan, 2, 1)).toEqual({ part: "wall", structure: "cottage", label: "Cottage", room: 0 });
    expect(zoneAt(plan, 5, 3).part).toBe("wall");
    expect(zoneAt(plan, 3, 3).part).toBe("door");
    expect(zoneAt(plan, 3, 2).part).toBe("interior");
    expect(zoneAt(plan, 4, 2).part).toBe("interior");
    expect(zoneAt(plan, 1, 1)).toEqual({ part: "outside" });
    expect(zoneAt(plan, 6, 2)).toEqual({ part: "outside" });
  });

  test("structureOf finds the declaration behind a zone", () => {
    expect(structureOf(vocabulary, zoneAt(plan, 2, 1))?.wall).toBe("cottage-wall");
    expect(structureOf(vocabulary, zoneAt(plan, 0, 0))).toBeNull();
  });
});
