import { describe, expect, test } from "bun:test";
import { planStructures } from "./blueprint.js";
import { sketchLegend } from "./cellDecision.js";
import { createGrid, getCell, setCell } from "./grid.js";
import { presetVocabularyFor } from "./presetVocabularies.js";
import { mulberry32 } from "./random.js";
import { GENERATION_MODES, WHOLE_MAP_REQUEST, WHOLE_MAP_SCHEMA, buildWholeMapMessages, describePlan, readGenerationMode, readWholeMap, runWholeMapGeneration } from "./wholeMap.js";

const vocabulary = presetVocabularyFor("medieval-village");
const setting = { location: "a village", era: "1300", notes: "" };
const { letterOf, legend } = sketchLegend(vocabulary);
const grass = letterOf.grass;

/** A valid answer: every cell the first type, except what `overrides` sets. */
function rowsOf(width, height, letter = grass) {
  return Array.from({ length: height }, () => letter.repeat(width));
}

describe("readGenerationMode", () => {
  test("knows the three modes and falls back to a decision per cell", () => {
    expect(GENERATION_MODES).toEqual(["per-cell", "whole-map", "batched"]);
    expect(readGenerationMode("whole-map")).toBe("whole-map");
    expect(readGenerationMode("batched")).toBe("batched");
    expect(readGenerationMode("per-cell")).toBe("per-cell");
    expect(readGenerationMode("nonsense")).toBe("per-cell");
    expect(readGenerationMode(null)).toBe("per-cell");
  });
});

describe("buildWholeMapMessages", () => {
  const plan = planStructures({ vocabulary, width: 12, height: 12, random: mulberry32(3) });
  const messages = buildWholeMapMessages({ vocabulary, setting, width: 12, height: 12, plan });
  const text = messages.map((one) => one.content).join("\n");

  test("asks for exactly the grid's rows and letters, north and west first", () => {
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("exactly 12 strings of exactly 12 letters");
    expect(messages[0].content).toContain("north row");
  });

  test("gives every type its letter, its rules and its target share", () => {
    for (const type of vocabulary.elements) {
      expect(text).toContain(`${letterOf[type.id]} = ${type.id} (${type.label})`);
      expect(text).toContain(type.placementRules);
    }
    expect(text).toMatch(/about \d+% of the map/);
  });

  test("describes every planned room with its coordinates, its door and the types each part allows", () => {
    expect(plan.rooms.length).toBeGreaterThan(0);
    for (const room of plan.rooms) {
      expect(text).toContain(`x ${room.x} to ${room.x + room.width - 1}, y ${room.y} to ${room.y + room.height - 1}`);
      if (room.door) expect(text).toContain(`(${room.door.x}, ${room.door.y}) is its door`);
    }
    expect(text).toContain("is outside:");
  });

  test("says so when nothing is planned", () => {
    const lines = describePlan({ vocabulary, plan: { rooms: [] }, width: 8, height: 8 });
    expect(lines[0]).toContain("No structure is planned");
    expect(lines.at(-1)).toContain("outside");
  });

  test("the schema wants an object with rows of strings and nothing else", () => {
    expect(WHOLE_MAP_SCHEMA.required).toEqual(["rows"]);
    expect(WHOLE_MAP_SCHEMA.additionalProperties).toBe(false);
    expect(WHOLE_MAP_SCHEMA.properties.rows.items.type).toBe("string");
  });
});

describe("readWholeMap", () => {
  test("reads rows of legend letters into type ids, north row first", () => {
    const rows = rowsOf(4, 3);
    rows[2] = grass + letterOf.oak + grass + grass;
    const read = readWholeMap(JSON.stringify({ rows }), vocabulary, 4, 3);
    expect(read.ok).toBe(true);
    expect(read.cells[0]).toEqual(["grass", "grass", "grass", "grass"]);
    expect(read.cells[2][1]).toBe("oak");
  });

  test("accepts the JSON inside a fenced block", () => {
    const text = "Here is the map:\n```json\n" + JSON.stringify({ rows: rowsOf(2, 2) }) + "\n```";
    expect(readWholeMap(text, vocabulary, 2, 2).ok).toBe(true);
  });

  test("names the wrong row count, the wrong row length and each unknown letter", () => {
    const read = readWholeMap(JSON.stringify({ rows: [grass.repeat(3), grass + "#" + grass + grass] }), vocabulary, 4, 3);
    expect(read.ok).toBe(false);
    expect(read.errors).toContain("The map needs exactly 3 rows; the answer has 2.");
    expect(read.errors).toContain("Row 0 needs exactly 4 letters; it has 3.");
    expect(read.errors).toContain('Row 1, column 1: "#" is not a letter of the legend.');
  });

  test("rejects an answer with no rows", () => {
    expect(readWholeMap("not json", vocabulary, 2, 2)).toEqual({ ok: false, errors: ['The answer has no "rows" array.'] });
    expect(readWholeMap(JSON.stringify({ grid: [] }), vocabulary, 2, 2).ok).toBe(false);
  });

  test("the legend letters are the map sketch's letters", () => {
    expect(legend[letterOf.grass]).toBe("grass");
    expect(Object.keys(legend).length).toBe(vocabulary.elements.length);
  });
});

