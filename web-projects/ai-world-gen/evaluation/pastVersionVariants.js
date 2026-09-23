// The two variants (the whole map in one call, every cell in one request),
// run with what an older version of the per-cell loop knew.
//
// `wholeMap.js` and `batchedDecisions.js` are v11's variants: they read v11's
// state, v11's rules and v11's blueprint. To learn whether a variant got
// better along with the loop, or was as good from the start, it has to run
// with the information each version gave Jev, and no more. This file builds
// that request from a version's own modules, handed in as `modules` by
// `variantRun.js`, which runs inside a checkout of that version's commit.
//
//   - Batched: every question is the version's own `buildCellDecision`,
//     unchanged. What all the cells of a batch share is sent once; the rest
//     stays with its cell. v11's hand-built batch hoists the same parts.
//   - Whole map: the v11 prompt, with only the parts the version had. Each
//     rule names the version that first gave it to Jev, in words or in code;
//     at v11 the prompt is v11's to the character (the tests pin it).
//
// It imports only the two shared loops and the grid key, because it is
// copied into an old checkout next to them.

import { BATCH_TOKEN_BUDGET, batchInstructions, cellQuestionKey, estimateTokens, runBatchLoop } from "../batchLoop.js";
import { cellKey } from "../grid.js";
import { describePlanWith, legendLines, runWholeMapLoop, writeWholeMapMessages } from "../wholeMapLoop.js";

/** The number of a loop version: `v4` is 4. The variants themselves are not loop versions. */
export function versionNumber(name) {
  const match = /^v(\d+)$/.exec(String(name ?? ""));
  if (match === null) throw new Error(`"${name}" is not a version of the per-cell loop (v1, v2, ...).`);
  return Number(match[1]);
}

/**
 * The rules for a good map, each with the versions whose per-cell loop gave
 * it to Jev. The order is the v11 prompt's order. `until` is the last version
 * that had it, when a later version worded it differently or dropped it.
 */
const RULES = [
  { since: 8, text: "- Walls close around each planned inside; a door is set into a wall, only where the plan says." },
  // v3 asked for lines in words; v4 moved the judgement into code. v9 added the route to each door.
  { since: 3, until: 8, text: "- Structures first: a barrier line goes on until it closes a shape; a route (paths, roads, corridors) goes on until it reaches a place." },
  { since: 9, text: "- Routes (paths, roads, corridors) are continuous lines that lead from each door to the edge of the map, never scattered single cells and never a flood." },
  { since: 4, text: "- Ground types come in patches of several cells, not confetti." },
  { since: 9, text: "- A type whose rules say exactly one appears exactly once; a type marked rare appears once or twice." },
  // v1 and v2 asked for variety in words, before the balance sheet was in the instruction.
  { since: 1, until: 2, text: "- Keep the map varied and believable for this world, and do not over-use one type." },
  { since: 1, until: 2, text: "- Where nothing else is needed, prefer the most common ground type." },
  { since: 1, until: 6, text: "- Respect every placement rule." },
  { since: 7, until: 7, text: "- Respect every placement rule (never next to, only next to, one edge)." },
  { since: 8, text: "- Respect every placement rule (never next to, only next to, one edge, indoor or outdoor)." },
  { since: 2, text: "- Keep each type close to its target share of the map, so no type floods it." },
  // No version told Jev this: the per-cell loop cannot see the whole map. The whole-map method asks it of every version.
  { since: 1, text: "- Every walkable cell should be reachable from every other walkable cell through walkable cells and doors." },
];

/** The "Rules for a good map" lines a version's whole-map prompt carries. */
export function wholeMapRulesFor(version) {
  return RULES.filter((rule) => version >= rule.since && version <= (rule.until ?? Infinity)).map((rule) => rule.text);
}

const SKETCH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SKETCH_UNKNOWN = "!";

