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
// Nothing here touches the network. `decide` is handed in, and
// `createBatchDecider` builds one from the client.

import { balanceSheet, buildCellDecision, chooseType, fallbackType, mapSketch } from "./cellDecision.js";
import { FATAL_STATUSES } from "./generation.js";
import { cellKey, countByType, placedKeys, setCell } from "./grid.js";
import { describeSetting } from "./presets.js";

/**
 * What the decisions endpoint accepts, measured on 2026-09-22 with the real
 * key: 128 cell questions at 60,023 input tokens are answered, 160 at about
 * 71,600 are refused with `max_tokens_exceeded`. The ceiling reads as 65,536.
 */
export const MAX_INPUT_TOKENS = 65536;

/** How many input tokens one batch is built up to, with room for the estimate to be wrong. */
export const BATCH_TOKEN_BUDGET = 52000;

/**
 * Characters of request JSON per input token. Measured on a real batch: an
 * 8 × 8 map is 113,638 characters and 38,897 input tokens. The thinner probe
 * requests read 3.19 to 3.26, so the lower number is used and a batch comes
 * out a little smaller than it had to be.
 */
export const CHARS_PER_TOKEN = 2.9;

const RETRY_BASE_MS = 800;

/** How much of a refused batch is attempted next. Below 1, so the next try is smaller. */
const SHRINK_AFTER_REFUSAL = 0.6;

/** The key of one cell's question. The coordinates are in it, so an answer needs no lookup table. */
export function cellQuestionKey(x, y) {
  return `cell_${x}_${y}`;
}

/** The cell a question key names, or null when the key is not one. */
export function readCellQuestionKey(key) {
  const match = /^cell_(\d+)_(\d+)$/.exec(String(key ?? ""));
  return match === null ? null : { x: Number(match[1]), y: Number(match[2]) };
}

/** How many input tokens a request is worth, by its characters. */
export function estimateTokens(value) {
  return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);
}

/** Whether a failure is the endpoint saying the request was too big, rather than anything else. */
export function isTooManyTokens(failure) {
  if (!failure || failure.status !== 400) return false;
  return /max[_ ]tokens[_ ]exceeded|max tokens exceeded/i.test(String(failure.message ?? ""));
}

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

/** One question's own line: which cell it is, and where to read the rest. */
function batchInstructions(key, x, y) {
  return `Which element type belongs in cell (${x}, ${y})? state.howToChoose says how to choose; state.cells.${key} is this cell.`;
}

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
 * The answers of one batch, one per cell question, read the same way the
 * per-cell loop reads its single answer.
 * @returns {Record<string, {choice: string, confidence: number, probabilities: Record<string, number>} | null>}
 */
export function readBatchAnswers(payload, vocabulary) {
  const answers = payload?.answers;
  if (!answers || typeof answers !== "object") return {};
  const read = {};
  for (const key of Object.keys(answers)) {
    if (readCellQuestionKey(key) === null) continue;
    // One question named `type`, so the per-cell reader is reused by renaming the key.
    read[key] = readDecisionAnswerFor(answers[key], vocabulary);
  }
  return read;
}

function readDecisionAnswerFor(answer, vocabulary) {
  const choice = typeof answer?.choice === "string" ? answer.choice : "";
  if (!vocabulary.elements.some((one) => one.id === choice)) return null;
  const probabilities = {};
  for (const [id, value] of Object.entries(answer?.probabilities ?? {})) {
    const number = Number(value);
    if (vocabulary.elements.some((one) => one.id === id) && Number.isFinite(number) && number >= 0) probabilities[id] = number;
  }
  const confidence = Number.isFinite(Number(answer?.confidence)) ? Number(answer.confidence) : (probabilities[choice] ?? 0);
  return { choice, confidence, probabilities };
}

function readUsage(usage) {
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  return { promptTokens: number(usage?.promptTokens), completionTokens: number(usage?.completionTokens), cost: number(usage?.cost) };
}

/**
 * Fill every empty cell of a grid with batched decisions.
 *
 * @param {object} options
 * @param {import("./grid.js").Grid} options.grid mutated in place; cells already decided are kept
 * @param {object} options.vocabulary
 * @param {object} options.setting
 * @param {{nextCoordinate: (placed: Set<string>) => {x: number, y: number} | null}} options.order
 * @param {(request: {state: object, questions: object}) => Promise<object>} options.decide `{ok: true, answers, elapsedMs, usage} | {ok: false, status, message}`
 * @param {object|null} [options.plan] the blueprint (`blueprint.js`)
 * @param {number} [options.budget] input tokens per batch
 * @returns {Promise<object>} the summary `runGeneration` returns, plus `modelCalls`, `requests`, `decisionCount`, `batches` and `usage`
 */