describe("runWholeMapGeneration", () => {
  const answer = (rows, extra = {}) => ({ ok: true, text: JSON.stringify({ rows }), elapsedMs: 1200, usage: { prompt_tokens: 2000, completion_tokens: 300 }, ...extra });

  test("fills every empty cell from one valid answer and keeps a cell decided before", async () => {
    const grid = createGrid(4, 3);
    setCell(grid, 0, 0, { typeId: "oak", confidence: 1, source: "hand" });
    const rows = rowsOf(4, 3);
    const calls = [];
    const summary = await runWholeMapGeneration({
      grid,
      vocabulary,
      setting,
      generate: async (request) => {
        calls.push(request);
        return answer(rows);
      },
      now: (() => {
        let t = 0;
        return () => (t += 500);
      })(),
    });
    expect(summary.status).toBe("done");
    expect(summary.placedCount).toBe(11);
    expect(summary.fallbackCount).toBe(0);
    expect(summary.modelCalls).toBe(1);
    expect(summary.mode).toBe("whole-map");
    expect(summary.usage).toEqual({ promptTokens: 2000, completionTokens: 300, cost: 0 });
    expect(summary.averageMs).toBe(1200);
    expect(getCell(grid, 0, 0).typeId).toBe("oak");
    expect(getCell(grid, 3, 2)).toMatchObject({ typeId: "grass", source: "model", confidence: 1, modelChoice: "grass", attempts: 1, elapsedMs: 1200 });
    expect(calls[0].jsonSchema).toBe(WHOLE_MAP_SCHEMA);
    expect(calls[0]).toMatchObject(WHOLE_MAP_REQUEST);
    expect(WHOLE_MAP_REQUEST.reasoning).toEqual({ enabled: false });
  });

  test("sends the problems back and accepts the corrected answer", async () => {
    const grid = createGrid(3, 2);
    let call = 0;
    const seen = [];
    const summary = await runWholeMapGeneration({
      grid,
      vocabulary,
      setting,
      generate: async ({ messages }) => {
        call += 1;
        seen.push(messages.length);
        return call === 1 ? answer([grass.repeat(3)]) : answer(rowsOf(3, 2));
      },
    });
    expect(summary.status).toBe("done");
    expect(summary.attempts).toBe(2);
    expect(summary.usage.promptTokens).toBe(4000);
    expect(seen).toEqual([2, 4]);
  });

  test("fails after the attempts run out, naming the last problems", async () => {
    const grid = createGrid(3, 2);
    const attempts = [];
    const summary = await runWholeMapGeneration({
      grid,
      vocabulary,
      setting,
      attempts: 2,
      onAttempt: (event) => attempts.push(event.attempt),
      generate: async () => answer(["??", "??"]),
    });
    expect(summary.status).toBe("failed");
    expect(summary.failure.message).toContain("no valid map in 2 attempts");
    expect(summary.errors.length).toBeGreaterThan(0);
    expect(attempts).toEqual([1, 2]);
    expect(getCell(grid, 0, 0)).toBeNull();
  });

  test("a failed call stops at once with the client's failure", async () => {
    const grid = createGrid(2, 2);
    const summary = await runWholeMapGeneration({ grid, vocabulary, setting, generate: async () => ({ ok: false, status: 402, message: "no credits" }) });
    expect(summary.status).toBe("failed");
    expect(summary.failure).toEqual({ ok: false, status: 402, message: "no credits" });
    expect(summary.modelCalls).toBe(0);
  });
});
