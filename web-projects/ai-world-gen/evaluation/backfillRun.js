// Generate one test case with an OLD version of the generator, for `evaluate.py backfill`.
//
// When a dataset grows, the versions that ran before it have no result for the
// new cases, and the coverage chart in Galtea shows them half evaluated. This
// runner is copied into a checkout of the old commit (`git archive`) and run
// there, so it imports that commit's modules: the same vocabulary, the same
// per-cell state, the same sampling as the version had. It prints the map and
// nothing else; the scores come from today's metrics, in `evaluate.py`.
//
//   OPENROUTER_API_KEY=... bun evaluation/backfillRun.js '{"preset":"medieval-village","width":8,"height":8,"order":"spiral","seed":401}'
//
// Only modules that exist since v1 are imported statically. `blueprint.js`
// arrived with v8, so it is loaded only when the checkout has it.

import { createDecider, runGeneration } from "../generation.js";
import { createGrid, gridToJSON } from "../grid.js";
import { DEFAULT_DECISION_MODEL, transportFor } from "../models.js";
import * as client from "../openRouterClient.js";
import { createOrder, readOrderId } from "../orderStrategies.js";
import { presetVocabularyFor } from "../presetVocabularies.js";
import { SETTING_PRESETS, cleanSetting } from "../presets.js";
import { mulberry32 } from "../random.js";

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
const decisionModel = process.env.AI_WORLD_GEN_DECISION_MODEL || DEFAULT_DECISION_MODEL;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function loadPlanner() {
  try {
    const blueprint = await import("../blueprint.js");
    return blueprint.planStructures;
  } catch {
    return null;
  }
}

async function main() {
  if (!apiKey) fail("Set OPENROUTER_API_KEY.");
  const input = JSON.parse(process.argv[2] ?? "");
  const preset = SETTING_PRESETS.find((one) => one.id === input.preset) ?? null;
  if (!preset) fail("A backfill case must name a preset: an old version cannot write a fresh vocabulary comparably.");
  const setting = cleanSetting({ ...preset, ...input });
  const width = Number(input.width) || 8;
  const height = Number(input.height) || 8;
  const seed = Number(input.seed) || 1;
  const vocabulary = presetVocabularyFor(preset.id);
  const grid = createGrid(width, height);
  const planStructures = await loadPlanner();
  const plan = planStructures ? planStructures({ vocabulary, width, height, random: mulberry32(seed ^ 0x51ed270b) }) : null;
  const decide = createDecider({ client, transport: transportFor(decisionModel, []), apiKey, model: decisionModel, vocabulary });
  const started = performance.now();
  const summary = await runGeneration({
    grid,
    vocabulary,
    setting,
    order: createOrder(readOrderId(input.order), { width, height, random: mulberry32(seed) }),
    decide,
    plan,
    random: mulberry32(seed ^ 0x9e3779b9),
  });
  if (summary.status === "failed") fail(`Generation stopped: ${summary.failure?.message ?? "unknown"}`);
  process.stdout.write(
    JSON.stringify({
      input,
      setting,
      models: { decision: decisionModel, transport: transportFor(decisionModel, []), vocabulary: `preset:${preset.id}` },
      vocabulary,
      plan,
      grid: gridToJSON(grid),
      summary,
      elapsedMs: Math.round(performance.now() - started),
    }),
  );
}

main().catch((error) => fail(error?.stack ?? String(error)));
