import { describe, expect, test } from "bun:test";
import {
  CHAT_DECISION_SCHEMA,
  NEARBY_RADIUS,
  buildCellDecision,
  buildChatDecisionMessages,
  chooseType,
  fallbackType,
  readChatDecision,
  readDecisionAnswer,
} from "./cellDecision.js";
import { createGrid, setCell } from "./grid.js";
import { mulberry32 } from "./random.js";

const vocabulary = {
  name: "Ashford",
  summary: "A village.",
  elements: [
    { id: "grass", label: "Grass", description: "Open grass.", placementRules: "Most common, outdoors.", walkable: true, interactable: false, isBarrier: false, visualTag: "grass", instanceFields: [] },
    { id: "wall", label: "Wall", description: "A stone wall.", placementRules: "Around houses.", walkable: false, interactable: false, isBarrier: true, visualTag: "stone-wall", instanceFields: [] },
    { id: "door", label: "Door", description: "A door.", placementRules: "In a wall.", walkable: true, interactable: true, isBarrier: false, visualTag: "door", instanceFields: ["locked"] },
  ],
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

  test("a cell on the edge says which edges it touches", () => {
    const { state } = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 0, y: 4 });
    expect(state.cell.edges).toEqual(["south", "west"]);
    const corner = buildCellDecision({ vocabulary, setting, grid: sampleGrid(), x: 4, y: 0 });
    expect(corner.state.cell.edges).toEqual(["north", "east"]);
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
  const probabilities = { grass: 0.7, wall: 0.2, door: 0.1 };

  test("with spread 0 it is the top probability", () => {
    expect(chooseType({ choice: "wall", probabilities, spread: 0, random: () => 0.99 })).toBe("grass");
  });

  test("with spread 1 it samples the probabilities", () => {
    const random = mulberry32(3);
    const counts = { grass: 0, wall: 0, door: 0 };
    for (let i = 0; i < 2000; i += 1) counts[chooseType({ choice: "grass", probabilities, spread: 1, random })] += 1;
    expect(counts.grass).toBeGreaterThan(1200);
    expect(counts.wall).toBeGreaterThan(250);
    expect(counts.door).toBeGreaterThan(100);
  });

  test("never picks an option far below the best one, so a 1% tail does not litter the map", () => {
    const skewed = { grass: 0.95, wall: 0.04, door: 0.01 };
    const random = mulberry32(5);
    const seen = new Set();
    for (let i = 0; i < 2000; i += 1) seen.add(chooseType({ choice: "grass", probabilities: skewed, spread: 1, random }));
    expect(seen.has("door")).toBe(false);
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
