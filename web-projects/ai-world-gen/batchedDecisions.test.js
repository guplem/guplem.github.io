import { describe, expect, test } from "bun:test";
import {
  BATCH_TOKEN_BUDGET,
  CHARS_PER_TOKEN,
  MAX_INPUT_TOKENS,
  buildBatch,
  cellQuestionKey,
  estimateTokens,
  isTooManyTokens,
  planBatch,
  readBatchAnswers,
  readCellQuestionKey,
  runBatchedGeneration,
} from "./batchedDecisions.js";
import { planStructures } from "./blueprint.js";
import { createGrid, getCell, setCell } from "./grid.js";
import { createOrder } from "./orderStrategies.js";
import { presetVocabularyFor } from "./presetVocabularies.js";
import { mulberry32 } from "./random.js";

const vocabulary = presetVocabularyFor("medieval-village");
const setting = { location: "a village", era: "1300", notes: "" };

function gridWithPlan(size, seed = 101) {
  const grid = createGrid(size, size);
  const plan = planStructures({ vocabulary, width: size, height: size, random: mulberry32(seed ^ 0x51ed270b) });
  return { grid, plan };
}

function coordinatesOf(size) {
  const list = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) list.push({ x, y });
  return list;
}

describe("cellQuestionKey", () => {
  test("names a cell by its coordinates and reads them back", () => {
    expect(cellQuestionKey(0, 0)).toBe("cell_0_0");
    expect(cellQuestionKey(7, 12)).toBe("cell_7_12");
    expect(readCellQuestionKey("cell_7_12")).toEqual({ x: 7, y: 12 });
  });

  test("reads nothing out of a key that is not a cell", () => {
    expect(readCellQuestionKey("type")).toBeNull();
    expect(readCellQuestionKey("cell_a_b")).toBeNull();
    expect(readCellQuestionKey("")).toBeNull();
  });
});

describe("estimateTokens", () => {
  test("counts the characters of the request against the measured ratio", () => {
    const value = { a: "x".repeat(320) };
    expect(estimateTokens(value)).toBe(Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN));
  });

  test("keeps the budget under the endpoint's ceiling", () => {
    expect(BATCH_TOKEN_BUDGET).toBeLessThan(MAX_INPUT_TOKENS);
  });
});

describe("isTooManyTokens", () => {
  test("recognises the endpoint's own refusal, whatever the wrapping", () => {
    expect(isTooManyTokens({ status: 400, message: 'HTTP 400: {"detail":{"error_type":"max_tokens_exceeded"}}' })).toBe(true);
    expect(isTooManyTokens({ status: 400, message: "max tokens exceeded" })).toBe(true);
  });

  test("leaves every other failure alone", () => {
    expect(isTooManyTokens({ status: 429, message: "rate limited" })).toBe(false);
    expect(isTooManyTokens({ status: 400, message: "model not found" })).toBe(false);
    expect(isTooManyTokens(null)).toBe(false);
  });
});

