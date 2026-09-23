import { describe, expect, test } from "bun:test";
import { cellQuestionKey, estimateTokens } from "../batchLoop.js";
import * as blueprint from "../blueprint.js";
import * as cellDecision from "../cellDecision.js";
import { createGrid, getCell, setCell } from "../grid.js";
import { createOrder } from "../orderStrategies.js";
import { presetVocabularyFor } from "../presetVocabularies.js";
import { cleanSetting, describeSetting, SETTING_PRESETS } from "../presets.js";
import { mulberry32 } from "../random.js";
import { buildWholeMapMessages, WHOLE_MAP_RULES } from "../wholeMap.js";
import {
  BATCH_NOTE,
  buildPastBatch,
  buildPastWholeMapMessages,
  letterLegend,
  planPastBatch,
  runPastBatchedGeneration,
  runPastWholeMapGeneration,
  versionNumber,
  wholeMapRulesFor,
} from "./pastVersionVariants.js";

const preset = SETTING_PRESETS.find((one) => one.id === "medieval-village");
const vocabulary = presetVocabularyFor(preset.id);
const setting = cleanSetting(preset);
// Today's modules stand in for a version's own: they are what v11 had.
const v11Modules = { ...cellDecision, ...blueprint, describeSetting };

function planFor(width, height, seed = 3) {
  return blueprint.planStructures({ vocabulary, width, height, random: mulberry32(seed ^ 0x51ed270b) });
}

describe("versionNumber", () => {
  test("reads the number of a loop version", () => {
    expect(versionNumber("v1")).toBe(1);
    expect(versionNumber("v11")).toBe(11);
  });

  test("refuses a name that is not a loop version", () => {
    expect(() => versionNumber("v11-llm")).toThrow();
    expect(() => versionNumber("v4-batch")).toThrow();
  });
});

describe("wholeMapRulesFor", () => {
  test("v11 gets exactly the rules the v11 prompt lists", () => {
    expect(wholeMapRulesFor(11)).toEqual(WHOLE_MAP_RULES);
  });

  test("v1 knew no share, no patches, no plan and no typed rule", () => {
    const rules = wholeMapRulesFor(1).join("\n");
    expect(rules).not.toContain("target share");
    expect(rules).not.toContain("patches");
    expect(rules).not.toContain("Walls close");
    expect(rules).not.toContain("never next to");
    expect(rules).toContain("do not over-use one type");
    expect(rules).toContain("Respect every placement rule.");
  });

  test("v4 adds the shares, the lines and the patches, but not the plan or 'exactly one'", () => {
    const rules = wholeMapRulesFor(4).join("\n");
    expect(rules).toContain("target share");
    expect(rules).toContain("a barrier line goes on until it closes a shape");
    expect(rules).toContain("patches");
    expect(rules).not.toContain("Walls close");
    expect(rules).not.toContain("exactly one");
    expect(rules).not.toContain("do not over-use one type");
  });

  test("v7 names the typed rules; v8 adds the plan and the inside or outside", () => {
    expect(wholeMapRulesFor(7).join("\n")).toContain("(never next to, only next to, one edge).");
    const v8 = wholeMapRulesFor(8).join("\n");
    expect(v8).toContain("Walls close");
    expect(v8).toContain("indoor or outdoor");
    expect(v8).not.toContain("from each door");
  });

  test("the reachability rule is in every version: the whole-map method asks for it, no version did", () => {
    for (const version of [1, 4, 7, 8, 11]) expect(wholeMapRulesFor(version).at(-1)).toContain("reachable");
  });
});

describe("letterLegend", () => {
  test("gives every type the letter the map sketch gives it", () => {
    expect(letterLegend(vocabulary)).toEqual(cellDecision.sketchLegend(vocabulary));
  });
});

