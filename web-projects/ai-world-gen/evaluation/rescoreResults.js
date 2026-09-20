// Score the maps of a saved run again, with the metrics as they are now.
//
//   bun evaluation/rescoreResults.js evaluation/results/v4.json
//
// A new metric needs a history, or the first version that carries it cannot
// be compared with anything. The saved results hold every grid, so the metrics
// can be computed again without a single model call. Prints one JSON object:
// case id -> {scores, ascii}.
// `evaluate.py rescore` writes them back and sends the new ones to Galtea;
// `evaluate.py backfill` scores a map an old version has just drawn.
//
// A preset's vocabulary is not in the file (the shipped one is in the
// repository), so it is read from `presetVocabularies.js`.

import { readFileSync } from "node:fs";
import { gridFromJSON } from "../grid.js";
import { presetVocabularyFor } from "../presetVocabularies.js";
import { renderAscii, scoreMap } from "./mapMetrics.js";

const path = process.argv[2];
if (!path) {
  process.stderr.write("Usage: bun evaluation/rescoreResults.js <results/vN.json>\n");
  process.exit(1);
}

const saved = JSON.parse(readFileSync(path, "utf8"));
const scores = {};
for (const [caseId, result] of Object.entries(saved.results)) {
  const vocabulary = Array.isArray(result.vocabulary?.elements) ? result.vocabulary : presetVocabularyFor(result.input.preset);
  if (!vocabulary) {
    process.stderr.write(`${caseId}: no vocabulary for preset "${result.input.preset}"\n`);
    process.exit(1);
  }
  const grid = gridFromJSON(result.grid);
  scores[caseId] = { scores: scoreMap(grid, vocabulary, result.summary, result.plan ?? null), ascii: renderAscii(grid, vocabulary) };
}
process.stdout.write(JSON.stringify(scores));
