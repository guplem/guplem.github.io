// The whole map in one call: the measured alternative to a decision per cell.
//
// ADR 0002 chose one typed decision per cell and rejected "the whole map in
// one call" on reasoning alone. This file exists so the rejection has a
// number: a text model is given the same information the per-cell loop gives
// Jev (the world, every type with its rules, the blueprint with the types
// each part allows) and asked for the finished grid as JSON. The evaluation
// (ADR 0005) then scores both ways on the same seeds, and the README's
// version table and the blog post carry the comparison.
//
// The model answers with rows of letters, the same letters `mapSketch` uses
// in the per-cell state, so the legend is one thing across both modes. An
// answer with the wrong shape or an unknown letter is sent back with the
// list of problems, up to `attempts` times, the way `generateVocabulary`
// does it. Nothing here touches the network: `generate` is handed in.

import { zoneAt } from "./blueprint.js";
import { sketchLegend, targetShare, zoneAllowedTypes } from "./cellDecision.js";
import { getCell, setCell } from "./grid.js";
import { describeSetting } from "./presets.js";
import { extractJson } from "./vocabulary.js";

/**
 * How the page fills a grid. Three ways, one switch:
 *   - `per-cell`: one decision per cell, in order (`generation.js`, ADR 0002);
 *   - `whole-map`: the finished grid in one text-model call (this file);
 *   - `batched`: every cell as its own typed question in one decisions
 *     request (`batchedDecisions.js`).
 * The list lives here because `settings.js` reads it, and both alternatives
 * are alternatives to the same loop.
 */
export const GENERATION_MODES = ["per-cell", "whole-map", "batched"];

/** A stored or typed mode, or the default. */
export function readGenerationMode(value) {
  return GENERATION_MODES.includes(value) ? value : "per-cell";
}

/** The strict shape of the answer: one string per row, one letter per cell. */
export const WHOLE_MAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rows"],
  properties: {
    rows: {
      type: "array",
      description: "One string per row, north row first. Each string has one legend letter per cell, west column first.",
      items: { type: "string" },
    },
  },
};

/**
 * How the whole-map call is made. Thinking is off: Claude Sonnet 5 left to
 * itself spent the entire 6,000-token budget reasoning about an 8 × 8 map and
 * answered with an empty string (68 s, $0.064, nothing to parse). The answer
 * is at most a few thousand tokens of rows, so the budget covers a 32 × 32
 * grid; the timeout covers a slow provider.
 */
export const WHOLE_MAP_REQUEST = Object.freeze({ maxTokens: 6000, reasoning: Object.freeze({ enabled: false }), timeoutMs: 180000 });

/** How many problems a correction message lists; past that the model is drowning anyway. */
const MAX_ERRORS_LISTED = 12;

function letterList(ids, letterOf) {
  return ids.map((id) => `${letterOf[id]} (${id})`).join(", ");
}

/**
 * The blueprint in words, with the types each part allows: the same
 * narrowing `zoneAllowedTypes` applies per cell, written once for the whole map.
 * @returns {string[]} one line per room, then the line for the outside
 */
export function describePlan({ vocabulary, plan, width, height }) {
  const { letterOf } = sketchLegend(vocabulary);
  const rooms = plan?.rooms ?? [];
  const lines = [];
  if (rooms.length === 0) lines.push(`No structure is planned on this ${width} × ${height} map: every cell is outside.`);
  rooms.forEach((room, index) => {
    const wall = zoneAllowedTypes({ vocabulary, zone: zoneAt(plan, room.x, room.y) });
    const interior = zoneAllowedTypes({ vocabulary, zone: { part: "interior", structure: room.structure, label: room.label, room: index } });
    const door = room.door ? zoneAllowedTypes({ vocabulary, zone: zoneAt(plan, room.door.x, room.door.y) }) : [];
    const parts = [
      `${room.label} ${index + 1}: ${room.width} × ${room.height} cells, x ${room.x} to ${room.x + room.width - 1}, y ${room.y} to ${room.y + room.height - 1}.`,
      `Its border cells are walls: ${letterList(wall, letterOf)}.`,
      room.door
        ? `The cell (${room.door.x}, ${room.door.y}) is its door: ${letterList(door, letterOf)}.`
        : "It is sealed: no door.",
      `Its inside cells: ${letterList(interior, letterOf)}.`,
    ];
    lines.push(parts.join(" "));
  });
  const outside = zoneAllowedTypes({ vocabulary, zone: { part: "outside" } });
  lines.push(`Every cell that belongs to no structure is outside: ${letterList(outside, letterOf)}.`);
  return lines;
}

