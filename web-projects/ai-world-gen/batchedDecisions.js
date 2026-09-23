// Every cell of the map as independent questions in one request.
//
// ADR 0002 sends one request per cell, because each decision reads the cells
// decided before it. The decisions endpoint takes `questions` as a map, and
// nothing says that map must hold one entry. This file asks the other
// question: what happens when the whole map goes in as one request, one typed
// question per cell, all answered at the same time?
//
// It is the third way to fill a grid (`wholeMap.js` is the second) and it
// exists to be measured against the per-cell loop on the same seeds (ADR
// 0005). It is not the default, and it is not meant to replace the loop.
//
// What a cell loses, and why it cannot be given back:
//   - the cells of its own batch. They are decided in the same request, so
//     they do not exist yet when the question is written. Every question in a
//     batch reads the map as it stood when the batch was built.
//   - the rules that depend on those cells: `neverNext`, `onlyNext`, the hard
//     cap and the continuation hints are all computed from the map at the
//     start of the batch, so two cells in one batch can each take the type
//     the other one rules out.
// Everything a cell does not lose, it keeps: the same `buildCellDecision`
// builds every question, so the world, the blueprint, the zone narrowing, the
// balance sheet and the map sketch are the ones the per-cell loop sends.
//
// This file is v11's request: the shared state, the instruction, the cells
// it hoists. The loop that sends the requests, the token estimate and the
// decider are in `batchLoop.js`, because older versions reuse them (see
// `evaluation/pastVersionVariants.js`). Nothing here touches the network.

import { batchInstructions, BATCH_TOKEN_BUDGET, cellQuestionKey, CHARS_PER_TOKEN, runBatchLoop } from "./batchLoop.js";
import { balanceSheet, buildCellDecision, mapSketch } from "./cellDecision.js";
import { cellKey, countByType } from "./grid.js";
import { describeSetting } from "./presets.js";

export {
  BATCH_TOKEN_BUDGET,
  CHARS_PER_TOKEN,
  MAX_INPUT_TOKENS,
  cellQuestionKey,
  createBatchDecider,
  estimateTokens,
  isTooManyTokens,
  readBatchAnswers,
  readCellQuestionKey,
} from "./batchLoop.js";

/**
 * How to choose, written once in the shared state rather than once per
 * question. It is the per-cell instruction with every "state.<x>" pointed at
 * the batch's own shape, plus the one thing that is true only here. It is the
 * same sentence for all 64 questions of an 8 × 8 map, and repeating it would
 * have cost 23,000 of the 56,000 input tokens such a request first measured.
 */
export const HOW_TO_CHOOSE = [
  "Which element type belongs in this cell of the map?",
  "state.cells[<this question's key>] is the cell: its coordinates, the part of the plan it belongs to,",
  "its placed neighbours, the types its hard rules rule out with the rule, what the world still lacks that",
  "the cell could hold, and the lines that reach it.",
  "Every question in this request is another cell of the same map, and they are all answered at the same time,",
  "so no cell of this request is in state.map yet: read state.cells to see where the other cells of this batch are,",
  "and do not put the same one-of-a-kind thing in two of them.",
  "state.map shows the map as it stands, one letter per cell (state.map.legend), rows from north to south.",
  "state.balance says how far each type is from its target share of the map.",
  "Follow each type's placement rules and keep the cell consistent with its placed neighbours.",
  "When the cell's continuations.suggested names a type, that type continues or closes a structure there and fits best,",
  "unless its rules forbid it in that place.",
  "When it is null, choose a type from state.balance.needed whose rules allow it there, avoid every type in",
  "state.balance.overused, and keep ground types in patches of several cells rather than single scattered cells.",
].join(" ");