describe("buildPastWholeMapMessages", () => {
  test("at v11, with v11's modules, it is the v11 prompt to the character", () => {
    for (const plan of [planFor(8, 8), planFor(16, 16, 9), null]) {
      const width = plan?.width ?? 8;
      const height = plan?.height ?? 8;
      const past = buildPastWholeMapMessages({ version: 11, vocabulary, setting, width, height, plan, modules: v11Modules });
      expect(past).toEqual(buildWholeMapMessages({ vocabulary, setting, width, height, plan }));
    }
  });

  test("before v2 there is no target share in the legend, and before v8 no plan", () => {
    const [, user] = buildPastWholeMapMessages({ version: 1, vocabulary, setting, width: 8, height: 8, plan: null, modules: { describeSetting } });
    expect(user.content).not.toContain("% of the map");
    expect(user.content).not.toContain("The plan.");
    expect(user.content).toContain("Rules for a good map:");
  });

  test("from v8 the plan is described with the version's own zone narrowing", () => {
    const plan = planFor(8, 8);
    const [, user] = buildPastWholeMapMessages({ version: 8, vocabulary, setting, width: 8, height: 8, plan, modules: v11Modules });
    expect(user.content).toContain("The plan. Code has already placed the structures");
    expect(user.content).toContain("% of the map");
  });

  test("a version that needs a module the checkout lacks is refused, not silently thinned", () => {
    expect(() => buildPastWholeMapMessages({ version: 4, vocabulary, setting, width: 8, height: 8, plan: null, modules: { describeSetting } })).toThrow(/targetShare/);
    expect(() =>
      buildPastWholeMapMessages({ version: 8, vocabulary, setting, width: 8, height: 8, plan: planFor(8, 8), modules: { describeSetting, targetShare: cellDecision.targetShare } }),
    ).toThrow(/zoneAt/);
  });
});

describe("buildPastBatch", () => {
  const request = (x, y, neighbours) => ({
    state: { world: { name: "W" }, cell: { x, y, gridWidth: 8, edges: x === 0 ? ["west"] : [] }, neighbours },
    questions: { type: { type: "choice", instructions: "Pick one.", criteria: { a: `A at ${x}`, b: "B" } } },
  });

  test("one question per cell, each with its own criteria and a pointer to its cell", () => {
    const batch = buildPastBatch({ asked: [{ x: 0, y: 0, request: request(0, 0, []) }, { x: 1, y: 0, request: request(1, 0, ["n"]) }] });
    expect(Object.keys(batch.questions)).toEqual([cellQuestionKey(0, 0), cellQuestionKey(1, 0)]);
    expect(batch.questions.cell_1_0.criteria).toEqual({ a: "A at 1", b: "B" });
    expect(batch.questions.cell_1_0.instructions).toContain("state.cells.cell_1_0");
  });

  test("what every cell shares is sent once; what differs stays with its cell, one level down too", () => {
    const batch = buildPastBatch({ asked: [{ x: 0, y: 0, request: request(0, 0, []) }, { x: 1, y: 0, request: request(1, 0, ["n"]) }] });
    expect(batch.state.world).toEqual({ name: "W" });
    // Both cells are on row 0, so y is shared too; each question still names its own (x, y).
    expect(batch.state.cell).toEqual({ y: 0, gridWidth: 8 });
    expect(batch.state.cells.cell_1_0).toEqual({ cell: { x: 1, edges: [] }, neighbours: ["n"] });
    expect(batch.state.cells.cell_0_0.cell).toEqual({ x: 0, edges: ["west"] });
  });

  test("the version's own instruction becomes the shared way to choose, with the batch note after it", () => {
    const batch = buildPastBatch({ asked: [{ x: 0, y: 0, request: request(0, 0, []) }, { x: 1, y: 0, request: request(1, 0, []) }] });
    expect(batch.state.howToChoose).toBe(`Pick one. ${BATCH_NOTE}`);
    expect(Object.keys(batch.state)[0]).toBe("howToChoose");
  });

  test("a shared map replaces each cell's own sketch", () => {
    const withMap = (x) => ({ ...request(x, 0, []), state: { ...request(x, 0, []).state, map: { rows: [`${x}`] } } });
    const batch = buildPastBatch({ asked: [{ x: 0, y: 0, request: withMap(0) }, { x: 1, y: 0, request: withMap(1) }], sharedMap: { rows: ["."] } });
    expect(batch.state.map).toEqual({ rows: ["."] });
    expect(batch.state.cells.cell_0_0.map).toBeUndefined();
  });
});

describe("planPastBatch", () => {
  test("takes the order's cells until the next one would pass the budget, and at least one", () => {
    const order = createOrder("spiral", { width: 4, height: 4, random: mulberry32(1) });
    const everything = planPastBatch({ order, placed: new Set(), budget: 1e9, estimate: (cells) => cells.length });
    expect(everything).toHaveLength(16);
    const three = planPastBatch({ order: createOrder("spiral", { width: 4, height: 4, random: mulberry32(1) }), placed: new Set(), budget: 3, estimate: (cells) => cells.length });
    expect(three).toEqual(everything.slice(0, 3));
    const one = planPastBatch({ order: createOrder("spiral", { width: 4, height: 4, random: mulberry32(1) }), placed: new Set(), budget: 0, estimate: (cells) => cells.length });
    expect(one).toHaveLength(1);
  });

  test("skips the cells already placed", () => {
    const placed = new Set(["0,0", "1,0"]);
    const cells = planPastBatch({ order: createOrder("spiral", { width: 4, height: 4, random: mulberry32(1) }), placed, budget: 1e9, estimate: (one) => one.length });
    expect(cells).toHaveLength(14);
    expect(cells.some((one) => one.x === 0 && one.y === 0)).toBe(false);
  });
});