/**
 * The prompt: the world, the legend with every type's rules and target
 * share, the blueprint, and the shape rules the per-cell loop enforces in
 * code. `rows` are asked north first, west first, like `mapSketch`.
 */
export function buildWholeMapMessages({ vocabulary, setting, width, height, plan = null }) {
  const { letterOf } = sketchLegend(vocabulary);
  const legend = vocabulary.elements.map((type) => {
    const flags = [type.walkable ? "walkable" : "not walkable", type.isBarrier ? "barrier" : null, type.interactable ? "interactable" : null].filter(Boolean).join(", ");
    const share = Math.round(targetShare(type.placementRules) * 100);
    return `${letterOf[type.id]} = ${type.id} (${type.label}): ${type.description} Placement: ${type.placementRules} (${flags}; about ${share}% of the map)`;
  });
  return [
    {
      role: "system",
      content: [
        "You draw the whole tile map of a world in one answer.",
        `Answer with one JSON object only: {"rows": [string, ...]} with exactly ${height} strings of exactly ${width} letters each.`,
        "The first string is the north row; the first letter of a string is the west column. Every letter must be one from the legend.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `World: ${vocabulary.name}. ${vocabulary.summary}`,
        describeSetting(setting),
        "",
        `Grid: ${width} columns (x, west to east) by ${height} rows (y, north to south). Cell (x, y) is letter x of row y.`,
        "",
        "Legend, one letter per type:",
        ...legend,
        "",
        "The plan. Code has already placed the structures; draw them exactly here:",
        ...describePlan({ vocabulary, plan, width, height }),
        "",
        "Rules for a good map:",
        "- Walls close around each planned inside; a door is set into a wall, only where the plan says.",
        "- Routes (paths, roads, corridors) are continuous lines that lead from each door to the edge of the map, never scattered single cells and never a flood.",
        "- Ground types come in patches of several cells, not confetti.",
        "- A type whose rules say exactly one appears exactly once; a type marked rare appears once or twice.",
        "- Respect every placement rule (never next to, only next to, one edge, indoor or outdoor).",
        "- Keep each type close to its target share of the map, so no type floods it.",
        "- Every walkable cell should be reachable from every other walkable cell through walkable cells and doors.",
      ].join("\n"),
    },
  ];
}

/**
 * A model's rows, read into type ids, or the list of problems to send back.
 * @returns {{ok: true, cells: string[][]} | {ok: false, errors: string[]}}
 */
export function readWholeMap(text, vocabulary, width, height) {
  const { legend } = sketchLegend(vocabulary);
  const raw = extractJson(text);
  const rows = raw?.rows;
  if (!Array.isArray(rows)) return { ok: false, errors: ['The answer has no "rows" array.'] };
  const errors = [];
  if (rows.length !== height) errors.push(`The map needs exactly ${height} rows; the answer has ${rows.length}.`);
  const cells = [];
  rows.slice(0, height).forEach((row, y) => {
    const letters = typeof row === "string" ? Array.from(row) : [];
    if (letters.length !== width) errors.push(`Row ${y} needs exactly ${width} letters; it has ${letters.length}.`);
    const ids = [];
    letters.slice(0, width).forEach((letter, x) => {
      const id = legend[letter];
      if (!id) errors.push(`Row ${y}, column ${x}: "${letter}" is not a letter of the legend.`);
      ids.push(id ?? null);
    });
    cells.push(ids);
  });
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, MAX_ERRORS_LISTED) };
  return { ok: true, cells };
}