/** The part of the state every question in a batch shares: the world, the map so far, and the balance sheet. */
function sharedState({ vocabulary, setting, grid }) {
  const placed = countByType(grid);
  const placedCells = Object.values(placed).reduce((sum, count) => sum + count, 0);
  // No cell is "this cell" in a batch, so the sketch is drawn with no marker.
  const map = mapSketch(grid, vocabulary, -1, -1);
  delete map.legend["?"];
  return {
    howToChoose: HOW_TO_CHOOSE,
    world: { name: vocabulary.name, summary: vocabulary.summary, setting: describeSetting(setting) },
    grid: { width: grid.width, height: grid.height, placedCells, totalCells: grid.width * grid.height },
    map,
    mapCounts: placed,
    balance: balanceSheet(vocabulary, placed, grid.width * grid.height),
    cells: {},
  };
}

/**
 * One request: the shared state, one entry per cell under `state.cells`, and
 * one typed question per cell. Every question is built by the same
 * `buildCellDecision` the per-cell loop uses, against the grid as it stands.
 *
 * @param {{vocabulary: object, setting: object, grid: object, coordinates: {x: number, y: number}[], plan?: object|null}} options
 * @returns {{state: object, questions: object}}
 */
export function buildBatch({ vocabulary, setting, grid, coordinates, plan = null }) {
  const state = sharedState({ vocabulary, setting, grid });
  const questions = {};
  for (const { x, y } of coordinates) {
    const key = cellQuestionKey(x, y);
    const one = buildCellDecision({ vocabulary, setting, grid, x, y, plan });
    state.cells[key] = {
      x,
      y,
      edges: one.state.cell.edges,
      zone: one.state.zone,
      neighbours: one.state.neighbours,
      nearbyCounts: one.state.nearbyCounts,
      excluded: one.state.excluded,
      missing: one.state.missing,
      continuations: one.state.continuations,
    };
    questions[key] = { type: "choice", instructions: batchInstructions(key, x, y), criteria: one.questions.type.criteria };
  }
  return { state, questions };
}

/**
 * The cells of the next batch: the order's own sequence, taken until the
 * request would pass the token budget. The order is asked with the cells of
 * this batch already counted as placed, so it walks the map exactly as it
 * would for the per-cell loop.
 *
 * @returns {{x: number, y: number}[]} at least one cell, unless the map is full
 */
export function planBatch({ vocabulary, setting, grid, order, plan = null, placed, budget = BATCH_TOKEN_BUDGET }) {
  const taken = new Set(placed);
  const coordinates = [];
  let characters = JSON.stringify(sharedState({ vocabulary, setting, grid })).length;
  const ceiling = budget * CHARS_PER_TOKEN;
  while (true) {
    const next = order.nextCoordinate(taken);
    if (next === null) return coordinates;
    const key = cellQuestionKey(next.x, next.y);
    const one = buildBatch({ vocabulary, setting, grid, coordinates: [next], plan });
    // The shared state is already counted, so only this cell's own two entries are added.
    const added = JSON.stringify(one.state.cells[key]).length + JSON.stringify(one.questions[key]).length + key.length * 2 + 8;
    if (coordinates.length > 0 && characters + added > ceiling) return coordinates;
    characters += added;
    coordinates.push(next);
    taken.add(cellKey(next.x, next.y));
  }
}

/**
 * Fill every empty cell of a grid with v11's batches: `planBatch` picks the
 * cells, `buildBatch` asks about them, and `runBatchLoop` does the rest.
 *
 * @param {object} options the options of `runBatchLoop`, plus the ones a v11 batch is built from
 * @param {object} options.setting
 * @param {{nextCoordinate: (placed: Set<string>) => {x: number, y: number} | null}} options.order
 * @param {object|null} [options.plan] the blueprint (`blueprint.js`)
 */
export function runBatchedGeneration({ grid, vocabulary, setting, order, plan = null, ...options }) {
  return runBatchLoop({
    grid,
    vocabulary,
    planCells: ({ placed, budget }) => planBatch({ vocabulary, setting, grid, order, plan, placed, budget }),
    buildRequest: (coordinates) => buildBatch({ vocabulary, setting, grid, coordinates, plan }),
    ...options,
  });
}
