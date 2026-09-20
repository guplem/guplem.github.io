import { describe, expect, test } from "bun:test";
import {
  CHAT_DECISION_SCHEMA,
  MAX_CONTINUED_LINE,
  NEARBY_RADIUS,
  SAMPLE_FLOOR,
  TARGET_SHARES,
  allowedTypes,
  balanceSheet,
  buildCellDecision,
  buildChatDecisionMessages,
  chooseType,
  continuationHints,
  describeZone,
  zoneAllowedTypes,
  fallbackType,
  isRouteType,
  mapSketch,
  readChatDecision,
  readDecisionAnswer,
  targetShare,
} from "./cellDecision.js";
import { createGrid, setCell } from "./grid.js";
import { mulberry32 } from "./random.js";

const open = { zone: "any", neverNext: [], onlyNext: [], edge: null };
const vocabulary = {
  name: "Ashford",
  summary: "A village.",
  elements: [
    { id: "grass", label: "Grass", description: "Open grass.", placementRules: "Most common, outdoors.", walkable: true, interactable: false, isBarrier: false, visualTag: "grass", instanceFields: [], placement: open },
    { id: "wall", label: "Wall", description: "A stone wall.", placementRules: "Around houses.", walkable: false, interactable: false, isBarrier: true, visualTag: "stone-wall", instanceFields: [], placement: open },
    { id: "door", label: "Door", description: "A door.", placementRules: "In a wall.", walkable: true, interactable: true, isBarrier: false, visualTag: "door", instanceFields: ["locked"], placement: open },
  ],
  structures: [],
};
const setting = { location: "A village", era: "1200", notes: "cosy" };

function sampleGrid() {
  const grid = createGrid(5, 5);
  setCell(grid, 2, 1, { typeId: "wall" });
  setCell(grid, 1, 2, { typeId: "grass" });
  setCell(grid, 0, 0, { typeId: "door" });
  return grid;
}

describe("buildCellDecision", () => {
  test("asks one choice question whose options are the type ids, each described with its rules", () => {
    const { questions } = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 2, y: 2 });
    expect(Object.keys(questions)).toEqual(["type"]);
    expect(questions.type.type).toBe("choice");
    expect(Object.keys(questions.type.criteria)).toEqual(["grass", "wall", "door"]);
    expect(questions.type.criteria.wall).toContain("A stone wall.");
    expect(questions.type.criteria.wall).toContain("Around houses.");
    expect(questions.type.instructions.length).toBeGreaterThan(20);
  });

  test("the state carries the world, the cell, its placed neighbours and the counts, not the whole grid", () => {
    const { state } = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 2, y: 2 });
    expect(state.world.name).toBe("Ashford");
    expect(state.world.setting).toContain("A village");
    expect(state.cell).toEqual({ x: 2, y: 2, gridWidth: 5, gridHeight: 5, edges: [], placedCells: 3, totalCells: 25 });
    expect(state.neighbours).toEqual([
      { direction: "north", type: "wall" },
      { direction: "west", type: "grass" },
    ]);
    expect(state.nearbyCounts).toEqual({ wall: 1, grass: 1, door: 1 });
    expect(state.mapCounts).toEqual({ wall: 1, grass: 1, door: 1 });
    expect(NEARBY_RADIUS).toBe(2);
    expect(JSON.stringify(state)).not.toContain("cells");
  });

  test("the state carries the balance sheet, and the instructions ask for it and no longer favour the ground type", () => {
    const grid = createGrid(4, 4);
    for (let i = 0; i < 12; i += 1) setCell(grid, i % 4, Math.floor(i / 4), { typeId: "grass" });
    const { state, questions } = buildCellDecision({ vocabulary, setting, grid, x: 0, y: 3 });
    expect(state.balance.overused).toEqual(["grass"]);
    expect(state.balance.needed).toEqual(["wall", "door"]);
    expect(state.balance.shares.grass.now).toBe(75);
    expect(questions.type.instructions).toMatch(/needed/);
    expect(questions.type.instructions).toMatch(/overused/);
    expect(questions.type.instructions).toMatch(/continuations\.suggested/);
    expect(questions.type.instructions).not.toMatch(/most common ground type/);
    expect(state.continuations).toEqual({ lines: [], joins: [], suggested: null });
  });

  test("the state carries the whole map as one letter per cell, with the cell to decide marked", () => {
    const { state, questions } = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 2, y: 2 });
    expect(state.map.rows).toEqual(["C....", "..B..", ".A?..", ".....", "....."]);
    expect(state.map.legend).toEqual({ A: "grass", B: "wall", C: "door", ".": "undecided", "?": "this cell" });
    expect(questions.type.instructions).toMatch(/state\.map/);
  });

  test("a cell on the edge says which edges it touches", () => {
    const { state } = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 0, y: 4 });
    expect(state.cell.edges).toEqual(["south", "west"]);
    const corner = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 4, y: 0 });
    expect(corner.state.cell.edges).toEqual(["north", "east"]);
  });
});