describe("planBatch", () => {
  const { grid, plan } = gridWithPlan(8);

  test("takes the whole 8 by 8 map in one batch", () => {
    const order = createOrder("spiral", { width: 8, height: 8, random: mulberry32(1) });
    const coordinates = planBatch({ vocabulary, setting, grid, order, plan, placed: new Set() });
    expect(coordinates).toHaveLength(64);
  });

  test("follows the order the test case asks for", () => {
    const seed = 42;
    const order = createOrder("frontier", { width: 8, height: 8, random: mulberry32(seed) });
    const batch = planBatch({ vocabulary, setting, grid, order, plan, placed: new Set() });
    const same = createOrder("frontier", { width: 8, height: 8, random: mulberry32(seed) });
    const placed = new Set();
    const expected = [];
    for (let index = 0; index < 64; index += 1) {
      const next = same.nextCoordinate(placed);
      expected.push(next);
      placed.add(`${next.x},${next.y}`);
    }
    expect(batch).toEqual(expected);
  });

  test("stops at the token budget rather than at a cell count", () => {
    const coordinates = planBatch({ vocabulary, setting, grid, order: createOrder("spiral", { width: 8, height: 8, random: mulberry32(1) }), plan, placed: new Set(), budget: 2000 });
    expect(coordinates.length).toBeGreaterThan(0);
    expect(coordinates.length).toBeLessThan(64);
    expect(estimateTokens(buildBatch({ vocabulary, setting, grid, coordinates, plan }))).toBeLessThanOrEqual(2000 * 1.2);
  });

  test("always takes at least one cell, however small the budget", () => {
    const coordinates = planBatch({ vocabulary, setting, grid, order: createOrder("spiral", { width: 8, height: 8, random: mulberry32(1) }), plan, placed: new Set(), budget: 1 });
    expect(coordinates).toHaveLength(1);
  });

  test("never offers a cell that is already placed", () => {
    const busy = createGrid(8, 8);
    setCell(busy, 0, 0, { typeId: "grass", source: "hand" });
    const placed = new Set(["0,0"]);
    const coordinates = planBatch({ vocabulary, setting, grid: busy, order: createOrder("spiral", { width: 8, height: 8, random: mulberry32(1) }), plan, placed });
    expect(coordinates).toHaveLength(63);
    expect(coordinates.some((one) => one.x === 0 && one.y === 0)).toBe(false);
  });
});

describe("buildBatch", () => {
  const { grid, plan } = gridWithPlan(8);
  const coordinates = coordinatesOf(8);
  const request = buildBatch({ vocabulary, setting, grid, coordinates, plan });

  test("asks one question per cell, keyed by its coordinates", () => {
    expect(Object.keys(request.questions)).toHaveLength(64);
    for (const { x, y } of coordinates) {
      const question = request.questions[cellQuestionKey(x, y)];
      expect(question.type).toBe("choice");
      expect(Object.keys(question.criteria).length).toBeGreaterThan(0);
    }
  });

  test("offers each cell only the types its part of the plan and the hard rules allow", () => {
    const doorCells = coordinates.filter(({ x, y }) => plan.rooms.some((room) => room.door && room.door.x === x && room.door.y === y));
    expect(doorCells.length).toBeGreaterThan(0);
    for (const { x, y } of doorCells) {
      expect(Object.keys(request.questions[cellQuestionKey(x, y)].criteria)).toHaveLength(1);
    }
  });

  test("carries the world, the grid and the map sketch once, not once per cell", () => {
    expect(request.state.world.name).toBe(vocabulary.name);
    expect(request.state.grid).toMatchObject({ width: 8, height: 8, totalCells: 64 });
    expect(request.state.map.rows).toHaveLength(8);
    expect(JSON.stringify(request.state.map)).not.toContain("?");
    expect(request.state.balance).not.toBeNull();
  });

  test("gives every cell its own part of the plan, its neighbours and the rules that rule it out", () => {
    for (const { x, y } of coordinates) {
      const cell = request.state.cells[cellQuestionKey(x, y)];
      expect(cell.x).toBe(x);
      expect(cell.y).toBe(y);
      expect(typeof cell.zone.description).toBe("string");
      expect(Array.isArray(cell.neighbours)).toBe(true);
      expect(cell.excluded).not.toBeNull();
    }
  });

  test("points each question at its own cell, and writes how to choose once", () => {
    expect(request.questions.cell_0_0.instructions).toContain("state.cells.cell_0_0");
    expect(request.questions.cell_0_0.instructions).toContain("state.howToChoose");
    expect(request.state.howToChoose.toLowerCase()).toContain("same time");
    // The long instruction is the same sentence for every cell, so it is sent once.
    expect(request.questions.cell_0_0.instructions.length).toBeLessThan(request.state.howToChoose.length / 4);
  });

  test("never sends the raw grid, which carries the probabilities", () => {
    expect(JSON.stringify(request.state)).not.toContain('"cells":[');
    expect(JSON.stringify(request.state)).not.toContain("probabilities");
  });
});