/** One letter per type, by its place in the vocabulary: the same letters every version's map sketch uses. */
export function letterLegend(vocabulary) {
  const letterOf = {};
  const legend = {};
  vocabulary.elements.forEach((type, index) => {
    const letter = SKETCH_LETTERS[index] ?? SKETCH_UNKNOWN;
    letterOf[type.id] = letter;
    legend[letter] = type.id;
  });
  return { letterOf, legend };
}

function need(modules, name, version) {
  if (typeof modules[name] !== "function") throw new Error(`v${version} needs ${name}, and the checkout has none: the variant would know less than the version did.`);
  return modules[name];
}

/**
 * The whole-map prompt a version could have written: its vocabulary, its
 * target shares from v2, its blueprint from v8, and the rules it knew.
 *
 * @param {{version: number, vocabulary: object, setting: object, width: number, height: number, plan: object|null, modules: object}} options
 * `modules` holds the version's own `describeSetting`, `targetShare`, `zoneAt` and `zoneAllowedTypes`
 */
export function buildPastWholeMapMessages({ version, vocabulary, setting, width, height, plan = null, modules }) {
  const { letterOf } = letterLegend(vocabulary);
  const shareOf = version >= 2 ? need(modules, "targetShare", version) : null;
  const planLines =
    version >= 8
      ? describePlanWith({ vocabulary, plan, width, height, letterOf, zoneAt: need(modules, "zoneAt", version), zoneAllowedTypes: need(modules, "zoneAllowedTypes", version) })
      : null;
  return writeWholeMapMessages({
    vocabulary,
    settingText: need(modules, "describeSetting", version)(setting),
    width,
    height,
    legend: legendLines(vocabulary, letterOf, shareOf),
    planLines,
    rules: wholeMapRulesFor(version),
  });
}

/** Fill every empty cell from one text-model answer to a version's whole-map prompt. Other options go to `runWholeMapLoop`. */
export function runPastWholeMapGeneration({ version, grid, vocabulary, setting, plan = null, modules, ...options }) {
  const messages = buildPastWholeMapMessages({ version, vocabulary, setting, width: grid.width, height: grid.height, plan, modules });
  return runWholeMapLoop({ grid, messages, legend: letterLegend(vocabulary).legend, ...options });
}

/**
 * What a batch adds to the version's own instruction. The same words as v11's
 * batch note, plus where a batch puts the fields the instruction names.
 */
export const BATCH_NOTE = [
  "Every question in this request is another cell of the same map, and they are all answered at the same time,",
  "so no cell of this request is placed yet: read state.cells to see where the other cells of this batch are,",
  "and do not put the same one-of-a-kind thing in two of them.",
  "A field of state that differs from cell to cell is in state.cells[<this question's key>]; a field every cell of the batch shares is sent once, in state.",
].join(" ");

/** Added when the cells share one map sketch, which marks no cell with '?'. */
const SHARED_MAP_NOTE = "state.map marks no cell with '?': it is the map as it stands, and this cell is at the coordinates in its state.cells entry.";

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const allSame = (values) => values.every((value) => JSON.stringify(value) === JSON.stringify(values[0]));

function keysOf(objects) {
  const keys = [];
  for (const one of objects) for (const key of Object.keys(one)) if (!keys.includes(key)) keys.push(key);
  return keys;
}

/**
 * One request from the version's own per-cell requests. A state field every
 * cell has the same value for is sent once; one that differs stays with its
 * cell, and an object that differs is split one level down the same way.
 * `sharedMap`, when given, replaces each cell's own map sketch.
 *
 * @param {{asked: {x: number, y: number, request: {state: object, questions: object}}[], sharedMap?: object|null}} options
 * @returns {{state: object, questions: object}}
 */