describe("allowedTypes", () => {
  const ruled = {
    ...vocabulary,
    elements: [
      { ...vocabulary.elements[0] },
      { ...vocabulary.elements[1] },
      { ...vocabulary.elements[2], placement: { zone: "any", neverNext: ["door"], onlyNext: ["wall"], edge: null } },
      { id: "river", label: "River", description: "Water.", placementRules: "East edge.", walkable: false, interactable: false, isBarrier: true, visualTag: "water", instanceFields: [], placement: { zone: "outdoor", neverNext: [], onlyNext: [], edge: "east" } },
      { id: "well", label: "Well", description: "A well.", placementRules: "On grass.", walkable: true, interactable: true, isBarrier: false, visualTag: "barrel", instanceFields: [], placement: { zone: "outdoor", neverNext: ["well"], onlyNext: ["grass"], edge: null } },
    ],
  };

  test("an edge-only type is allowed on its edge and excluded elsewhere, with the reason", () => {
    const grid = createGrid(4, 4);
    expect(allowedTypes({ vocabulary: ruled, grid, x: 3, y: 1 }).allowed).toContain("river");
    const inland = allowedTypes({ vocabulary: ruled, grid, x: 1, y: 1 });
    expect(inland.allowed).not.toContain("river");
    expect(inland.excluded.river).toMatch(/east edge/);
  });

  test("neverNext excludes a type when a 4-neighbour is in its list; onlyNext excludes it when neighbours exist and none is in its list", () => {
    const grid = createGrid(4, 4);
    setCell(grid, 1, 0, { typeId: "door" });
    setCell(grid, 0, 1, { typeId: "grass" });
    const result = allowedTypes({ vocabulary: ruled, grid, x: 1, y: 1 });
    expect(result.allowed).not.toContain("door");
    expect(result.excluded.door).toMatch(/next to door/);
    expect(result.allowed).toContain("well");
    expect(result.allowed).toContain("grass");

    setCell(grid, 2, 1, { typeId: "wall" });
    const walled = allowedTypes({ vocabulary: ruled, grid, x: 2, y: 2 });
    expect(walled.allowed).not.toContain("well");
    expect(walled.excluded.well).toMatch(/only next to grass/);
    expect(walled.allowed).toContain("door");
  });

  test("with no decided 4-neighbour, onlyNext cannot be judged and the type stays allowed", () => {
    const grid = createGrid(4, 4);
    setCell(grid, 0, 0, { typeId: "wall" });
    const result = allowedTypes({ vocabulary: ruled, grid, x: 2, y: 2 });
    expect(result.allowed).toContain("well");
    expect(result.allowed).toContain("door");
  });

  test("when every type would be excluded, all stay allowed rather than sending an empty question", () => {
    const strict = { ...ruled, elements: ruled.elements.map((one) => ({ ...one, placement: { ...one.placement, edge: "north" } })) };
    const result = allowedTypes({ vocabulary: strict, grid: createGrid(3, 3), x: 1, y: 2 });
    expect(result.allowed.length).toBe(strict.elements.length);
  });

  test("the question offers only the allowed types, the state names the excluded ones, and a forbidden suggestion is dropped", () => {
    const grid = createGrid(4, 4);
    setCell(grid, 1, 0, { typeId: "river" });
    setCell(grid, 1, 2, { typeId: "river" });
    const decision = buildCellDecision({ vocabulary: ruled, setting, grid, x: 1, y: 1 });
    expect(Object.keys(decision.questions.type.criteria)).not.toContain("river");
    expect(decision.state.excluded.river).toMatch(/east edge/);
    expect(decision.state.continuations.suggested).toBeNull();
    expect(decision.questions.type.instructions).toMatch(/state\.excluded/);
  });
});

