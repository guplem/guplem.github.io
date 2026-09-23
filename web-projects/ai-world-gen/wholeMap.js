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
// does it. This file writes v11's prompt; `wholeMapLoop.js` sends it and
// reads the answer, because older versions reuse that loop (see
// `evaluation/pastVersionVariants.js`). Nothing here touches the network.

import { zoneAt } from "./blueprint.js";
import { sketchLegend, targetShare, zoneAllowedTypes } from "./cellDecision.js";
import { describeSetting } from "./presets.js";
import { describePlanWith, legendLines, readWholeMapRows, runWholeMapLoop, writeWholeMapMessages } from "./wholeMapLoop.js";

export { WHOLE_MAP_REQUEST, WHOLE_MAP_SCHEMA } from "./wholeMapLoop.js";

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

/**
 * The blueprint in words, with the types each part allows: the same
 * narrowing `zoneAllowedTypes` applies per cell, written once for the whole map.
 * @returns {string[]} one line per room, then the line for the outside
 */
export function describePlan({ vocabulary, plan, width, height }) {
  return describePlanWith({ vocabulary, plan, width, height, letterOf: sketchLegend(vocabulary).letterOf, zoneAt, zoneAllowedTypes });
}

/** The rules for a good map, in the order the prompt lists them. Each is a rule the per-cell loop gives Jev, in words or in code. */
export const WHOLE_MAP_RULES = [
  "- Walls close around each planned inside; a door is set into a wall, only where the plan says.",
  "- Routes (paths, roads, corridors) are continuous lines that lead from each door to the edge of the map, never scattered single cells and never a flood.",
  "- Ground types come in patches of several cells, not confetti.",
  "- A type whose rules say exactly one appears exactly once; a type marked rare appears once or twice.",
  "- Respect every placement rule (never next to, only next to, one edge, indoor or outdoor).",
  "- Keep each type close to its target share of the map, so no type floods it.",
  "- Every walkable cell should be reachable from every other walkable cell through walkable cells and doors.",
];

/**
 * The prompt: the world, the legend with every type's rules and target
 * share, the blueprint, and the shape rules the per-cell loop enforces in
 * code. `rows` are asked north first, west first, like `mapSketch`.
 */
export function buildWholeMapMessages({ vocabulary, setting, width, height, plan = null }) {
  const { letterOf } = sketchLegend(vocabulary);
  return writeWholeMapMessages({
    vocabulary,
    settingText: describeSetting(setting),
    width,
    height,
    legend: legendLines(vocabulary, letterOf, targetShare),
    planLines: describePlan({ vocabulary, plan, width, height }),
    rules: WHOLE_MAP_RULES,
  });
}

/**
 * A model's rows, read into type ids, or the list of problems to send back.
 * @returns {{ok: true, cells: string[][]} | {ok: false, errors: string[]}}
 */
export function readWholeMap(text, vocabulary, width, height) {
  return readWholeMapRows(text, sketchLegend(vocabulary).legend, width, height);
}

/**
 * Fill every empty cell of the grid from one text-model answer to v11's prompt.
 * The options are those of `runWholeMapLoop`, with the prompt built here.
 * @param {object} options
 * @param {object} options.vocabulary
 * @param {object} options.setting
 * @param {object|null} [options.plan] the blueprint (`blueprint.js`)
 */
export function runWholeMapGeneration({ grid, vocabulary, setting, plan = null, ...options }) {
  const messages = buildWholeMapMessages({ vocabulary, setting, width: grid.width, height: grid.height, plan });
  return runWholeMapLoop({ grid, messages, legend: sketchLegend(vocabulary).legend, ...options });
}
