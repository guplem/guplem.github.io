// One cell, one typed decision.
//
// This is the repetitive half of the design (ADR 0002): given the world, the
// vocabulary and what is already placed around a cell, which type goes here?
// It is a one-of-N choice, and that is exactly what a decision model such as
// Jev answers: a choice, its confidence, and a probability per option. No
// prose, no parsing.
//
// The state sent with each question carries the eight neighbouring cells,
// counts within a short radius, and counts for the whole map so far. It also
// carries two things the code, not the model, works out: a balance sheet of
// each type against its target share, and continuation hints that name the
// one type worth continuing here, or none. Since v5 it also carries the whole
// map as one letter per cell: a 24 by 24 sketch is under 300 tokens, and the
// question v5 measures is whether the model reads it.
//
// A text model can answer the same question through `chat/completions` when
// Jev is not available. That path is slower and dearer, and it exists so a
// live demo does not die with a beta endpoint.

import { structureOf, zoneAt } from "./blueprint.js";
import { DIRECTIONS, countByType, getCell, neighboursOf, ringCounts } from "./grid.js";
import { describeSetting } from "./presets.js";
import { OPEN_PLACEMENT, extractJson, typeById } from "./vocabulary.js";

/** How far around a cell the counts look. Two steps: enough to see a room, not the map. */
export const NEARBY_RADIUS = 2;

/**
 * Options with a probability below this share of the best one are never
 * sampled. v4 and v5 sampled anything above 8%, and the sample overrode the
 * model's own choice on 27% to 29% of the cells: a wall where it was 60% sure
 * of floor. A third keeps the variety where the model is torn and drops it
 * where it is not.
 */
export const SAMPLE_FLOOR = 1 / 3;

const INSTRUCTIONS = [
  "Which element type belongs in this cell of the map?",
  "state.map shows the whole map so far, one letter per cell (state.map.legend), rows from north to south; '?' is this cell.",
  "Use it to see the shape each structure has and where this cell sits in it.",
  "Follow each type's placement rules and keep the cell consistent with its placed neighbours.",
  "state.zone says which part of the plan this cell is: a wall, the door or the inside of a named structure, or outside every structure;",
  "only the types that belong to that part are offered.",
  "state.excluded lists the types whose hard rules forbid this cell, with the rule; they are not offered.",
  "state.missing lists the things this world still lacks that fit this cell; when it is not empty and the rules fit, choose one of them.",
  "When continuations.suggested names a type, that type continues or closes a structure here and fits best,",
  "unless its rules forbid it in this place.",
  "When continuations.suggested is null, no structure needs this cell: choose a type from balance.needed",
  "whose rules allow it here, avoid every type in balance.overused, and keep ground types in patches of",
  "several cells rather than single scattered cells.",
].join(" ");

const ROUTE_TAGS = new Set(["path", "road", "pavement", "bridge", "stairs"]);
const ROUTE_WORDS = /\b(path|road|street|corridor|walkway|trail|lane|track|alley|hallway|avenue|passage)\b/i;

/** Whether a type is a route: by its visual tag, or by what it is called. Shared with the metrics. */
export function isRouteType(type) {
  if (!type) return false;
  if (ROUTE_TAGS.has(type.visualTag)) return true;
  return ROUTE_WORDS.test(`${type.id} ${type.label}`);
}

/** Whether a type's rules ask for one instance on the whole map ("exactly one per cottage" does not). Shared with the metrics. */
export function isUniqueType(type) {
  return Boolean(type && /\b(exactly|only) one\b(?! per\b)/i.test(type.placementRules ?? ""));
}

const SIDES = [
  { name: "north", dx: 0, dy: -1, opposite: "south" },
  { name: "east", dx: 1, dy: 0, opposite: "west" },
  { name: "south", dx: 0, dy: 1, opposite: "north" },
  { name: "west", dx: -1, dy: 0, opposite: "east" },
];

/** A straight line this long is long enough; the model is not asked to extend it further. */
export const MAX_CONTINUED_LINE = 4;

/**
 * The barrier and route lines that reach a cell from its four sides, the
 * types that stand on two opposite sides, and the one type the code suggests
 * continuing here, or null (ADR 0002).
 *
 * v2 balanced the vocabulary and scattered it: single walls and single path
 * cells everywhere. v3 asked the model to continue every line and it did,
 * across the whole map. So the judgement is code now: a gap between two
 * segments is closed, a line shorter than `MAX_CONTINUED_LINE` is continued,
 * and a type the balance sheet calls overused is never suggested.
 *
 * @param {{overused: string[]}} balance the balance sheet of the map so far
 */
