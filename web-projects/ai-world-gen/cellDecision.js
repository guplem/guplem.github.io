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

import { DIRECTIONS, countByType, getCell, neighboursOf, ringCounts } from "./grid.js";
import { describeSetting } from "./presets.js";
import { extractJson, typeById } from "./vocabulary.js";

/** How far around a cell the counts look. Two steps: enough to see a room, not the map. */
export const NEARBY_RADIUS = 2;

/** Options with a probability below this share of the best one are never sampled. */
const SAMPLE_FLOOR = 0.08;

const INSTRUCTIONS = [
  "Which element type belongs in this cell of the map?",
  "Follow each type's placement rules and keep the cell consistent with its placed neighbours.",
  "Structures first: when a barrier or route line reaches this cell (see continuations), the type that",
  "continues it fits best, unless its rules forbid it here. A barrier line goes on until it closes a shape;",
  "a route goes on until it reaches a place.",
  "Otherwise the finished map must use its whole vocabulary in the shares the rules describe:",
  "choose a type that balance.needed lists and avoid one that balance.overused lists.",
  "Ground types form patches of several cells, never a single scattered cell.",
].join(" ");

const ROUTE_TAGS = new Set(["path", "road", "pavement", "bridge", "stairs"]);
const ROUTE_WORDS = /\b(path|road|street|corridor|walkway|trail|lane|track|alley|hallway|avenue|passage)\b/i;

/** Whether a type is a route: by its visual tag, or by what it is called. Shared with the metrics. */
export function isRouteType(type) {
  if (!type) return false;
  if (ROUTE_TAGS.has(type.visualTag)) return true;
  return ROUTE_WORDS.test(`${type.id} ${type.label}`);
}

const SIDES = [
  { name: "north", dx: 0, dy: -1, opposite: "south" },
  { name: "east", dx: 1, dy: 0, opposite: "west" },
  { name: "south", dx: 0, dy: 1, opposite: "north" },
  { name: "west", dx: -1, dy: 0, opposite: "east" },
];

/**
 * The barrier and route lines that reach a cell from its four sides, and the
 * types that stand on two opposite sides (ADR 0002).
 *
 * v2 balanced the vocabulary and scattered it: single walls and single path
 * cells everywhere. The model sees neighbours as a list of types; it does not
 * see that three walls to the west are a line that wants a fourth. This says so.
 */
export function continuationHints(grid, vocabulary, x, y) {
  const lines = [];
  const bySide = {};
  for (const side of SIDES) {
    const first = getCell(grid, x + side.dx, y + side.dy);
    const type = first ? typeById(vocabulary, first.typeId) : null;
    const role = type?.isBarrier ? "barrier" : isRouteType(type) ? "route" : null;
    if (!role) continue;
    let length = 0;
    while (getCell(grid, x + side.dx * (length + 1), y + side.dy * (length + 1))?.typeId === first.typeId) length += 1;
    lines.push({ direction: side.name, type: first.typeId, role, length });
    bySide[side.name] = first.typeId;
  }
  const joins = [];
  for (const side of ["north", "east"]) {
    const opposite = SIDES.find((one) => one.name === side).opposite;
    if (bySide[side] && bySide[side] === bySide[opposite] && !joins.includes(bySide[side])) joins.push(bySide[side]);
  }
  return { lines, joins };
}

/**
 * The share of the map a type should take, read from the rarity word in its
 * placement rules. The vocabulary prompt asks for exactly these words.
 */
export const TARGET_SHARES = { mostCommon: 0.45, common: 0.15, uncommon: 0.06, rare: 0.02, unspecified: 0.05 };

const RARITY_WORDS = [
  [/most common/i, TARGET_SHARES.mostCommon],
  [/\bcommon\b/i, TARGET_SHARES.common],
  [/\buncommon\b/i, TARGET_SHARES.uncommon],
  [/\brare\b|\bexactly one\b|\bonly one\b/i, TARGET_SHARES.rare],
];

/** The target share of one type. The first rarity word in the rules wins. */
export function targetShare(placementRules) {
  const text = String(placementRules ?? "");
  let best = null;
  for (const [pattern, share] of RARITY_WORDS) {
    const match = pattern.exec(text);
    if (match && (best === null || match.index < best.index)) best = { index: match.index, share };
  }
  return best ? best.share : TARGET_SHARES.unspecified;
}

/** A type is overused once its share passes its target by this factor. */
const OVERUSE_FACTOR = 1.3;
const MIN_CELLS_FOR_OVERUSE = 3;
const MAX_NEEDED = 5;

/**
 * Where every type stands against its target share, for the state (ADR 0002).
 *
 * Without this the model answers each cell from its neighbours alone, and a
 * map that starts with grass ends as grass: v1 used one type for more than 85%
 * of the cells on thirteen maps out of fifteen. `needed` lists the types most
 * below their target, the most missing first; `overused` the ones far above.
 */
export function balanceSheet(vocabulary, counts, totalCells) {
  const shares = {};
  const gaps = [];
  const overused = [];
  for (const type of vocabulary.elements) {
    const target = Math.round(targetShare(type.placementRules) * 100);
    const count = counts[type.id] ?? 0;
    const now = totalCells > 0 ? Math.round((count / totalCells) * 100) : 0;
    shares[type.id] = { target, now };
    if (now < target) gaps.push({ id: type.id, missing: (target - now) / target });
    if (count >= MIN_CELLS_FOR_OVERUSE && now > target * OVERUSE_FACTOR) overused.push(type.id);
  }
  gaps.sort((a, b) => b.missing - a.missing);
  return { needed: gaps.slice(0, MAX_NEEDED).map((one) => one.id), overused, shares };
}

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
    balance: balanceSheet(vocabulary, placed, grid.width * grid.height),
    continuations: continuationHints(grid, vocabulary, x, y),
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
