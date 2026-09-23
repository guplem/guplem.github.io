// The half of batching that does not depend on how a version asks about a cell.
//
// `batchedDecisions.js` builds v11's batch: its own shared state, its own
// instruction, the cells it hoists. This file is everything around that
// request: the question keys, the token estimate, the endpoint's ceiling, the
// loop that sends batches and writes the answers, and the decider. The loop is
// handed two functions, `planCells` and `buildRequest`, so the same loop runs
// v11's batches and the batches `evaluation/pastVersionVariants.js` builds from
// an older version's own questions.
//
// It imports only what every version since v1 has (`chooseType`,
// `fallbackType`, `FATAL_STATUSES`, the grid helpers), because the evaluation
// copies it into a checkout of an old commit and runs it there. The version's
// own `chooseType` then samples the answers, sampling floor and all.

import { chooseType, fallbackType } from "./cellDecision.js";
import { FATAL_STATUSES } from "./generation.js";
import { cellKey, placedKeys, setCell } from "./grid.js";

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

/** One question's own line: which cell it is, and where to read the rest. */
export function batchInstructions(key, x, y) {
  return `Which element type belongs in cell (${x}, ${y})? state.howToChoose says how to choose; state.cells.${key} is this cell.`;
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
 * @param {(request: {placed: Set<string>, budget: number}) => {x: number, y: number}[]} options.planCells the cells of the next batch, at least one unless the map is full
 * @param {(coordinates: {x: number, y: number}[]) => {state: object, questions: object}} options.buildRequest one request for those cells, against the grid as it stands
 * @param {(request: {state: object, questions: object}) => Promise<object>} options.decide `{ok: true, answers, elapsedMs, usage} | {ok: false, status, message}`
 * @param {number} [options.budget] input tokens per batch
 * @returns {Promise<object>} the summary `runGeneration` returns, plus `modelCalls`, `requests`, `decisionCount`, `batches` and `usage`
 */
export async function runBatchLoop({
  grid,
  vocabulary,
  planCells,
  buildRequest,
  decide,
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
    const coordinates = planCells({ placed, budget: room });
    if (coordinates.length === 0) return finish("done");

    const request = buildRequest(coordinates);
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
 * request is the one `buildRequest` returns; the answer names every cell.
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