export function continuationHints(grid, vocabulary, x, y, balance = { overused: [] }) {
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

  const allowed = (type) => !(balance?.overused ?? []).includes(type);
  let suggested = null;
  const join = joins.find(allowed);
  if (join) {
    suggested = { type: join, reason: `closes the gap between two ${join} segments` };
  } else {
    const candidates = lines
      .filter((one) => one.length < MAX_CONTINUED_LINE && allowed(one.type))
      .sort((a, b) => (a.role === b.role ? b.length - a.length : a.role === "barrier" ? -1 : 1));
    if (candidates.length > 0) {
      const best = candidates[0];
      suggested = {
        type: best.type,
        reason: `continues the ${best.type} ${best.role === "barrier" ? "line" : "route"} of ${best.length} cell${best.length === 1 ? "" : "s"} from the ${best.direction}`,
      };
    }
  }
  return { lines, joins, suggested };
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

/**
 * A ground or route type past this many times its target is no longer
 * offered while another ground type is allowed in the cell (v10). "Overused"
 * at 1.3 is advice the model reads; v9 still let the route type take 0.38 of
 * the open ground on average, and 0.9 in a mansion where the carpet is a line.
 */
export const HARD_CAP_FACTOR = 2;
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

const SKETCH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SKETCH_UNDECIDED = ".";
const SKETCH_THIS_CELL = "?";
const SKETCH_UNKNOWN = "!";

/**
 * The whole map as text, one letter per cell, in the order of the vocabulary.
 * Cheap enough to send with every decision (a 24 by 24 grid is 600 characters)
 * and the only way the model can see a shape larger than its 8 neighbours.
 */
/** One letter per type, in vocabulary order: the alphabet of `mapSketch` and of the whole-map answer (`wholeMap.js`). */
export function sketchLegend(vocabulary) {
  const letterOf = {};
  const legend = {};
  vocabulary.elements.forEach((type, index) => {
    const letter = SKETCH_LETTERS[index] ?? SKETCH_UNKNOWN;
    letterOf[type.id] = letter;
    legend[letter] = type.id;
  });
  return { letterOf, legend };
}

export function mapSketch(grid, vocabulary, x, y) {
  const { letterOf, legend } = sketchLegend(vocabulary);
  legend[SKETCH_UNDECIDED] = "undecided";
  legend[SKETCH_THIS_CELL] = "this cell";
  const rows = [];
  for (let row = 0; row < grid.height; row += 1) {
    let text = "";
    for (let column = 0; column < grid.width; column += 1) {
      if (column === x && row === y) text += SKETCH_THIS_CELL;
      else {
        const cell = getCell(grid, column, row);
        text += cell === null ? SKETCH_UNDECIDED : (letterOf[cell.typeId] ?? SKETCH_UNKNOWN);
      }
    }
    rows.push(text);
  }
  return { rows, legend };
}

function edgesOf(grid, x, y) {
  const edges = [];
  if (y === 0) edges.push("north");
  if (x === grid.width - 1) edges.push("east");
  if (y === grid.height - 1) edges.push("south");
  if (x === 0) edges.push("west");
  return edges;
}

/**
 * The types whose hard placement rules allow this cell, and why each other
 * one is out (v7). The rules are the typed `placement` of each element:
 * `edge`, `neverNext` and `onlyNext`. v4 placed 21 of 23 doors in open
 * ground although every door's prose said "in a wall": prose rules are
 * advice to the model, these are applied before it answers. `onlyNext` is
 * judged only once a 4-neighbour is decided; with none there is nothing to
 * judge. When every type would be out, all stay in: an empty question has no
 * answer.
 */
export function allowedTypes({ vocabulary, grid, x, y }) {
  const edges = edgesOf(grid, x, y);
  const around = SIDES.map((side) => getCell(grid, x + side.dx, y + side.dy)?.typeId).filter(Boolean);
  const allowed = [];
  const excluded = {};
  for (const type of vocabulary.elements) {
    const rule = type.placement ?? OPEN_PLACEMENT;
    const clash = rule.neverNext.find((id) => around.includes(id));
    if (rule.edge && !edges.includes(rule.edge)) excluded[type.id] = `only on the ${rule.edge} edge`;
    else if (clash) excluded[type.id] = `never next to ${clash}`;
    else if (rule.onlyNext.length > 0 && around.length > 0 && !around.some((id) => rule.onlyNext.includes(id))) {
      excluded[type.id] = `only next to ${rule.onlyNext.join(", ")}`;
    } else allowed.push(type.id);
  }
  if (allowed.length === 0) return { allowed: vocabulary.elements.map((one) => one.id), excluded: {} };
  return { allowed, excluded };
}

const isStructureWall = (vocabulary, id) => (vocabulary.structures ?? []).some((one) => one.wall === id);
const isStructureDoor = (vocabulary, id) => (vocabulary.structures ?? []).some((one) => one.door === id);
const isStructureFloor = (vocabulary, id) => (vocabulary.structures ?? []).some((one) => one.floor === id);

/** One short phrase for a zone, for the state and the exclusion reasons. */
export function describeZone(zone) {
  if (!zone || zone.part === "outside") return "outside every structure";
  if (zone.part === "wall") return `a wall of the ${zone.label}`;
  if (zone.part === "door") return `the door of the ${zone.label}`;
  return `inside the ${zone.label}`;
}

/**
 * The types that belong to a cell's part of the plan (v8). A wall cell takes
 * its structure's wall or anything that lives in a wall (a window, a sign); the
 * door cell takes the door; an interior cell takes its structure's floor or
 * anything indoor; the outside takes anything outdoor, and never a
 * structure's wall or door, which only the plan places.
 */
export function zoneAllowedTypes({ vocabulary, zone }) {
  const structure = structureOf(vocabulary, zone);
  const zoneOf = (type) => type.placement?.zone ?? "any";
  const loose = (type) => !isStructureWall(vocabulary, type.id) && !isStructureDoor(vocabulary, type.id);
  const part = zone?.part ?? "outside";
  if (part === "door" && structure?.door) return [structure.door];
  if (part === "wall" || part === "door") {
    const own = structure ? [structure.wall] : [];
    return [...own, ...vocabulary.elements.filter((type) => zoneOf(type) === "wall" && loose(type)).map((type) => type.id)];
  }
  if (part === "interior") {
    const own = structure ? [structure.floor] : [];
    const inside = vocabulary.elements.filter((type) => ["indoor", "any"].includes(zoneOf(type)) && loose(type) && !isStructureFloor(vocabulary, type.id));
    return [...own, ...inside.map((type) => type.id)];
  }
  return vocabulary.elements
    .filter((type) => ["outdoor", "any"].includes(zoneOf(type)) && loose(type) && !(isStructureFloor(vocabulary, type.id) && zoneOf(type) === "indoor"))
    .map((type) => type.id);
}

/**
 * The state and the one question for a cell, in the shape the decisions
 * endpoint takes. `plan` is the blueprint (`blueprint.js`); without one every
 * cell is outside.
 */
export function buildCellDecision({ vocabulary, setting, grid, x, y, plan = null }) {
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
    map: mapSketch(grid, vocabulary, x, y),
    neighbours: neighboursOf(grid, x, y).map((one) => ({ direction: one.direction, type: one.cell.typeId })),
    nearbyCounts: ringCounts(grid, x, y, NEARBY_RADIUS),
    mapCounts: placed,
    zone: null,
    balance: null,
    continuations: null,
    excluded: null,
    missing: null,
  };
  const zone = zoneAt(plan, x, y);
  state.zone = { part: zone.part, structure: zone.part === "outside" ? null : zone.label, description: describeZone(zone) };
  const byZone = zoneAllowedTypes({ vocabulary, zone });
  const rules = allowedTypes({ vocabulary, grid, x, y });
  let allowed = byZone.filter((id) => rules.allowed.includes(id));
  if (allowed.length === 0) allowed = byZone.length > 0 ? byZone : vocabulary.elements.map((one) => one.id);
  // A type the rules want exactly once is out once it is on the map (v9), unless it is all this cell can be.
  const placedUnique = allowed.filter((id) => isUniqueType(typeById(vocabulary, id)) && (placed[id] ?? 0) >= 1);
  if (placedUnique.length < allowed.length) allowed = allowed.filter((id) => !placedUnique.includes(id));
  state.excluded = {};
  for (const type of vocabulary.elements) {
    if (allowed.includes(type.id)) continue;
    state.excluded[type.id] =
      rules.excluded[type.id] ?? (placedUnique.includes(type.id) ? "already on the map, and its rules say exactly one" : `this cell is ${describeZone(zone)}`);
  }
  // The things this world still lacks and this cell could hold: one nudge, gone as soon as each is placed.
  state.missing = allowed.filter((id) => {
    const type = typeById(vocabulary, id);
    return (placed[id] ?? 0) === 0 && (type.interactable || isUniqueType(type));
  });
  state.balance = balanceSheet(vocabulary, placed, grid.width * grid.height);
  // The hard cap: a ground type at twice its target makes way for the other ground types allowed here.
  const isGround = (id) => {
    const type = typeById(vocabulary, id);
    return Boolean(type && type.walkable && !type.isBarrier && !type.interactable);
  };
  const capped = allowed.filter((id) => {
    const { target, now } = state.balance.shares[id];
    return isGround(id) && (placed[id] ?? 0) >= MIN_CELLS_FOR_OVERUSE && now > target * HARD_CAP_FACTOR;
  });
  if (capped.length > 0 && allowed.some((id) => isGround(id) && !capped.includes(id))) {
    allowed = allowed.filter((id) => !capped.includes(id));
    for (const id of capped) state.excluded[id] = `overused: ${state.balance.shares[id].now}% of the map, target ${state.balance.shares[id].target}%`;
    state.missing = state.missing.filter((id) => allowed.includes(id));
  }
  state.continuations = continuationHints(grid, vocabulary, x, y, state.balance);
  if (state.continuations.suggested && !allowed.includes(state.continuations.suggested.type)) state.continuations.suggested = null;
  // Outside, next to a planned door: the route that leads to it (v9), so doors do not open onto nothing.
  if (zone.part === "outside" && plan) {
    const doorSide = SIDES.map((side) => zoneAt(plan, x + side.dx, y + side.dy)).find((one) => one.part === "door");
    const route = allowed.map((id) => typeById(vocabulary, id)).find(isRouteType);
    if (doorSide && route) state.continuations.suggested = { type: route.id, reason: `leads to the door of the ${doorSide.label}` };
  }
  const criteria = {};
  for (const type of vocabulary.elements) {
    if (!allowed.includes(type.id)) continue;
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