function readUsage(usage) {
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  return { promptTokens: number(usage?.prompt_tokens), completionTokens: number(usage?.completion_tokens), cost: number(usage?.cost) };
}

/**
 * Fill every empty cell of the grid from one text-model answer.
 *
 * @param {object} options
 * @param {import("./grid.js").Grid} options.grid mutated in place; cells already decided are kept
 * @param {object} options.vocabulary
 * @param {object} options.setting
 * @param {object|null} [options.plan] the blueprint (`blueprint.js`)
 * @param {(request: {messages: object[], jsonSchema: object, maxTokens: number, reasoning: object, timeoutMs: number}) => Promise<object>} options.generate the text model, `{ok, text, elapsedMs, usage} | {ok: false, status, message}`; it must forward the request options to the client
 * @param {number} [options.attempts] how many answers are tried before the run fails
 * @param {(event: {attempt: number, errors: string[]}) => void} [options.onAttempt]
 * @param {() => number} [options.now]
 * @returns {Promise<object>} the same summary shape `runGeneration` returns, plus `modelCalls`, `attempts`, `usage` and `mode`
 */
export async function runWholeMapGeneration({ grid, vocabulary, setting, plan = null, generate, attempts = 3, onAttempt = () => {}, now = () => Date.now() }) {
  const started = now();
  const messages = buildWholeMapMessages({ vocabulary, setting, width: grid.width, height: grid.height, plan });
  const usage = { promptTokens: 0, completionTokens: 0, cost: 0 };
  let modelMs = 0;
  let modelCalls = 0;
  let errors = [];

  const finish = (status, extra = {}) => ({
    status,
    placedCount: extra.placedCount ?? 0,
    fallbackCount: 0,
    elapsedMs: now() - started,
    averageMs: modelCalls > 0 ? modelMs / modelCalls : 0,
    modelCalls,
    attempts: modelCalls,
    usage,
    mode: "whole-map",
    ...extra,
  });

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    onAttempt({ attempt, errors });
    const answer = await generate({ messages, jsonSchema: WHOLE_MAP_SCHEMA, ...WHOLE_MAP_REQUEST });
    if (!answer.ok) return finish("failed", { failure: answer });
    modelCalls += 1;
    modelMs += Number.isFinite(answer.elapsedMs) ? answer.elapsedMs : 0;
    const used = readUsage(answer.usage);
    usage.promptTokens += used.promptTokens;
    usage.completionTokens += used.completionTokens;
    usage.cost += used.cost;
    const parsed = readWholeMap(answer.text, vocabulary, grid.width, grid.height);
    if (parsed.ok) {
      let placedCount = 0;
      for (let y = 0; y < grid.height; y += 1) {
        for (let x = 0; x < grid.width; x += 1) {
          if (getCell(grid, x, y) !== null) continue;
          const typeId = parsed.cells[y][x];
          setCell(grid, x, y, {
            typeId,
            confidence: 1,
            modelChoice: typeId,
            probabilities: { [typeId]: 1 },
            source: "model",
            elapsedMs: answer.elapsedMs ?? 0,
            attempts: attempt,
          });
          placedCount += 1;
        }
      }
      return finish("done", { placedCount });
    }
    errors = parsed.errors;
    messages.push({ role: "assistant", content: typeof answer.text === "string" ? answer.text : "" });
    messages.push({
      role: "user",
      content: ["That map has these problems:", ...errors.map((one) => `- ${one}`), "Answer again with the complete, corrected JSON object only."].join("\n"),
    });
  }
  return finish("failed", {
    failure: { ok: false, status: 0, message: `The model gave no valid map in ${attempts} attempts. Last problems: ${errors.slice(0, 3).join(" ")}` },
    errors,
  });
}
