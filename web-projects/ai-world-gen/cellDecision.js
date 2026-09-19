// One cell, one typed decision.
//
// This is the repetitive half of the design (ADR 0002): given the world, the
// vocabulary and what is already placed around a cell, which type goes here?
// It is a one-of-N choice, and that is exactly what a decision model such as
// Jev answers: a choice, its confidence, and a probability per option. No
// prose, no parsing.
//
// The state sent with each question is small on purpose. It carries the eight
// neighbouring cells, counts within a short radius, and counts for the whole
// map so far. It never carries the grid itself: a 24 by 24 map would cost more
// tokens per cell than the answer is worth, and the model does not need it.
//
// A text model can answer the same question through `chat/completions` when
// Jev is not available. That path is slower and dearer, and it exists so a
// live demo does not die with a beta endpoint.

import { DIRECTIONS, countByType, neighboursOf, ringCounts } from "./grid.js";
import { describeSetting } from "./presets.js";
import { extractJson, typeById } from "./vocabulary.js";

/** How far around a cell the counts look. Two steps: enough to see a room, not the map. */
export const NEARBY_RADIUS = 2;

/** Options with a probability below this share of the best one are never sampled. */
const SAMPLE_FLOOR = 0.08;

const INSTRUCTIONS = [
  "Which element type belongs in this cell of the map?",
  "Follow each type's placement rules. Keep the cell consistent with its placed neighbours,",
  "keep the whole map varied and believable for this world, and do not over-use one type.",
  "Where nothing is placed nearby yet, prefer the most common ground type.",
].join(" ");

function edgesOf(grid, x, y) {
  const edges = [];
  if (y === 0) edges.push("north");
  if (x === grid.width - 1) edges.push("east");
  if (y === grid.height - 1) edges.push("south");
  if (x === 0) edges.push("west");
  return edges;
}

/** The state and the one question for a cell, in the shape the decisions endpoint takes. */
export function buildCellDecision({ vocabulary, setting, grid, x, y }) {
  const placed = countByType(grid);
  const placedCells = Object.values(placed).reduce((sum, count) => sum + count, 0);
  const state = {
    world: { name: vocabulary.name, summary: vocabulary.summary, setting: describeSetting(setting) },
    cell: {
      x,
      y,
      gridWidth: grid.width,
      gridHeight: grid.height,
      edges: edgesOf(grid, x, y),
      placedCells,
      totalCells: grid.width * grid.height,
    },
    neighbours: neighboursOf(grid, x, y).map((one) => ({ direction: one.direction, type: one.cell.typeId })),
    nearbyCounts: ringCounts(grid, x, y, NEARBY_RADIUS),
    mapCounts: placed,
  };
  const criteria = {};
  for (const type of vocabulary.elements) {
    const flags = [type.walkable ? "walkable" : "not walkable", type.isBarrier ? "barrier" : null, type.interactable ? "interactable" : null]
      .filter(Boolean)
      .join(", ");
    criteria[type.id] = `${type.label}: ${type.description} Placement: ${type.placementRules} (${flags})`;
  }
  return { state, questions: { type: { type: "choice", instructions: INSTRUCTIONS, criteria } } };
}

function cleanProbabilities(raw, vocabulary) {
  const clean = {};
  if (!raw || typeof raw !== "object") return clean;
  for (const [id, value] of Object.entries(raw)) {
    const number = Number(value);
    if (typeById(vocabulary, id) && Number.isFinite(number) && number >= 0) clean[id] = number;
  }
  return clean;
}

/**
 * The answer to the `type` question, read out of a decisions payload.
 * @returns {{choice: string, confidence: number, probabilities: Record<string, number>} | null}
 */
export function readDecisionAnswer(payload, vocabulary) {
  const answer = payload?.answers?.type;
  const choice = typeof answer?.choice === "string" ? answer.choice : "";
  if (!typeById(vocabulary, choice)) return null;
  const probabilities = cleanProbabilities(answer.probabilities, vocabulary);
  const confidence = Number.isFinite(Number(answer.confidence)) ? Number(answer.confidence) : (probabilities[choice] ?? 0);
  return { choice, confidence, probabilities };
}

/**
 * The type to place. With `spread` 0 it is the most likely option; with 1 it
 * is sampled from the probabilities, which is what keeps a map from becoming
 * one solid colour when the model is only mildly sure. Options far below the
 * best one are never sampled.
 */
export function chooseType({ choice, probabilities, spread = 1, random = Math.random }) {
  const entries = Object.entries(probabilities ?? {}).filter(([, p]) => p > 0);
  if (entries.length === 0) return choice;
  entries.sort((a, b) => b[1] - a[1]);
  if (spread <= 0) return entries[0][0];
  const floor = entries[0][1] * SAMPLE_FLOOR;
  const kept = entries.filter(([, p]) => p >= floor);
  const total = kept.reduce((sum, [, p]) => sum + p, 0);
  let roll = random() * total;
  for (const [id, p] of kept) {
    roll -= p;
    if (roll <= 0) return id;
  }
  return kept[kept.length - 1][0];
}

/** The strict shape a text model is asked to answer with, when it stands in for Jev. */
export const CHAT_DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["typeId", "confidence"],
  properties: {
    typeId: { type: "string", description: "The id of the chosen element type." },
    confidence: { type: "number", description: "How sure you are, from 0 to 1." },
  },
};

/** The same question, phrased for a text model. */
export function buildChatDecisionMessages({ state, questions }) {
  const options = Object.entries(questions.type.criteria)
    .map(([id, text]) => `- "${id}": ${text}`)
    .join("\n");
  return [
    {
      role: "system",
      content: [
        "You place one cell of a tile-based map. Answer with one JSON object only: {\"typeId\": string, \"confidence\": number}.",
        "typeId must be exactly one of the option ids. confidence is from 0 to 1.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [questions.type.instructions, "", "Options:", options, "", "State:", JSON.stringify(state)].join("\n"),
    },
  ];
}

/** A text model's answer, read into the same shape as a decisions answer. */
export function readChatDecision(text, vocabulary) {
  const raw = extractJson(text);
  const choice = typeof raw?.typeId === "string" ? raw.typeId.trim() : "";
  if (!typeById(vocabulary, choice)) return null;
  const number = Number(raw.confidence);
  const confidence = Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0.5;
  return { choice, confidence, probabilities: { [choice]: confidence } };
}

/**
 * What to place when the model could not answer: the most common walkable
 * type among the neighbours, or a random walkable type. It is marked as a
 * fallback on the cell, so the inspector can say so.
 */
export function fallbackType({ vocabulary, grid, x, y, random = Math.random }) {
  const walkable = (id) => {
    const type = typeById(vocabulary, id);
    return Boolean(type && type.walkable && !type.isBarrier);
  };
  const counts = {};
  for (const one of neighboursOf(grid, x, y)) {
    if (walkable(one.cell.typeId)) counts[one.cell.typeId] = (counts[one.cell.typeId] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  const candidates = vocabulary.elements.filter((one) => walkable(one.id));
  const pool = candidates.length > 0 ? candidates : vocabulary.elements;
  return pool[Math.floor(random() * pool.length)].id;
}

export { DIRECTIONS };
