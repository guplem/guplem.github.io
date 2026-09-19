import { describe, expect, test } from "bun:test";
import { FATAL_STATUSES, createDecider, runGeneration } from "./generation.js";
import { createGrid, getCell, placedKeys } from "./grid.js";
import { createOrder } from "./orderStrategies.js";
import { mulberry32 } from "./random.js";

const vocabulary = {
  name: "Ashford",
  summary: "A village.",
  elements: [
    { id: "grass", label: "Grass", description: "Open grass.", placementRules: "Most common.", walkable: true, interactable: false, isBarrier: false, visualTag: "grass", instanceFields: [] },
    { id: "wall", label: "Wall", description: "A wall.", placementRules: "Around houses.", walkable: false, interactable: false, isBarrier: true, visualTag: "stone-wall", instanceFields: [] },
  ],
};
const setting = { location: "A village", era: "", notes: "" };
const noSleep = async () => {};

const answer = (choice, probabilities = { [choice]: 1 }) => ({ ok: true, answer: { choice, confidence: probabilities[choice], probabilities }, elapsedMs: 5 });

function run(decide, { width = 3, height = 2, ...rest } = {}) {
  const grid = createGrid(width, height);
  const order = createOrder("spiral", { width, height, random: mulberry32(1) });
  return runGeneration({ grid, vocabulary, setting, order, decide, random: mulberry32(2), sleep: noSleep, ...rest }).then((summary) => ({ grid, summary }));
}

describe("runGeneration", () => {
  test("fills every cell, one decision each, and reports each one as it lands", async () => {
    const seen = [];
    const calls = [];
    const decide = async (request) => {
      calls.push(request);
      return answer("grass");
    };
    const { grid, summary } = await run(decide, { onCell: (event) => seen.push(event) });
    expect(calls.length).toBe(6);
    expect(placedKeys(grid).size).toBe(6);
    expect(seen.map((one) => one.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(seen[0].total).toBe(6);
    expect(summary.status).toBe("done");
    expect(summary.placedCount).toBe(6);
    expect(summary.fallbackCount).toBe(0);
    expect(getCell(grid, 1, 0)).toMatchObject({ typeId: "grass", source: "model", confidence: 1 });
  });

  test("each decision sees what was placed before it", async () => {
    const neighbourCounts = [];
    const decide = async ({ state }) => {
      neighbourCounts.push(state.neighbours.length);
      return answer("grass");
    };
    await run(decide);
    expect(neighbourCounts[0]).toBe(0);
    expect(neighbourCounts.at(-1)).toBeGreaterThan(0);
  });

  test("retries a transient failure with a pause, then goes on", async () => {
    let calls = 0;
    const pauses = [];
    const decide = async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 429, message: "slow down" } : answer("grass");
    };
    const { summary } = await run(decide, { sleep: async (ms) => pauses.push(ms) });
    expect(summary.status).toBe("done");
    expect(summary.fallbackCount).toBe(0);
    expect(pauses.length).toBe(1);
    expect(pauses[0]).toBeGreaterThan(0);
  });

  test("after the retries a cell gets a fallback type and the run continues", async () => {
    let calls = 0;
    const decide = async () => {
      calls += 1;
      return calls <= 3 ? { ok: false, status: 502, message: "provider down" } : answer("wall");
    };
    const { grid, summary } = await run(decide, { maxRetries: 2 });
    expect(summary.status).toBe("done");
    expect(summary.fallbackCount).toBe(1);
    const first = getCell(grid, 1, 0);
    expect(first.source).toBe("fallback");
    expect(first.typeId).toBe("grass");
    expect(first.error).toContain("provider down");
  });

  test("an unreadable answer counts as a failure, not a crash", async () => {
    let calls = 0;
    const decide = async () => {
      calls += 1;
      return calls === 1 ? { ok: true, answer: null, elapsedMs: 3 } : answer("grass");
    };
    const { summary } = await run(decide, { maxRetries: 0 });
    expect(summary.status).toBe("done");
    expect(summary.fallbackCount).toBe(1);
  });

  test("a bad key or empty credits stops the whole run at once", async () => {
    let calls = 0;
    const decide = async () => {
      calls += 1;
      return { ok: false, status: 401, message: "bad key" };
    };
    const { grid, summary } = await run(decide);
    expect(calls).toBe(1);
    expect(summary.status).toBe("failed");
    expect(summary.failure.status).toBe(401);
    expect(placedKeys(grid).size).toBe(0);
    expect(FATAL_STATUSES).toEqual([401, 402, 403, 404]);
  });

  test("too many failures in a row stop the run, so a dead model does not fill a map with fallbacks", async () => {
    const decide = async () => ({ ok: false, status: 502, message: "down" });
    const { summary } = await run(decide, { maxRetries: 0, width: 6, height: 6 });
    expect(summary.status).toBe("failed");
    expect(summary.placedCount).toBeLessThan(36);
    expect(summary.placedCount).toBeGreaterThan(0);
  });

  test("stops when asked, and says so", async () => {
    let calls = 0;
    const decide = async () => {
      calls += 1;
      return answer("grass");
    };
    const { summary } = await run(decide, { isCancelled: () => calls >= 2 });
    expect(summary.status).toBe("cancelled");
    expect(summary.placedCount).toBe(2);
  });

  test("skips cells that are already decided", async () => {
    const grid = createGrid(2, 2);
    grid.cells[0] = { typeId: "wall", source: "hand" };
    const order = createOrder("random", { width: 2, height: 2, random: mulberry32(1) });
    let calls = 0;
    const decide = async () => {
      calls += 1;
      return answer("grass");
    };
    const summary = await runGeneration({ grid, vocabulary, setting, order, decide, random: mulberry32(1), sleep: noSleep });
    expect(calls).toBe(3);
    expect(summary.placedCount).toBe(3);
    expect(grid.cells[0].typeId).toBe("wall");
  });

  test("samples the probabilities, so a mildly sure model gives a mixed map", async () => {
    const decide = async () => answer("grass", { grass: 0.6, wall: 0.4 });
    const { grid } = await run(decide, { width: 10, height: 10 });
    const walls = grid.cells.filter((cell) => cell.typeId === "wall").length;
    expect(walls).toBeGreaterThan(15);
    expect(walls).toBeLessThan(65);
  });

  test("reports the timing", async () => {
    const decide = async () => answer("grass");
    const { summary } = await run(decide, { now: (() => { let t = 0; return () => (t += 100); })() });
    expect(summary.elapsedMs).toBeGreaterThan(0);
    expect(summary.averageMs).toBeGreaterThan(0);
  });
});