describe("the blueprint in the decision (v8)", () => {
  const type = (id, over) => ({ id, label: id, description: id, placementRules: id, walkable: true, interactable: false, isBarrier: false, visualTag: "floor", instanceFields: [], placement: { ...open }, ...over });
  const planned = {
    name: "Ashford",
    summary: "A village.",
    elements: [
      type("grass", { placement: { ...open, zone: "outdoor" } }),
      type("cottage-wall", { walkable: false, isBarrier: true, placement: { ...open, zone: "wall" } }),
      type("cottage-floor", { placement: { ...open, zone: "indoor" } }),
      type("cottage-door", { interactable: true, placement: { ...open, zone: "wall" } }),
      type("window", { walkable: false, isBarrier: true, placement: { ...open, zone: "wall" } }),
      type("chest", { interactable: true, placement: { ...open, zone: "indoor" } }),
      type("villager", { interactable: true, placement: { ...open, zone: "any" } }),
      type("oak", { walkable: false, isBarrier: true, placement: { ...open, zone: "outdoor" } }),
      type("cellar-floor", { placement: { ...open, zone: "indoor" } }),
    ],
    structures: [
      { id: "cottage", label: "Cottage", wall: "cottage-wall", floor: "cottage-floor", door: "cottage-door", minSize: 3, maxSize: 4, minCount: 1, maxCount: 1 },
      { id: "cellar", label: "Cellar", wall: "cottage-wall", floor: "cellar-floor", door: null, minSize: 3, maxSize: 3, minCount: 0, maxCount: 1 },
    ],
  };
  const plan = { rooms: [{ structure: "cottage", label: "Cottage", x: 1, y: 1, width: 4, height: 4, door: { x: 2, y: 4 } }] };

  test("a wall cell takes the structure's wall or a thing that lives in walls; the door cell takes only the door", () => {
    expect(zoneAllowedTypes({ vocabulary: planned, zone: { part: "wall", structure: "cottage", label: "Cottage" } })).toEqual(["cottage-wall", "window"]);
    expect(zoneAllowedTypes({ vocabulary: planned, zone: { part: "door", structure: "cottage", label: "Cottage" } })).toEqual(["cottage-door"]);
  });

  test("an interior cell takes its own floor and indoor or free things, never another structure's floor", () => {
    expect(zoneAllowedTypes({ vocabulary: planned, zone: { part: "interior", structure: "cottage", label: "Cottage" } })).toEqual(["cottage-floor", "chest", "villager"]);
  });

  test("the outside takes outdoor and free things, never a structure's wall, door or indoor floor", () => {
    expect(zoneAllowedTypes({ vocabulary: planned, zone: { part: "outside" } })).toEqual(["grass", "villager", "oak"]);
  });

  test("without structures, every type but the wall-only ones is allowed outside", () => {
    const free = { ...planned, structures: [] };
    expect(zoneAllowedTypes({ vocabulary: free, zone: { part: "outside" } })).toEqual(["grass", "villager", "oak"]);
  });

  test("the decision offers the zone's types, names the zone in the state, and gives the others a reason", () => {
    const grid = createGrid(7, 7);
    const wall = buildCellDecision({ vocabulary: planned, setting, grid, x: 1, y: 1, plan });
    expect(Object.keys(wall.questions.type.criteria)).toEqual(["cottage-wall", "window"]);
    expect(wall.state.zone).toEqual({ part: "wall", structure: "Cottage", description: "a wall of the Cottage" });
    expect(wall.state.excluded.grass).toBe("this cell is a wall of the Cottage");
    const door = buildCellDecision({ vocabulary: planned, setting, grid, x: 2, y: 4, plan });
    expect(Object.keys(door.questions.type.criteria)).toEqual(["cottage-door"]);
    const inside = buildCellDecision({ vocabulary: planned, setting, grid, x: 2, y: 2, plan });
    expect(Object.keys(inside.questions.type.criteria)).toEqual(["cottage-floor", "chest", "villager"]);
    const outside = buildCellDecision({ vocabulary: planned, setting, grid, x: 6, y: 6, plan });
    expect(outside.state.zone).toEqual({ part: "outside", structure: null, description: "outside every structure" });
    expect(Object.keys(outside.questions.type.criteria)).toEqual(["grass", "villager", "oak"]);
    expect(outside.questions.type.instructions).toMatch(/state\.zone/);
  });

  test("a hard rule still applies inside a zone, and a zone with every type ruled out falls back to the zone's types", () => {
    const strict = { ...planned, elements: planned.elements.map((one) => (one.id === "chest" ? { ...one, placement: { ...one.placement, neverNext: ["chest"] } } : one)) };
    const grid = createGrid(7, 7);
    setCell(grid, 2, 3, { typeId: "chest" });
    const inside = buildCellDecision({ vocabulary: strict, setting, grid, x: 2, y: 2, plan });
    expect(Object.keys(inside.questions.type.criteria)).toEqual(["cottage-floor", "villager"]);
    expect(inside.state.excluded.chest).toBe("never next to chest");
  });

  test("describeZone reads as a phrase", () => {
    expect(describeZone({ part: "door", label: "Cottage" })).toBe("the door of the Cottage");
    expect(describeZone(null)).toBe("outside every structure");
  });
});