export function buildPastBatch({ asked, sharedMap = null }) {
  const states = asked.map((one) => one.request.state);
  const keys = asked.map((one) => cellQuestionKey(one.x, one.y));
  const shared = {};
  const cells = Object.fromEntries(keys.map((key) => [key, {}]));
  for (const field of keysOf(states)) {
    if (field === "map" && sharedMap !== null) {
      shared.map = sharedMap;
      continue;
    }
    const values = states.map((state) => state[field]);
    if (allSame(values)) {
      shared[field] = values[0];
      continue;
    }
    if (!values.every(isPlainObject)) {
      values.forEach((value, index) => (cells[keys[index]][field] = value));
      continue;
    }
    const common = {};
    for (const part of keysOf(values)) {
      const parts = values.map((value) => value[part]);
      if (allSame(parts)) common[part] = parts[0];
      else parts.forEach((value, index) => ((cells[keys[index]][field] ??= {})[part] = value));
    }
    if (Object.keys(common).length > 0) shared[field] = common;
  }

  const instructions = asked.map((one) => one.request.questions.type.instructions);
  const oneInstruction = allSame(instructions);
  const note = shared.map === sharedMap && sharedMap !== null ? `${BATCH_NOTE} ${SHARED_MAP_NOTE}` : BATCH_NOTE;
  const questions = {};
  asked.forEach((one, index) => {
    const pointer = batchInstructions(keys[index], one.x, one.y);
    questions[keys[index]] = {
      type: "choice",
      instructions: oneInstruction ? pointer : `${pointer} ${instructions[index]}`,
      criteria: one.request.questions.type.criteria,
    };
  });
  return { state: { howToChoose: oneInstruction ? `${instructions[0]} ${note}` : note, ...shared, cells }, questions };
}

/**
 * The cells of the next batch: the order's own sequence, taken until the next
 * cell would pass the budget, and at least one. The order is asked one cell
 * at a time, as v11's `planBatch` asks it, so a stateful order walks the map
 * the same way in both.
 *
 * @param {{order: object, placed: Set<string>, budget: number, estimate: (coordinates: {x: number, y: number}[]) => number}} options
 */
export function planPastBatch({ order, placed, budget, estimate }) {
  const taken = new Set(placed);
  const coordinates = [];
  while (true) {
    const next = order.nextCoordinate(taken);
    if (next === null) return coordinates;
    if (coordinates.length > 0 && estimate([...coordinates, next]) > budget) return coordinates;
    coordinates.push(next);
    taken.add(cellKey(next.x, next.y));
  }
}

/**
 * Fill every empty cell with batches of a version's own questions.
 * `modules` holds the version's `buildCellDecision`, and its `mapSketch` when
 * it had one (v5). Other options go to `runBatchLoop`.
 */
export function runPastBatchedGeneration({ grid, vocabulary, setting, order, plan = null, modules, budget = BATCH_TOKEN_BUDGET, ...options }) {
  const buildCellDecision = modules.buildCellDecision;
  // The grid does not change while a batch is planned and built, so each cell is asked once per batch.
  let asked = new Map();
  let sharedMap;
  const ask = (x, y) => {
    const key = cellKey(x, y);
    if (!asked.has(key)) asked.set(key, buildCellDecision({ vocabulary, setting, grid, x, y, plan }));
    return asked.get(key);
  };
  const mapNow = () => {
    if (sharedMap !== undefined) return sharedMap;
    sharedMap = null;
    if (typeof modules.mapSketch === "function") {
      sharedMap = modules.mapSketch(grid, vocabulary, -1, -1);
      delete sharedMap.legend["?"];
    }
    return sharedMap;
  };
  const build = (coordinates) => buildPastBatch({ asked: coordinates.map(({ x, y }) => ({ x, y, request: ask(x, y) })), sharedMap: mapNow() });
  return runBatchLoop({
    grid,
    vocabulary,
    budget,
    planCells: ({ placed, budget: room }) => {
      asked = new Map();
      sharedMap = undefined;
      return planPastBatch({ order, placed, budget: room, estimate: (coordinates) => estimateTokens(build(coordinates)) });
    },
    buildRequest: build,
    ...options,
  });
}