describe("createDecider", () => {
  const request = { state: { cell: { x: 0, y: 0 } }, questions: { type: { type: "choice", instructions: "pick", criteria: { grass: "g", wall: "w" } } } };

  test("with the decisions transport it calls the client's decide and reads the answer", async () => {
    const calls = [];
    const client = {
      decide: async (options) => {
        calls.push(options);
        return { ok: true, data: { answers: { type: { choice: "wall", confidence: 0.9, probabilities: { wall: 0.9, grass: 0.1 } } } }, elapsedMs: 42 };
      },
      generate: async () => {
        throw new Error("must not be called");
      },
    };
    const decide = createDecider({ client, transport: "decisions", apiKey: "k", model: "~typesafe/jev-latest", vocabulary });
    const result = await decide(request);
    expect(result).toEqual({ ok: true, answer: { choice: "wall", confidence: 0.9, probabilities: { wall: 0.9, grass: 0.1 } }, elapsedMs: 42 });
    expect(calls[0]).toMatchObject({ apiKey: "k", model: "~typesafe/jev-latest", state: request.state, questions: request.questions });
  });

  test("with the chat transport it asks the text model and reads its JSON", async () => {
    const client = {
      decide: async () => {
        throw new Error("must not be called");
      },
      generate: async ({ messages, jsonSchema }) => {
        expect(jsonSchema.required).toEqual(["typeId", "confidence"]);
        expect(messages.at(-1).content).toContain("pick");
        return { ok: true, text: '{"typeId":"grass","confidence":0.7}', elapsedMs: 900 };
      },
    };
    const decide = createDecider({ client, transport: "chat", apiKey: "k", model: "openai/gpt-5-nano", vocabulary });
    expect(await decide(request)).toEqual({ ok: true, answer: { choice: "grass", confidence: 0.7, probabilities: { grass: 0.7 } }, elapsedMs: 900 });
  });

  test("a transport failure is passed through untouched", async () => {
    const client = { decide: async () => ({ ok: false, status: 429, message: "wait" }) };
    const decide = createDecider({ client, transport: "decisions", apiKey: "k", model: "m", vocabulary });
    expect(await decide(request)).toEqual({ ok: false, status: 429, message: "wait" });
  });
});