describe("mapSketch", () => {
  test("gives every type one letter in vocabulary order, and reads rows from north to south", () => {
    const grid = createGrid(3, 2);
    setCell(grid, 0, 0, { typeId: "wall" });
    setCell(grid, 2, 1, { typeId: "grass" });
    const sketch = mapSketch(grid, vocabulary, 1, 1);
    expect(sketch.rows).toEqual(["B..", ".?A"]);
    expect(sketch.legend.A).toBe("grass");
  });

  test("a type the vocabulary does not know is drawn as unknown", () => {
    const grid = createGrid(2, 1);
    setCell(grid, 0, 0, { typeId: "lava" });
    expect(mapSketch(grid, vocabulary, 1, 0).rows).toEqual(["!?"]);
  });
});

describe("targetShare", () => {
  test("reads the rarity word out of the placement rules", () => {
    expect(targetShare("The most common cell. Fills every open space.")).toBe(TARGET_SHARES.mostCommon);
    expect(targetShare("Common. Forms lines between houses.")).toBe(TARGET_SHARES.common);
    expect(targetShare("Uncommon. Exactly one per cottage.")).toBe(TARGET_SHARES.uncommon);
    expect(targetShare("Rare. On grass or path.")).toBe(TARGET_SHARES.rare);
    expect(targetShare("Exactly one, on the green.")).toBe(TARGET_SHARES.rare);
    expect(targetShare("Around houses.")).toBe(TARGET_SHARES.unspecified);
  });

  test("the most common word wins over a later rarer one, and matching is case-insensitive", () => {
    expect(targetShare("MOST COMMON in the north, rare elsewhere.")).toBe(TARGET_SHARES.mostCommon);
    expect(targetShare("rare, uncommon in the south")).toBe(TARGET_SHARES.rare);
  });
});

describe("balanceSheet", () => {
  const balanced = {
    elements: [
      { id: "grass", placementRules: "The most common cell." },
      { id: "wall", placementRules: "Common. Forms rectangles." },
      { id: "door", placementRules: "Uncommon. One per house." },
      { id: "chest", placementRules: "Rare. Inside houses." },
    ],
  };

  test("names the types below their target share as needed, the most missing first, and those far above as overused", () => {
    const sheet = balanceSheet(balanced, { grass: 20, wall: 1 }, 64);
    expect(sheet.needed).toEqual(["door", "chest", "wall", "grass"]);
    expect(sheet.overused).toEqual([]);
    const later = balanceSheet(balanced, { grass: 40, wall: 2 }, 64);
    expect(later.overused).toEqual(["grass"]);
    expect(later.needed).toEqual(["door", "chest", "wall"]);
  });

  test("a type at its target is neither needed nor overused, and nothing is overused with fewer than three cells", () => {
    const sheet = balanceSheet(balanced, { grass: 29, wall: 10, door: 4, chest: 1 }, 64);
    expect(sheet.needed).toEqual([]);
    expect(sheet.overused).toEqual([]);
    expect(balanceSheet(balanced, { chest: 2 }, 64).overused).toEqual([]);
  });

  test("carries the target and current share of every type, as percentages", () => {
    const sheet = balanceSheet(balanced, { grass: 32 }, 64);
    expect(sheet.shares.grass).toEqual({ target: 45, now: 50 });
    expect(sheet.shares.chest).toEqual({ target: 2, now: 0 });
  });

  test("needed is ordered by the share of the target that is still missing", () => {
    const sheet = balanceSheet(balanced, { grass: 5, door: 3 }, 64);
    expect(sheet.needed).toEqual(["wall", "chest", "grass", "door"]);
  });
});

