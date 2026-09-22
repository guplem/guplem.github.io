// Generate one map for one test case, from the command line, with the same
// modules the page uses. Prints one JSON document to stdout: the input, the
// vocabulary, the grid, the run summary, the metric scores and an ASCII view.
//
//   OPENROUTER_API_KEY=sk-or-... bun evaluation/runTestCase.js '{"preset":"medieval-village","width":10,"height":10,"order":"spiral","seed":101}'
//
// Optional environment: AI_WORLD_GEN_DECISION_MODEL and
// AI_WORLD_GEN_NARRATIVE_MODEL override the defaults;
// AI_WORLD_GEN_GENERATION picks how the grid is filled: `per-cell` (the
// default), `whole-map` (one call to the narrative model, `wholeMap.js`) or
// `batched` (every cell as its own typed question, in as few decisions
// requests as the endpoint takes, `batchedDecisions.js`). Progress goes to
// stderr.
//
// The only difference from the page is where the vocabulary comes from: a
// test case names a preset, whose shipped vocabulary is used (ADR 0004), or
// gives its own setting, in which case the narrative model writes one.

import { createBatchDecider, runBatchedGeneration } from "../batchedDecisions.js";
import { planStructures } from "../blueprint.js";
import { createDecider, runGeneration } from "../generation.js";
import { createGrid, gridToJSON } from "../grid.js";
import { DEFAULT_DECISION_MODEL, DEFAULT_NARRATIVE_MODEL, transportFor } from "../models.js";
import * as client from "../openRouterClient.js";
import { describeFailure } from "../openRouterErrors.js";
import { createOrder, readOrderId } from "../orderStrategies.js";
import { presetVocabularyFor } from "../presetVocabularies.js";
import { SETTING_PRESETS, cleanSetting } from "../presets.js";
import { mulberry32 } from "../random.js";
import { visualTagNames } from "../tileset.js";
import { generateVocabulary } from "../vocabulary.js";
import { readGenerationMode, runWholeMapGeneration } from "../wholeMap.js";
import { renderAscii, scoreMap } from "./mapMetrics.js";

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
const decisionModel = process.env.AI_WORLD_GEN_DECISION_MODEL || DEFAULT_DECISION_MODEL;
const narrativeModel = process.env.AI_WORLD_GEN_NARRATIVE_MODEL || DEFAULT_NARRATIVE_MODEL;
const generationMode = readGenerationMode(process.env.AI_WORLD_GEN_GENERATION);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readInput() {
  const argument = process.argv[2];
  if (!argument) fail("Usage: bun evaluation/runTestCase.js '<test case JSON>'");
  try {
    return JSON.parse(argument);
  } catch {
    return fail("The test case is not valid JSON.");
  }
}

/** The narrative model as a `generate` function, for the vocabulary and for the whole-map mode (which sets its own request options). */
function generateWithNarrativeModel({ messages, jsonSchema, ...options }) {
  return client.generate({ apiKey, model: narrativeModel, messages, jsonSchema, maxTokens: 6000, ...options });
}

async function main() {
  if (!apiKey) fail("Set OPENROUTER_API_KEY.");
  const input = readInput();
  const preset = SETTING_PRESETS.find((one) => one.id === input.preset) ?? null;
  const setting = cleanSetting(preset ? { ...preset, ...input } : input);
  const width = Number(input.width) || 10;
  const height = Number(input.height) || 10;
  const seed = Number(input.seed) || 1;
  const order = readOrderId(input.order);
  const started = performance.now();

  let vocabulary = preset ? presetVocabularyFor(preset.id) : null;
  let vocabularySource = preset ? `preset:${preset.id}` : narrativeModel;
  if (!vocabulary) {
    process.stderr.write(`Vocabulary: asking ${narrativeModel}\n`);
    const result = await generateVocabulary({ generate: generateWithNarrativeModel, setting, visualTags: visualTagNames() });
    if (!result.ok) fail(result.failure ? describeFailure(result.failure) : `No valid vocabulary: ${result.errors.join(" ")}`);
    vocabulary = result.vocabulary;
  }

  const grid = createGrid(width, height);
  const plan = planStructures({ vocabulary, width, height, random: mulberry32(seed ^ 0x51ed270b) });
  const total = width * height;
  let summary;
  let models;
  if (generationMode === "whole-map") {
    models = { decision: narrativeModel, transport: "whole-map", vocabulary: vocabularySource, generation: generationMode };
    summary = await runWholeMapGeneration({
      grid,
      vocabulary,
      setting,
      plan,
      generate: generateWithNarrativeModel,
      onAttempt: ({ attempt, errors }) => {
        process.stderr.write(attempt === 1 ? `  asking ${narrativeModel} for the whole ${width} × ${height} map\n` : `  attempt ${attempt}: ${errors.slice(0, 2).join(" | ")}\n`);
      },
    });
  } else if (generationMode === "batched") {
    models = { decision: decisionModel, transport: "decisions", vocabulary: vocabularySource, generation: generationMode };
    summary = await runBatchedGeneration({
      grid,
      vocabulary,
      setting,
      order: createOrder(order, { width, height, random: mulberry32(seed) }),
      decide: createBatchDecider({ client, apiKey, model: decisionModel, vocabulary }),
      plan,
      random: mulberry32(seed ^ 0x9e3779b9),
      onBatch: ({ batch, cells, answered, placedCount }) => {
        process.stderr.write(`  batch ${batch}: ${cells} questions, ${answered} answered · ${placedCount}/${total} cells
`);
      },
    });
  } else {
    const transport = transportFor(decisionModel, []);
    models = { decision: decisionModel, transport, vocabulary: vocabularySource, generation: generationMode };
    const decide = createDecider({ client, transport, apiKey, model: decisionModel, vocabulary });
    summary = await runGeneration({
      grid,
      vocabulary,
      setting,
      order: createOrder(order, { width, height, random: mulberry32(seed) }),
      decide,
      plan,
      random: mulberry32(seed ^ 0x9e3779b9),
      onCell: ({ index, cell }) => {
        if ((index + 1) % 10 === 0 || index + 1 === total) {
          process.stderr.write(`  ${index + 1}/${total} cells · last ${cell.typeId} in ${cell.elapsedMs} ms\n`);
        }
      },
    });
  }
  if (summary.status === "failed") fail(`Generation stopped: ${describeFailure(summary.failure)}`);

  const scores = scoreMap(grid, vocabulary, summary, plan);
  process.stdout.write(
    JSON.stringify({
      input,
      setting,
      models,
      vocabulary,
      plan,
      grid: gridToJSON(grid),
      summary,
      scores,
      ascii: renderAscii(grid, vocabulary),
      elapsedMs: Math.round(performance.now() - started),
    }),
  );
}

main().catch((error) => fail(error?.stack ?? String(error)));
