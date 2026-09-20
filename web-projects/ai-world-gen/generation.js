// The generation loop: ask the order for a cell, ask the model for its type,
// write the answer into the grid, tell the page, repeat.
//
// It is sequential on purpose. Every decision reads the cells decided before
// it (ADR 0002), and the visible per-cell latency is the demo: a map that
// fills in one tile at a time, in front of the person who described it.
//
// Nothing here touches the network. `decide` is handed in, and `createDecider`
// below builds it from the client and the chosen transport, so this loop is
// tested with a fake model and the client is tested by nobody (root ADR 0012).
//
// Failure policy, because a beta endpoint and venue wifi are both expected:
//   - a transient failure (no answer, 429, 5xx) is retried with a growing pause;
//   - when the retries run out, the cell gets a fallback type, marked as such;
//   - a failure that will repeat on every cell (a bad key, no credits, a model
//     that is not served) stops the run at once;
//   - too many failures in a row stop the run too, so a dead provider does not
//     produce a map made of fallbacks.

import { buildCellDecision, buildChatDecisionMessages, CHAT_DECISION_SCHEMA, chooseType, fallbackType, readChatDecision, readDecisionAnswer } from "./cellDecision.js";
import { placedKeys, setCell, cellKey } from "./grid.js";

/** A status that will not change from one cell to the next, so the run stops. */
export const FATAL_STATUSES = [401, 402, 403, 404];

/** How many failed cells in a row end the run. */
export const MAX_CONSECUTIVE_FAILURES = 4;

const RETRY_BASE_MS = 800;

/**
 * Decide every empty cell of a grid.
 *
 * @param {object} options
 * @param {import("./grid.js").Grid} options.grid mutated in place
 * @param {object} options.vocabulary
 * @param {object} options.setting
 * @param {{nextCoordinate: (placed: Set<string>) => {x: number, y: number} | null}} options.order
 * @param {(request: {state: object, questions: object}) => Promise<object>} options.decide
 * @param {() => number} [options.random]
 * @param {(event: object) => void} [options.onCell]
 * @param {() => boolean} [options.isCancelled]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.now]
 * @param {number} [options.maxRetries]
 * @param {number} [options.spread] 0 places the most likely type, 1 samples the probabilities
 * @param {object|null} [options.plan] the blueprint of the structures (`blueprint.js`); null means no structure
 */
export async function runGeneration({
  grid,
  vocabulary,
  setting,
  order,
  decide,
  plan = null,
  random = Math.random,
  onCell = () => {},
  isCancelled = () => false,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  maxRetries = 2,
  spread = 1,
}) {
  const placed = placedKeys(grid);
  const total = grid.width * grid.height;
  const started = now();
  let index = placed.size;
  let placedCount = 0;
  let fallbackCount = 0;
  let consecutiveFailures = 0;
  let modelMs = 0;
  let modelCalls = 0;

  const finish = (status, extra = {}) => {
    const elapsedMs = now() - started;
    return { status, placedCount, fallbackCount, elapsedMs, averageMs: modelCalls > 0 ? modelMs / modelCalls : 0, ...extra };
  };

  while (true) {
    if (isCancelled()) return finish("cancelled");
    const next = order.nextCoordinate(placed);
    if (next === null) return finish("done");

    const { x, y } = next;
    const request = buildCellDecision({ vocabulary, setting, grid, x, y, plan });
    let result = null;
    let failure = null;
    let attempts = 0;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      attempts += 1;
      const answer = await decide(request);
      if (answer.ok && answer.answer) {
        result = answer;
        break;
      }
      failure = answer.ok ? { ok: false, status: 0, message: "The model gave an answer that names no type in the vocabulary." } : answer;
      if (FATAL_STATUSES.includes(failure.status)) return finish("failed", { failure, at: { x, y } });
      if (attempt < maxRetries) await sleep(RETRY_BASE_MS * 2 ** attempt);
    }

    let cell;
    if (result) {
      consecutiveFailures = 0;
      modelCalls += 1;
      modelMs += Number.isFinite(result.elapsedMs) ? result.elapsedMs : 0;
      const typeId = chooseType({ choice: result.answer.choice, probabilities: result.answer.probabilities, spread, random });
      cell = {
        typeId,
        confidence: result.answer.probabilities[typeId] ?? result.answer.confidence,
        modelChoice: result.answer.choice,
        probabilities: result.answer.probabilities,
        source: "model",
        elapsedMs: result.elapsedMs ?? 0,
        attempts,
      };
    } else {
      consecutiveFailures += 1;
      fallbackCount += 1;
      cell = {
        typeId: fallbackType({ vocabulary, grid, x, y, random }),
        confidence: 0,
        modelChoice: null,
        probabilities: {},
        source: "fallback",
        elapsedMs: 0,
        attempts,
        error: failure?.message ?? "no answer",
      };
    }

    setCell(grid, x, y, cell);
    placed.add(cellKey(x, y));
    placedCount += 1;
    onCell({ x, y, cell, index, total });
    index += 1;

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      return finish("failed", { failure: failure ?? { status: 0, message: "no answer" }, at: { x, y } });
    }
  }
}

/**
 * A `decide` function for one model, built from the client and the transport
 * the model needs (`models.transportFor`). Both paths answer the same shape:
 *   { ok: true, answer: {choice, confidence, probabilities} | null, elapsedMs }
 *   { ok: false, status, message }
 */
export function createDecider({ client, transport, apiKey, model, vocabulary }) {
  if (transport === "decisions") {
    return async ({ state, questions }) => {
      const result = await client.decide({ apiKey, model, state, questions });
      if (!result.ok) return result;
      return { ok: true, answer: readDecisionAnswer(result.data, vocabulary), elapsedMs: result.elapsedMs ?? 0 };
    };
  }
  return async (request) => {
    const result = await client.generate({
      apiKey,
      model,
      messages: buildChatDecisionMessages(request),
      jsonSchema: CHAT_DECISION_SCHEMA,
      maxTokens: 200,
    });
    if (!result.ok) return result;
    return { ok: true, answer: readChatDecision(result.text, vocabulary), elapsedMs: result.elapsedMs ?? 0 };
  };
}
