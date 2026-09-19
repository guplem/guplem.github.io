# web-projects/ai-world-gen/AGENTS.md

> **SCOPE:** files under `web-projects/ai-world-gen/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A map generator with two kinds of model. A text model writes a world's vocabulary once (ADR 0002); a decision model (TypeSafe's Jev) then places one cell at a time from its neighbours. Everything goes through OpenRouter with a key the reader pastes (ADR 0001). The `README.md` holds the concept, the roadmap with its phases, and the open questions; keep it current, because it is the memory of the project between sessions.

## Module map

| File | Pure? | Responsibility |
|---|---|---|
| `openRouterClient.js` | No | The **only** file that calls `fetch`. `checkKey`, `listModels`, `generate` (chat), `decide` (decisions). Never throws: `{ok, ...}` or `{ok: false, status, message}` |
| `models.js` | Yes | Default model ids, `readCatalogue` from `/api/v1/models`, `transportFor` (decisions or chat) |
| `settings.js` | Yes | The key, the model choices and the art style, through an injected storage. The only file that names `localStorage` |
| `vocabulary.js` | Yes | The prompt, `VOCABULARY_SCHEMA`, `normaliseVocabulary` (every error names its element), `generateVocabulary` with an injected `generate`, `describeVocabularyText` for the setup box |
| `cellDecision.js` | Yes | `buildCellDecision` (state + one choice question), `readDecisionAnswer`, `chooseType` (sampling), the chat stand-in, `fallbackType` |
| `generation.js` | Yes | `runGeneration` (sequential loop, retries, fallbacks, stop rules) with an injected `decide`; `createDecider` builds one from the client and the transport |
| `orderStrategies.js` | Yes | Five orders behind `nextCoordinate(placed: Set<string>)` |
| `grid.js` | Yes | The grid (mutated in place), neighbours, ring counts, JSON in and out |
| `reachability.js` | Yes | Four-way flood fill over walkable cells; `ok` is false on more than one region |
| `tileset.js` | Yes (data) | Sheet geometry and the `VISUAL_TAGS` manifest (ADR 0003) |
| `tileStyles.js` | Yes (data) | The four art styles and, per visual tag, the emoji, roguelike glyph and colour the code styles draw (ADR 0003) |
| `presetVocabularies.js` | Yes (data) | One ready vocabulary per setting preset, so a preset needs no creative call (ADR 0004) |
| `camera.js` | Yes | Fit, pan, zoom around a point, cell under a point |
| `presets.js` | Yes | Setting suggestions, grid sizes, `cleanSetting`, `describeSetting`, `presetMatching` |
| `urlState.js` | Yes | The view and the setup in the link; never the key |
| `random.js` | Yes | `mulberry32`, `seedFromText`, `hashCoordinate` |
| `openRouterErrors.js` | Yes | A failure into one sentence that names the fix |
| `render.js` | No | The canvas: `createRenderer`, `loadTilesheet`, `drawTag` (one tag, one style, one square), `tileThumbnail` |
| `app.js` | No | The page: three views, wiring, the generation flow |
| `deployStamp.js`, `deployText.js` | Yes | The "deployed at" line (root ADR 0013) |
| `evaluation/mapMetrics.js` | Yes | The three specifications, their metrics, `scoreMap` and `renderAscii` (ADR 0005) |
| `evaluation/runTestCase.js` | No | Bun command line: one test case in, one generated and scored map out, with the real client |
| `evaluation/evaluate.py` | No | The Galtea side: `setup`, `run --version vN`, `report`, `render`. Reads the rule names from `mapMetrics.js`; uploads each map's PNG and attaches it to the output |
| `evaluation/renderMap.py` | Yes | A grid to a PNG with the page's tiles, first variant only; reads the manifest from `tileset.js` through Bun. Tested by `renderMap_test.py` (`python -m unittest`) |
| `evaluation/testCases.json` | Yes (data) | Three datasets of five seeds each, matched to Galtea test cases by their `id` |
| `evaluation/galtea.json` | Yes (data) | The Galtea ids `setup` created or found. Committed; no secrets |

Data flow for one world: `app.js` → the vocabulary box (`vocabulary.describeVocabularyText`; a preset chip fills it from `presetVocabularies.js`) or, when the box is empty, `vocabulary.generateVocabulary(client.generate)` → `orderStrategies.createOrder` → `generation.runGeneration(createDecider(client))` → for each cell `cellDecision.buildCellDecision` → `decide` → `cellDecision.chooseType` → `grid.setCell` → `render.draw` → at the end `reachability.analyseReachability`.

## Non-obvious conventions and gotchas

- **Two endpoints, two request shapes.** `decide()` posts `{model, state, questions}` to `/api/alpha/decisions` and reads `answers.<key>.{choice, confidence, probabilities}`. `generate()` posts OpenAI-shaped messages to `/api/v1/chat/completions`. Sending Jev a chat request is a 400. `models.transportFor` is the one place that tells the two kinds apart; do not branch on a model name anywhere else.
- **Jev's payload was not exercised with a real key before the first deploy** (no key in the build session). `readDecisionAnswer` follows the documented System One shape. If the first real run shows a different shape, fix it there and update the README's open questions.
- **The state sent per cell never carries the grid.** It carries the 8-neighbours, counts within `NEARBY_RADIUS` (2) and whole-map counts. `cellDecision.test.js` asserts the serialised state has no `cells` key. Keep it that way: a 24 × 24 grid per call multiplies the cost by the map size.
- **The map samples the probabilities.** `chooseType` with `spread` 1 draws from the returned probabilities, dropping options below `SAMPLE_FLOOR` (8%) of the best. A cell records both `typeId` (what was placed) and `modelChoice` (the model's top pick), and the inspector shows both when they differ. Setting `spread` to 0 makes the loop deterministic given the model.
- **Sprite variation is a toggle, and the legend never varies.** In the pixel style a cell's variant comes from `hashCoordinate(x, y)`; with "Vary sprites" off the renderer passes seed 0, which is the variant the legend and the inspector always show. The toggle is hidden in the code styles, which have one drawing per tag. Its state lives in `settings.js`.
- **A new visual tag needs a row in two files**: `VISUAL_TAGS` in `tileset.js` (the sprite) and `STYLE_GLYPHS` in `tileStyles.js` (emoji, glyph, colour). `tileStyles.test.js` fails until both agree. Only `render.js` may call `tileFor` or `glyphFor`; `invariants.test.js` pins that.
- **The vocabulary box is the source when it is valid.** `generateWorld` in `app.js` reads the box first: valid means no model call, empty means the model writes it and the answer is written back into the box, invalid stops with the errors shown. Changing the prompt rules or the tag list can invalidate a shipped vocabulary in `presetVocabularies.js`; the tests fail, and the fix is to edit the shipped text, not the validator.
- **A visual tag outside `VISUAL_TAGS` is a validation error, not a fallback**, so the model fixes it. The fallback tag `unknown` exists for cells loaded from an older file or drawn before the vocabulary is known. The sheet has four separator columns (25, 51, 77, 103); `tileset.test.js` fails on a tag placed on one.
- **Tile positions are `[column, row]`, and the pixel is `1 + index * 13`.** The sheet is 206 × 50 tiles. `tileset.test.js` reads the PNG header, so a replaced PNG with another size fails loudly.
- **`FATAL_STATUSES` (401, 402, 403, 404) stop the run at once**; 0, 429 and 5xx are retried with a growing pause and then fall back. Four fallbacks in a row also stop the run. A fallback cell has `source: "fallback"` and `error`; a hand-changed cell has `source: "hand"`. The renderer marks both with a coloured corner.
- **`app.js` never writes `innerHTML`.** Every label comes from a model. The one `innerHTML` in the project is inside `deployStamp.js`, with its own escaper. `invariants.test.js` checks it.
- **The order strategies take the placed Set, not their own progress**, so a cell decided by hand or loaded from a file is never offered again. A new strategy must visit every free cell exactly once; `orderStrategies.test.js` drains each one on a 7 × 5 grid and a 1 × 1 grid.
- **The key is remembered by default.** Unticking "Remember" forgets it in storage and keeps it in memory for the tab. `settings.js` is the only file that names `localStorage`, `urlState.js` never mentions the key, and both facts are pinned in `invariants.test.js`.
- **The model catalogue is fetched without a key** (`/api/v1/models` needs none) when the AI Setup screen opens, and `FALLBACK_CATALOGUE` fills the pickers until then. `:batch` variants and image or audio models are dropped in `readCatalogue`.
- **Prose in the prompts follows the same writing rules as the docs.** The vocabulary prompt and the per-cell instructions are read by a model, but a person edits them; keep them short and literal (Jev answers the exact question asked, and negations underperform).

## Evaluation before a change to the generation

Any change that can alter the maps (the per-cell prompt or state, the sampling, the orders, the shipped vocabularies) is measured before it ships (ADR 0005):

```bash
cd web-projects/ai-world-gen/evaluation
OPENROUTER_API_KEY=sk-or-... python evaluate.py run --version vN --description "what changed"
python evaluate.py report --version vN --against v(N-1)
```

`vN` is the next version name after the last file in `evaluation/results/`. The run also draws every map to `results/vN/<case>.png` and attaches it to the Galtea output as a file part (`{"assistant_message": text, "content": [{"type": "file", "uri": "s3://...", "mimeType": "image/png"}]}`); the `s3://` form is what the API stores for its own uploads. Commit the PNGs: they are small and they are how a map is compared across versions without opening Galtea. The run costs about 960 decisions and a few minutes. Put the report's per-specification numbers in the pull request. A new rule is an entry in `SPECIFICATIONS` and `METRICS` in `mapMetrics.js` with a test, a dataset in `testCases.json`, then `python evaluate.py setup` to create it in Galtea.

## Tests

Every module marked "Pure" has a sibling `*.test.js`, and new behaviour goes in test-first (root ADR 0012). `app.js`, `render.js` and `openRouterClient.js` have none by design; anything in them worth a test belongs in a pure module instead. `invariants.test.js` pins the decisions of the four ADRs.

```bash
cd web-projects/ai-world-gen && bun test
```

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-openrouter-is-the-one-gateway-and-the-key-lives-here.md) | OpenRouter is the one gateway (CORS verified), and the key lives in this browser |
| [0002](adr/0002-one-creative-call-then-one-typed-decision-per-cell.md) | One creative call writes the vocabulary; one typed decision per cell places it |
| [0003](adr/0003-one-tileset-and-a-tag-between-the-vocabulary-and-the-tile.md) | One tileset for every setting, a visual tag between the vocabulary and the tile, and art styles that read the tag |
| [0004](adr/0004-ship-the-vocabulary-for-every-preset-and-let-the-reader-edit-it.md) | Ship the vocabulary for every preset, and let the reader edit it on the setup screen |
| [0005](adr/0005-the-map-is-evaluated-against-specifications-in-galtea.md) | The map is evaluated against written specifications, in Galtea, before every iteration |