describe("readBatchAnswers", () => {
  test("reads one answer per cell question", () => {
    const payload = {
      answers: {
        cell_0_0: { choice: "grass", confidence: 0.9, probabilities: { grass: 0.9, river: 0.1 } },
        cell_1_0: { choice: "river", confidence: 0.8, probabilities: { river: 0.8 } },
      },
    };
    const answers = readBatchAnswers(payload, vocabulary);
    expect(answers.cell_0_0.choice).toBe("grass");
    expect(answers.cell_1_0.probabilities.river).toBe(0.8);
  });

  test("drops an answer that names no type in the vocabulary", () => {
    const answers = readBatchAnswers({ answers: { cell_0_0: { choice: "lava", confidence: 1 } } }, vocabulary);
    expect(answers.cell_0_0).toBeNull();
  });

  test("reads nothing out of a payload with no answers", () => {
    expect(readBatchAnswers(null, vocabulary)).toEqual({});
    expect(readBatchAnswers({ answers: null }, vocabulary)).toEqual({});
  });
});

describe("runBatchedGeneration", () => {
  const size = 8;

  /** A decider that answers every question with the first option it is offered. */
  function answerFirstOption() {
    const calls = [];
    const decide = async ({ state, questions }) => {
      calls.push({ state, questions });
      const answers = {};
      for (const [key, question] of Object.entries(questions)) {
        const first = Object.keys(question.criteria)[0];
        answers[key] = { choice: first, confidence: 1, probabilities: { [first]: 1 } };
      }
      return { ok: true, answers, elapsedMs: 10, usage: { promptTokens: 100, completionTokens: 10, cost: 0.001 } };
    };
    return { decide, calls };
  }

  test("fills the whole map from one request", async () => {
    const { grid, plan } = gridWithPlan(size);
    const { decide, calls } = answerFirstOption();
    const summary = await runBatchedGeneration({
      grid,
      vocabulary,
      setting,
      plan,
      order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }),
      decide,
      random: mulberry32(7),
    });
    expect(summary.status).toBe("done");
    expect(summary.placedCount).toBe(64);
    expect(summary.fallbackCount).toBe(0);
    expect(summary.modelCalls).toBe(1);
    expect(summary.decisionCount).toBe(64);
    expect(summary.mode).toBe("batched");
    expect(calls).toHaveLength(1);
    expect(grid.cells.every((cell) => cell !== null)).toBe(true);
  });

  test("records the usage the endpoint reports", async () => {
    const { grid, plan } = gridWithPlan(size);
    const { decide } = answerFirstOption();
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7) });
    expect(summary.usage).toEqual({ promptTokens: 100, completionTokens: 10, cost: 0.001 });
  });

  test("marks every cell as a model answer, with the batch it came from", async () => {
    const { grid, plan } = gridWithPlan(size);
    const { decide } = answerFirstOption();
    await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7) });
    const cell = getCell(grid, 0, 0);
    expect(cell.source).toBe("model");
    expect(cell.batch).toBe(1);
  });

  test("splits a batch the endpoint refuses for its size, and does not fall back", async () => {
    const { grid, plan } = gridWithPlan(size);
    const sizes = [];
    const decide = async ({ questions }) => {
      const count = Object.keys(questions).length;
      sizes.push(count);
      if (count > 20) return { ok: false, status: 400, message: 'HTTP 400: {"detail":{"error_type":"max_tokens_exceeded"}}' };
      const answers = {};
      for (const [key, question] of Object.entries(questions)) {
        const first = Object.keys(question.criteria)[0];
        answers[key] = { choice: first, confidence: 1, probabilities: { [first]: 1 } };
      }
      return { ok: true, answers, elapsedMs: 5 };
    };
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7) });
    expect(summary.status).toBe("done");
    expect(summary.fallbackCount).toBe(0);
    expect(summary.placedCount).toBe(64);
    expect(Math.max(...sizes.filter((one) => one <= 20))).toBeLessThanOrEqual(20);
  });

  test("falls back only on the cells the model left unanswered", async () => {
    const { grid, plan } = gridWithPlan(size);
    const decide = async ({ questions }) => {
      const answers = {};
      for (const [key, question] of Object.entries(questions)) {
        if (key === "cell_0_0") continue;
        const first = Object.keys(question.criteria)[0];
        answers[key] = { choice: first, confidence: 1, probabilities: { [first]: 1 } };
      }
      return { ok: true, answers, elapsedMs: 5 };
    };
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7) });
    expect(summary.status).toBe("done");
    expect(summary.fallbackCount).toBe(1);
    expect(getCell(grid, 0, 0).source).toBe("fallback");
  });

  test("stops at once on a failure that will repeat on every batch", async () => {
    const { grid, plan } = gridWithPlan(size);
    let calls = 0;
    const decide = async () => {
      calls += 1;
      return { ok: false, status: 401, message: "no key" };
    };
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7), sleep: async () => {} });
    expect(summary.status).toBe("failed");
    expect(calls).toBe(1);
  });

  test("retries a transient failure before it gives up", async () => {
    const { grid, plan } = gridWithPlan(size);
    let calls = 0;
    const decide = async ({ questions }) => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 429, message: "slow down" };
      const answers = {};
      for (const [key, question] of Object.entries(questions)) {
        const first = Object.keys(question.criteria)[0];
        answers[key] = { choice: first, confidence: 1, probabilities: { [first]: 1 } };
      }
      return { ok: true, answers, elapsedMs: 5 };
    };
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7), sleep: async () => {} });
    expect(summary.status).toBe("done");
    expect(calls).toBe(2);
  });

  test("a 16 by 16 map takes more than one batch, and a later batch sees the cells of the earlier one", async () => {
    const { grid, plan } = gridWithPlan(16, 401);
    const sketches = [];
    const decide = async ({ state, questions }) => {
      sketches.push(state.map.rows.join(""));
      const answers = {};
      for (const [key, question] of Object.entries(questions)) {
        const first = Object.keys(question.criteria)[0];
        answers[key] = { choice: first, confidence: 1, probabilities: { [first]: 1 } };
      }
      return { ok: true, answers, elapsedMs: 5 };
    };
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: 16, height: 16, random: mulberry32(1) }), decide, random: mulberry32(7) });
    expect(summary.status).toBe("done");
    expect(summary.placedCount).toBe(256);
    expect(summary.modelCalls).toBeGreaterThan(1);
    // The first batch sees an empty map; a later one sees what the earlier batches placed.
    expect(sketches[0]).toMatch(/^\.+$/);
    expect(sketches[1]).not.toMatch(/^\.+$/);
  });

  test("leaves a cell that was decided by hand alone", async () => {
    const { grid, plan } = gridWithPlan(size);
    setCell(grid, 3, 3, { typeId: "river", source: "hand", confidence: 1, probabilities: {} });
    const { decide } = answerFirstOption();
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7) });
    expect(summary.placedCount).toBe(63);
    expect(getCell(grid, 3, 3).source).toBe("hand");
  });

  test("stops when the caller cancels", async () => {
    const { grid, plan } = gridWithPlan(size);
    const { decide } = answerFirstOption();
    const summary = await runBatchedGeneration({ grid, vocabulary, setting, plan, order: createOrder("spiral", { width: size, height: size, random: mulberry32(1) }), decide, random: mulberry32(7), isCancelled: () => true });
    expect(summary.status).toBe("cancelled");
    expect(summary.placedCount).toBe(0);
  });
});
