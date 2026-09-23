// Draw one test case with a variant (whole map or batched) and an OLD version's code.
//
// `evaluate.py run --code-of vN` copies this file, `pastVersionVariants.js`,
// the two shared loops (`batchLoop.js`, `wholeMapLoop.js`) and today's
// client into a checkout of vN's commit, and runs it there. So the request
// is built from that commit's modules: the same vocabulary, the same per-cell
// questions, the same blueprint (from v8), the same sampling. Only the
// transport is today's, because the whole-map call needs the client options
// that arrived after v1 (thinking off, a long timeout). It prints the map and
// nothing else; the scores come from today's metrics, in `evaluate.py`.
//
//   bun evaluation/variantRun.js batched v4 '{"preset":"medieval-village","width":8,"height":8,"order":"spiral","seed":401}'
//
// Only modules that exist since v1 are imported statically. `blueprint.js`
// arrived with v8, so it is loaded only when the checkout has it.

import * as cellDecision from "../cellDecision.js";
import { createGrid, gridToJSON } from "../grid.js";
import { createOrder, readOrderId } from "../orderStrategies.js";
import { presetVocabularyFor } from "../presetVocabularies.js";
import { SETTING_PRESETS, cleanSetting, describeSetting } from "../presets.js";
import { mulberry32 } from "../random.js";
import { createBatchDecider } from "../batchLoop.js";
import { runPastBatchedGeneration, runPastWholeMapGeneration, versionNumber } from "./pastVersionVariants.js";

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
const decisionModel = process.env.AI_WORLD_GEN_DECISION_MODEL || "";
const narrativeModel = process.env.AI_WORLD_GEN_NARRATIVE_MODEL || "";
const MODES = ["whole-map", "batched"];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Today's client when `evaluate.py` copied it in; in today's tree the project's own is today's. */
async function loadClient() {
  try {
    return await import("./currentOpenRouterClient.js");
  } catch {
    return await import("../openRouterClient.js");
  }
}

async function loadBlueprint() {
  try {
    return await import("../blueprint.js");
  } catch {
    return {};
  }
}

async function main() {
  const [mode, versionName, caseText] = process.argv.slice(2);
  if (!MODES.includes(mode)) fail(`Usage: bun evaluation/variantRun.js <${MODES.join("|")}> <vN> '<test case JSON>'`);
  const version = versionNumber(versionName);
  if (!apiKey) fail("Set OPENROUTER_API_KEY.");
  if (mode === "batched" && !decisionModel) fail("Set AI_WORLD_GEN_DECISION_MODEL: the evaluation pins the model.");
  if (mode === "whole-map" && !narrativeModel) fail("Set AI_WORLD_GEN_NARRATIVE_MODEL: the evaluation pins the model.");
  const input = JSON.parse(caseText ?? "");
  const preset = SETTING_PRESETS.find((one) => one.id === input.preset) ?? null;
  if (!preset) fail("A variant case must name a preset: an old version cannot write a fresh vocabulary comparably.");
  const setting = cleanSetting({ ...preset, ...input });
  const width = Number(input.width) || 8;
  const height = Number(input.height) || 8;
  const seed = Number(input.seed) || 1;
  const vocabulary = presetVocabularyFor(preset.id);
  const grid = createGrid(width, height);
  const blueprint = await loadBlueprint();
  // The same seeds as the per-cell run of every version, so the plan and the order are the version's own.
  const plan = blueprint.planStructures ? blueprint.planStructures({ vocabulary, width, height, random: mulberry32(seed ^ 0x51ed270b) }) : null;
  const modules = { ...cellDecision, ...blueprint, describeSetting };
  const client = await loadClient();
  const started = performance.now();

  let summary;
  let models;
  if (mode === "whole-map") {
    models = { decision: narrativeModel, transport: "whole-map", vocabulary: `preset:${preset.id}`, generation: mode, codeOf: versionName };
    summary = await runPastWholeMapGeneration({
      version,
      grid,
      vocabulary,
      setting,
      plan,
      modules,
      generate: ({ messages, jsonSchema, ...options }) => client.generate({ apiKey, model: narrativeModel, messages, jsonSchema, ...options }),
      onAttempt: ({ attempt, errors }) => {
        if (attempt > 1) process.stderr.write(`  attempt ${attempt}: ${errors.slice(0, 2).join(" | ")}\n`);
      },
    });
  } else {
    models = { decision: decisionModel, transport: "decisions", vocabulary: `preset:${preset.id}`, generation: mode, codeOf: versionName };
    summary = await runPastBatchedGeneration({
      grid,
      vocabulary,
      setting,
      order: createOrder(readOrderId(input.order), { width, height, random: mulberry32(seed) }),
      plan,
      modules,
      decide: createBatchDecider({ client, apiKey, model: decisionModel, vocabulary }),
      random: mulberry32(seed ^ 0x9e3779b9),
    });
  }
  if (summary.status === "failed") fail(`Generation stopped: ${summary.failure?.message ?? "unknown"}`);
  process.stdout.write(
    JSON.stringify({ input, setting, models, vocabulary, plan, grid: gridToJSON(grid), summary, elapsedMs: Math.round(performance.now() - started) }),
  );
}

main().catch((error) => fail(error?.stack ?? String(error)));