describe("isRouteType", () => {
  test("a route is a path-like tag or a path-like name", () => {
    expect(isRouteType({ id: "dirt-path", label: "Dirt path", visualTag: "path" })).toBe(true);
    expect(isRouteType({ id: "corridor", label: "Corridor", visualTag: "metal-floor" })).toBe(true);
    expect(isRouteType({ id: "grass", label: "Grass", visualTag: "grass" })).toBe(false);
    expect(isRouteType(null)).toBe(false);
  });
});

describe("continuationHints", () => {
  const world = {
    elements: [
      { id: "grass", label: "Grass", visualTag: "grass", isBarrier: false },
      { id: "wall", label: "Wall", visualTag: "stone-wall", isBarrier: true },
      { id: "path", label: "Dirt path", visualTag: "path", isBarrier: false },
    ],
  };

  const nothingOverused = { overused: [] };

  test("names each barrier or route line that reaches the cell, with its length, and suggests the short barrier", () => {
    const grid = createGrid(6, 3);
    setCell(grid, 0, 1, { typeId: "wall" });
    setCell(grid, 1, 1, { typeId: "wall" });
    setCell(grid, 2, 1, { typeId: "wall" });
    setCell(grid, 3, 0, { typeId: "path" });
    setCell(grid, 3, 2, { typeId: "grass" });
    expect(continuationHints(grid, world, 3, 1, nothingOverused)).toEqual({
      lines: [
        { direction: "north", type: "path", role: "route", length: 1 },
        { direction: "west", type: "wall", role: "barrier", length: 3 },
      ],
      joins: [],
      suggested: { type: "wall", reason: "continues the wall line of 3 cells from the west" },
    });
  });

  test("a type on two opposite sides is a join and is suggested first; ground types give no hint", () => {
    const grid = createGrid(3, 3);
    setCell(grid, 0, 1, { typeId: "wall" });
    setCell(grid, 2, 1, { typeId: "wall" });
    setCell(grid, 1, 0, { typeId: "grass" });
    const hints = continuationHints(grid, world, 1, 1, nothingOverused);
    expect(hints.joins).toEqual(["wall"]);
    expect(hints.lines.map((one) => one.direction)).toEqual(["east", "west"]);
    expect(hints.suggested).toEqual({ type: "wall", reason: "closes the gap between two wall segments" });
  });

  test("a line that is long enough is reported but not suggested, so a wall cannot run across the map", () => {
    const grid = createGrid(8, 1);
    for (let x = 0; x < MAX_CONTINUED_LINE; x += 1) setCell(grid, x, 0, { typeId: "path" });
    const hints = continuationHints(grid, world, MAX_CONTINUED_LINE, 0, nothingOverused);
    expect(hints.lines[0].length).toBe(MAX_CONTINUED_LINE);
    expect(hints.suggested).toBeNull();
  });

  test("an overused type is never suggested, even for a join", () => {
    const grid = createGrid(3, 3);
    setCell(grid, 0, 1, { typeId: "wall" });
    setCell(grid, 2, 1, { typeId: "wall" });
    expect(continuationHints(grid, world, 1, 1, { overused: ["wall"] }).suggested).toBeNull();
  });

  test("an empty neighbourhood gives empty hints", () => {
    expect(continuationHints(createGrid(3, 3), world, 1, 1, nothingOverused)).toEqual({ lines: [], joins: [], suggested: null });
  });
});