export async function runBatchedGeneration({
  grid,
  vocabulary,
  setting,
  order,
  decide,
  plan = null,
  budget = BATCH_TOKEN_BUDGET,
  random = Math.random,
  onCell = () => {},
  onBatch = () => {},
  isCancelled = () => false,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  maxRetries = 2,
  spread = 1,
}) {
  const placed = placedKeys(grid);
  const total = grid.width * grid.height;
  const started = now();
  const usage = { promptTokens: 0, completionTokens: 0, cost: 0 };
  const batches = [];
  let index = placed.size;
  let placedCount = 0;
  let fallbackCount = 0;
  let modelMs = 0;
  let modelCalls = 0;
  let requests = 0;
  let decisionCount = 0;
  let room = budget;

  const finish = (status, extra = {}) => ({
    status,
    placedCount,
    fallbackCount,
    elapsedMs: now() - started,
    averageMs: modelCalls > 0 ? modelMs / modelCalls : 0,
    modelCalls,
    requests,
    decisionCount,
    batches,
    usage,
    mode: "batched",
    ...extra,
  });

  while (true) {
    if (isCancelled()) return finish("cancelled");
    const coordinates = planBatch({ vocabulary, setting, grid, order, plan, placed, budget: room });
    if (coordinates.length === 0) return finish("done");

    const request = buildBatch({ vocabulary, setting, grid, coordinates, plan });
    const estimated = estimateTokens(request);
    let result = null;
    let failure = null;
    let refused = false;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      requests += 1;
      const answer = await decide(request);
      if (answer.ok) {
        result = answer;
        break;
      }
      failure = answer;
      if (FATAL_STATUSES.includes(failure.status)) return finish("failed", { failure, at: coordinates[0] });
      if (isTooManyTokens(failure)) {
        refused = true;
        break;
      }
      if (attempt < maxRetries) await sleep(RETRY_BASE_MS * 2 ** attempt);
    }

    if (refused) {
      // One cell that is still too big cannot be split any further.
      if (coordinates.length === 1) return finish("failed", { failure, at: coordinates[0] });
      room = Math.max(1, Math.floor(estimated * SHRINK_AFTER_REFUSAL));
      continue;
    }
    if (!result) return finish("failed", { failure: failure ?? { status: 0, message: "no answer" }, at: coordinates[0] });

    modelCalls += 1;
    modelMs += Number.isFinite(result.elapsedMs) ? result.elapsedMs : 0;
    const used = readUsage(result.usage);
    usage.promptTokens += used.promptTokens;
    usage.completionTokens += used.completionTokens;
    usage.cost += used.cost;

    const answers = result.answers ?? {};
    let answered = 0;
    for (const { x, y } of coordinates) {
      const key = cellQuestionKey(x, y);
      const answer = answers[key] ?? null;
      let cell;
      if (answer) {
        answered += 1;
        const typeId = chooseType({ choice: answer.choice, probabilities: answer.probabilities, spread, random });
        cell = {
          typeId,
          confidence: answer.probabilities[typeId] ?? answer.confidence,
          modelChoice: answer.choice,
          probabilities: answer.probabilities,
          source: "model",
          elapsedMs: result.elapsedMs ?? 0,
          attempts: 1,
          batch: modelCalls,
        };
      } else {
        fallbackCount += 1;
        cell = {
          typeId: fallbackType({ vocabulary, grid, x, y, random }),
          confidence: 0,
          modelChoice: null,
          probabilities: {},
          source: "fallback",
          elapsedMs: 0,
          attempts: 1,
          batch: modelCalls,
          error: "the batch came back without this cell",
        };
      }
      setCell(grid, x, y, cell);
      placed.add(cellKey(x, y));
      placedCount += 1;
      onCell({ x, y, cell, index, total });
      index += 1;
    }
    decisionCount += coordinates.length;
    batches.push({ cells: coordinates.length, answered, estimatedTokens: estimated, promptTokens: used.promptTokens, elapsedMs: result.elapsedMs ?? 0 });
    onBatch({ batch: modelCalls, cells: coordinates.length, answered, placedCount, total });
  }
}

/**
 * A batched `decide` for one decision model, built from the client. The
 * request is the one `buildBatch` returns; the answer names every cell.
 */
export function createBatchDecider({ client, apiKey, model, vocabulary }) {
  return async ({ state, questions }) => {
    const result = await client.decide({ apiKey, model, state, questions });
    if (!result.ok) return result;
    const usage = result.data?.usage ?? null;
    return {
      ok: true,
      answers: readBatchAnswers(result.data, vocabulary),
      elapsedMs: result.elapsedMs ?? 0,
      usage: { promptTokens: Number(usage?.input_tokens ?? 0), completionTokens: Number(usage?.output_tokens ?? 0), cost: Number(usage?.cost ?? 0) },
    };
  };
}
