// The half of the whole-map mode that does not depend on how a version words the prompt.
//
// `wholeMap.js` writes v11's prompt. This file sends a prompt, reads the rows
// that come back, sends the problems back when the rows are wrong, and writes
// the map. The prompt and its letter legend are handed in, so the same loop
// runs v11's prompt and the prompts `evaluation/pastVersionVariants.js` writes
// from what an older version knew.
//
// It imports only what every version since v1 has, because the evaluation
// copies it into a checkout of an old commit and runs it there.

import { getCell, setCell } from "./grid.js";
import { extractJson } from "./vocabulary.js";

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
 * One legend line per type: its letter, its words, its rules and its flags.
 * `shareOf` turns a type's rules into its target share of the map; a version
 * that had no target shares (v1) passes null, and the share is left out.
 */
export function legendLines(vocabulary, letterOf, shareOf = null) {
  return vocabulary.elements.map((type) => {
    const flags = [type.walkable ? "walkable" : "not walkable", type.isBarrier ? "barrier" : null, type.interactable ? "interactable" : null].filter(Boolean).join(", ");
    const share = shareOf ? `; about ${Math.round(shareOf(type.placementRules) * 100)}% of the map` : "";
    return `${letterOf[type.id]} = ${type.id} (${type.label}): ${type.description} Placement: ${type.placementRules} (${flags}${share})`;
  });
}

/**
 * The blueprint in words, with the types each part allows. The version's own
 * `zoneAt` and `zoneAllowedTypes` are handed in, so each version describes
 * the plan with the narrowing it applied per cell.
 * @returns {string[]} one line per room, then the line for the outside
 */
export function describePlanWith({ vocabulary, plan, width, height, letterOf, zoneAt, zoneAllowedTypes }) {
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
 * The whole-map prompt, from its parts. `planLines` null leaves the plan out
 * (a version before v8 had no blueprint); `rules` are the lines of "Rules for
 * a good map", each starting with "- ".
 * @returns {{role: string, content: string}[]}
 */
export function writeWholeMapMessages({ vocabulary, settingText, width, height, legend, planLines = null, rules }) {
  const plan = planLines === null ? [] : ["The plan. Code has already placed the structures; draw them exactly here:", ...planLines, ""];
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
        settingText,
        "",
        `Grid: ${width} columns (x, west to east) by ${height} rows (y, north to south). Cell (x, y) is letter x of row y.`,
        "",
        "Legend, one letter per type:",
        ...legend,
        "",
        ...plan,
        "Rules for a good map:",
        ...rules,
      ].join("\n"),
    },
  ];
}

/**
 * A model's rows, read into type ids through `legend` (letter to type id), or
 * the list of problems to send back.
 * @returns {{ok: true, cells: string[][]} | {ok: false, errors: string[]}}
 */
export function readWholeMapRows(text, legend, width, height) {
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
 * Fill every empty cell of the grid from one text-model answer to `messages`.
 *
 * @param {object} options
 * @param {import("./grid.js").Grid} options.grid mutated in place; cells already decided are kept
 * @param {object[]} options.messages the prompt; a version builds its own (`buildWholeMapMessages` is v11's)
 * @param {Record<string, string>} options.legend letter to type id, the one the prompt's legend uses
 * @param {(request: {messages: object[], jsonSchema: object, maxTokens: number, reasoning: object, timeoutMs: number}) => Promise<object>} options.generate the text model, `{ok, text, elapsedMs, usage} | {ok: false, status, message}`; it must forward the request options to the client
 * @param {number} [options.attempts] how many answers are tried before the run fails
 * @param {(event: {attempt: number, errors: string[]}) => void} [options.onAttempt]
 * @param {() => number} [options.now]
 * @returns {Promise<object>} the same summary shape `runGeneration` returns, plus `modelCalls`, `attempts`, `usage` and `mode`
 */
export async function runWholeMapLoop({ grid, messages, legend, generate, attempts = 3, onAttempt = () => {}, now = () => Date.now() }) {
  const started = now();
  messages = [...messages];
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
    const parsed = readWholeMapRows(answer.text, legend, grid.width, grid.height);
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