describe("readDecisionAnswer", () => {
  test("reads the choice, its confidence and the probabilities from a decisions payload", () => {
    const payload = {
      answers: { type: { type: "choice", choice: "grass", confidence: 0.8, probabilities: { grass: 0.8, wall: 0.15, door: 0.05 } } },
    };
    expect(readDecisionAnswer(payload, vocabulary)).toEqual({
      choice: "grass",
      confidence: 0.8,
      probabilities: { grass: 0.8, wall: 0.15, door: 0.05 },
    });
  });

  test("drops ids that are not in the vocabulary and fills a missing confidence from the probabilities", () => {
    const payload = { answers: { type: { choice: "grass", probabilities: { grass: 0.6, lava: 0.4 } } } };
    expect(readDecisionAnswer(payload, vocabulary)).toEqual({ choice: "grass", confidence: 0.6, probabilities: { grass: 0.6 } });
  });

  test("is null when the choice is missing or unknown", () => {
    expect(readDecisionAnswer({ answers: { type: { choice: "lava" } } }, vocabulary)).toBeNull();
    expect(readDecisionAnswer({ answers: {} }, vocabulary)).toBeNull();
    expect(readDecisionAnswer(null, vocabulary)).toBeNull();
  });
});

describe("chooseType", () => {
  const probabilities = { grass: 0.5, wall: 0.3, door: 0.2 };

  test("with spread 0 it is the top probability", () => {
    expect(chooseType({ choice: "wall", probabilities, spread: 0, random: () => 0.99 })).toBe("grass");
  });

  test("with spread 1 it samples the probabilities", () => {
    const random = mulberry32(3);
    const counts = { grass: 0, wall: 0, door: 0 };
    for (let i = 0; i < 2000; i += 1) counts[chooseType({ choice: "grass", probabilities, spread: 1, random })] += 1;
    expect(counts.grass).toBeGreaterThan(850);
    expect(counts.wall).toBeGreaterThan(250);
    expect(counts.door).toBeGreaterThan(100);
  });

  test("never picks an option below a third of the best one, so a doubtful tail does not litter the map", () => {
    const skewed = { grass: 0.6, wall: 0.25, door: 0.15 };
    const random = mulberry32(5);
    const seen = new Set();
    for (let i = 0; i < 2000; i += 1) seen.add(chooseType({ choice: "grass", probabilities: skewed, spread: 1, random }));
    expect(seen.has("wall")).toBe(true);
    expect(seen.has("door")).toBe(false);
    expect(SAMPLE_FLOOR).toBe(1 / 3);
  });

  test("falls back to the model's own choice when there are no probabilities", () => {
    expect(chooseType({ choice: "door", probabilities: {}, spread: 1, random: () => 0.5 })).toBe("door");
  });
});

describe("the chat fallback for decisions", () => {
  test("asks a text model the same question and wants JSON back", () => {
    const decision = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 2, y: 2 });
    const messages = buildChatDecisionMessages(decision);
    const text = messages.map((one) => one.content).join("\n");
    expect(messages[0].role).toBe("system");
    expect(text).toContain('"typeId"');
    expect(text).toContain("grass");
    expect(text).toContain("Around houses.");
    expect(text).toContain('"north"');
    expect(CHAT_DECISION_SCHEMA.required).toEqual(["typeId", "confidence"]);
  });

  test("reads the JSON answer into the same shape as a decisions answer", () => {
    expect(readChatDecision('{"typeId": "wall", "confidence": 0.7}', vocabulary)).toEqual({
      choice: "wall",
      confidence: 0.7,
      probabilities: { wall: 0.7 },
    });
    expect(readChatDecision('```json\n{"typeId":"door"}\n```', vocabulary).choice).toBe("door");
    expect(readChatDecision('{"typeId": "lava"}', vocabulary)).toBeNull();
    expect(readChatDecision("no", vocabulary)).toBeNull();
  });
});

describe("fallbackType", () => {
  test("copies the most common walkable neighbour", () => {
    const grid = createGrid(3, 3);
    setCell(grid, 0, 1, { typeId: "grass" });
    setCell(grid, 2, 1, { typeId: "grass" });
    setCell(grid, 1, 0, { typeId: "wall" });
    expect(fallbackType({ vocabulary, grid, x: 1, y: 1, random: () => 0 })).toBe("grass");
  });

  test("with no walkable neighbour it picks a random walkable type", () => {
    const grid = createGrid(3, 3);
    setCell(grid, 1, 0, { typeId: "wall" });
    const picked = fallbackType({ vocabulary, grid, x: 1, y: 1, random: () => 0.99 });
    expect(["grass", "door"]).toContain(picked);
  });
});