/** A decisions endpoint that answers every question with its first option. */
function fakeDecide(log) {
  return async (request) => {
    log.push(request);
    const answers = {};
    for (const [key, question] of Object.entries(request.questions)) {
      const first = Object.keys(question.criteria)[0];
      answers[key] = { choice: first, confidence: 0.9, probabilities: { [first]: 0.9 } };
    }
    return { ok: true, answers, elapsedMs: 5, usage: { promptTokens: estimateTokens(request), completionTokens: 10, cost: 0.001 } };
  };
}

describe("runPastBatchedGeneration", () => {
  test("fills an 8 × 8 map from one request built from the version's own questions", async () => {
    const grid = createGrid(8, 8);
    const plan = planFor(8, 8);
    const log = [];
    const summary = await runPastBatchedGeneration({
      grid,
      vocabulary,
      setting,
      plan,
      order: createOrder("spiral", { width: 8, height: 8, random: mulberry32(2) }),
      modules: v11Modules,
      decide: fakeDecide(log),
      random: mulberry32(5),
    });
    expect(summary.status).toBe("done");
    expect(summary.modelCalls).toBe(1);
    expect(summary.decisionCount).toBe(64);
    expect(Object.keys(log[0].questions)).toHaveLength(64);
    // The same criteria the version's per-cell loop would have offered this cell.
    const alone = cellDecision.buildCellDecision({ vocabulary, setting, grid: createGrid(8, 8), x: 3, y: 3, plan });
    expect(log[0].questions.cell_3_3.criteria).toEqual(alone.questions.type.criteria);
    expect(log[0].state.map.legend["?"]).toBeUndefined();
    expect(getCell(grid, 7, 7).batch).toBe(1);
  });

  test("a version with no map sketch sends none", async () => {
    const { mapSketch, ...withoutSketch } = v11Modules;
    const log = [];
    const bare = {
      ...withoutSketch,
      buildCellDecision: (options) => {
        const one = cellDecision.buildCellDecision(options);
        delete one.state.map;
        return one;
      },
    };
    await runPastBatchedGeneration({
      grid: createGrid(4, 4),
      vocabulary,
      setting,
      order: createOrder("spiral", { width: 4, height: 4, random: mulberry32(2) }),
      modules: bare,
      decide: fakeDecide(log),
    });
    expect(log[0].state.map).toBeUndefined();
  });

  test("a 16 × 16 map takes more than one request, and a later one sees the cells of the first", async () => {
    const log = [];
    const summary = await runPastBatchedGeneration({
      grid: createGrid(16, 16),
      vocabulary,
      setting,
      plan: planFor(16, 16, 9),
      order: createOrder("spiral", { width: 16, height: 16, random: mulberry32(2) }),
      modules: v11Modules,
      decide: fakeDecide(log),
      random: mulberry32(5),
    });
    expect(summary.status).toBe("done");
    expect(summary.modelCalls).toBeGreaterThan(1);
    expect(log[1].state.map.rows.join("")).not.toMatch(/^\.+$/);
    for (const request of log) expect(estimateTokens(request)).toBeLessThanOrEqual(52000);
  });
});

describe("runPastWholeMapGeneration", () => {
  test("sends the version's prompt and writes the answer into the grid", async () => {
    const grid = createGrid(4, 4);
    setCell(grid, 0, 0, { typeId: vocabulary.elements[1].id, source: "model" });
    const sent = [];
    const { letterOf } = letterLegend(vocabulary);
    const row = letterOf[vocabulary.elements[0].id].repeat(4);
    const summary = await runPastWholeMapGeneration({
      version: 1,
      grid,
      vocabulary,
      setting,
      plan: null,
      modules: { describeSetting },
      generate: async (request) => {
        sent.push(request);
        return { ok: true, text: JSON.stringify({ rows: [row, row, row, row] }), elapsedMs: 3, usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.002 } };
      },
    });
    expect(summary.status).toBe("done");
    expect(summary.placedCount).toBe(15);
    expect(getCell(grid, 0, 0).typeId).toBe(vocabulary.elements[1].id);
    expect(sent[0].messages[1].content).not.toContain("% of the map");
    expect(sent[0].reasoning).toEqual({ enabled: false });
  });
});
