# AI World Gen

Describe a place, and watch an AI build its map one tile at a time.

A language model invents the world's **vocabulary** once (what a "space station" or a "medieval village" is made of). A fast, cheap **decision model** then places that vocabulary onto a grid, one cell at a time, using the already-placed neighbours as context. You watch the map fill in live, then pan around it and click any cell to see what it is and why.

This is the founding project of a side project started at the **AI Hackathon Barcelona 2026** (Norrsken House, 19–20 September, co-organised with Galtea). It is built around two sponsor technologies: TypeSafe's **Jev** (a typed-decision model, not a text generator) and the open-source track. This README is the memory of the project between sessions: the concept, the decisions, the roadmap, and the open questions all live here. Keep it current.

## Try it

<https://triunitystudios.com/web-projects/ai-world-gen/>

1. Open **AI Setup**, paste an [OpenRouter](https://openrouter.ai/keys) key (a free account, no card), press **Test connection**.
2. Back in **World**, pick a suggestion chip or write your own location, era and tone. Choose a grid size and a generation order.
3. Press **Generate the world** and watch the **Map** fill in. Click a cell to inspect it.

## Features

- **Three screens in one page**: World (setting, grid size, generation order), AI Setup (key, models), Map (live generation, inspector).
- **Vocabulary generation** by a text model (Claude Sonnet by default), asked for strict JSON, validated on receipt, and asked again with the errors when it is wrong (up to 3 attempts).
- **Per-cell decisions** by a decision model (Jev by default), one typed question per cell with the neighbours as context. The answer is a choice plus a probability per option; the map samples from those probabilities, so a mildly sure model gives a varied map, not one solid colour.
- **Five generation orders** behind one interface: centre-out spiral, pure random, clustered, tree/branching, frontier growth.
- **Live rendering** with visible per-cell latency, a progress bar, and a decision log.
- **Reachability check**: a flood fill over the walkable cells reports sealed-off regions when the map is complete, and each one is a click away.
- **Map tool**: pan by drag, zoom by wheel, pinch or buttons; click a cell for its name, type, coordinates, flags, placement rules, instance fields, confidence, the model's top options and timing.
- **Personalisation**: change a cell's type by hand, ask the model again about one cell, download the world as JSON, load it back.
- **Graceful degradation**: any text model can stand in for Jev (slower, one JSON answer per cell). A failed cell is retried, then filled with a fallback and marked orange. A dead key or a dead model stops the run with a sentence that names the fix.
- **Four art styles, switchable at any moment**: Urizen 1-bit pixel tiles, emoji, roguelike letters, flat colour blocks. The vocabulary names a *visual tag*, never a tile, so a style change is a redraw of the same map. In the pixel style a **Vary sprites** toggle turns the per-cell tile variants off, so every cell of a type looks like its legend entry, which is easier to read when checking a map.
- **No creative call for a preset.** Every suggestion chip ships its vocabulary. The **Vocabulary (optional)** box on the setup screen shows it as JSON; edit it, paste your own, or clear it to have the model write one. A generated vocabulary is written back into the box, so the next run of that world is free.

## Architecture, and why

**Pure static site, zero backend.** Vanilla HTML, CSS and JavaScript, no build step, like every project in this repository. Nothing here could hold a secret, so the key is yours.

**OpenRouter is the sole AI gateway** ([ADR 0001](adr/0001-openrouter-is-the-one-gateway-and-the-key-lives-here.md)). The app never calls OpenAI, Anthropic, Google or TypeSafe directly, only `openrouter.ai`. One browser-compatible integration instead of many, and Jev is on it (`~typesafe/jev-latest`, beta since 2026-09-18). Browser CORS was the unverified assumption of the plan; it was checked against the real endpoints on 2026-09-19 and it works (`Access-Control-Allow-Origin: *` on both the chat and the decisions endpoint). **Test connection** on the AI Setup screen is the same check, run live.

**Bring your own key.** The key is stored in `localStorage` when you ask for that, sent only to OpenRouter, and forgotten with one button. One module stores it, one module sends it, a test guards both.

**Two kinds of call, not one** ([ADR 0002](adr/0002-one-creative-call-then-one-typed-decision-per-cell.md)). `generate()` asks a text model for prose or JSON. `decide()` asks a decision model a typed question and gets a choice with probabilities. They are different endpoints with different request shapes, and the app treats them as such. This split is the pitch, not decoration: the one open-ended job goes to a language model once; the hundreds of repetitive, structured decisions go to the model built for exactly that.

**The vocabulary declares its own instance fields.** Each element type lists the properties one instance of it will need later (a chest: `contents`, `locked`; a station's crew member: `rank`, `clearance`). That is what lets the schema adapt to any setting instead of carrying hard-coded NPC and chest logic. Phase 3 fills those fields.

**Visual tags, not sprites** ([ADR 0003](adr/0003-one-tileset-and-a-tag-between-the-vocabulary-and-the-tile.md)). The tileset manifest maps a fixed list of tags to sheet positions, and a glyph table gives every tag an emoji, a roguelike letter and a colour. The vocabulary must use a tag from that list; a wrong one is a validation error the model is asked to fix. Every art style reads the tag, which is why the style can change while the map is still being generated.

**The vocabulary is shipped for the presets and editable for everyone** ([ADR 0004](adr/0004-ship-the-vocabulary-for-every-preset-and-let-the-reader-edit-it.md)). The creative call is most of a world's cost, and a preset asks the same question every time. The eight preset vocabularies were written once (by Claude, in the build session) and pass the same validation a generated one must pass. The setup screen shows the vocabulary in a box that a person can read, edit or clear.

**Plain code checks the result.** The reachability check is a two-minute breadth-first search, and it catches the one class of broken map that no per-cell decision can see.

### How a cell is decided

For each cell the decision model receives a small state: the world's name and summary, the setting text, the cell's coordinates and which grid edges it touches, its placed 8-neighbours with their types, type counts within two steps, and type counts for the whole map so far. It never receives the whole grid. It is asked one `choice` question whose options are the type ids, each described with its label, description, placement rules and flags. It answers with a choice, a confidence and a probability per option.

### Files

| File | What it holds |
|---|---|
| `openRouterClient.js` | The **only** file that calls the network: `checkKey`, `listModels`, `generate`, `decide` |
| `models.js` | Default model ids, the catalogue read from OpenRouter, and which endpoint a model needs |
| `settings.js` | The key, the model choices and the art style, in an injected storage |
| `vocabulary.js` | The vocabulary prompt, its JSON schema, validation, the ask-again loop, and reading the setup box's text |
| `cellDecision.js` | The per-cell state and question, reading the answer, sampling a type, the chat stand-in, the fallback |
| `generation.js` | The sequential loop with retries, fallbacks and stop conditions; `createDecider` picks the transport |
| `orderStrategies.js` | The five generation orders behind `nextCoordinate(placed)` |
| `grid.js` | The grid, neighbours, counts, JSON in and out |
| `reachability.js` | The flood fill |
| `tileset.js` | The visual-tag manifest and the sheet geometry |
| `tileStyles.js` | The four art styles, and the emoji, letter and colour of every visual tag |
| `presetVocabularies.js` | One ready vocabulary per suggestion chip |
| `camera.js` | Pan, zoom and hit-testing arithmetic |
| `presets.js` | Setting suggestions, grid sizes, the shape of a setting, and matching a link's setting back to its preset |
| `urlState.js` | What the link carries: the screen and the setup, never the key |
| `random.js` | A seeded random number generator and coordinate hashing |
| `openRouterErrors.js` | Turns a failed call into one sentence that names the fix |
| `render.js` | Drawing on the canvas (visual, untested) |
| `app.js` | The page: listening, calling the modules, building elements (untested) |
| `deployStamp.js`, `deployText.js` | The "deployed at" line in the footer |
| `invariants.test.js` | The decisions that must keep holding |
| `tileset.png` | The Urizen 1-bit tileset, v2.0 |

## Roadmap

Each phase is a complete, demoable state before the next one starts.

- [x] **Phase 1 — Map generator + inspector (the hackathon deliverable).** Setup screen with presets, grid size and order picker. AI Setup screen with key, test connection and model pickers. Vocabulary generation with validation and retry. Sequential per-cell generation, rendered live. Reachability check. Map tool: pan, zoom, click a cell for its properties. Urizen tileset.
- [x] **Phase 2 — Map personalisation.** Change a cell's type by hand, ask the model again about one cell, download and load the map as JSON. *(Landed with Phase 1 because the architecture made it cheap; the "goal placement" use of it waits for Phase 6.)*
- [x] **Phase 2b — Styles and a free start.** Four switchable art styles, and a shipped, editable vocabulary for every preset so a preset world makes no creative call. *(Asked for after the first live runs showed the creative call was most of the cost.)*
- [x] **Phase 2c — Measured quality.** Three specifications with deterministic metrics, fifteen seeded test cases, and a Galtea product where every iteration of the generator is a version with its scores. The baseline is `v1`.
- [ ] **Phase 3 — Interactive element detail generation.** A second pass over interactable cells that fills each type's self-declared `instanceFields`, typed values through `decide()` and flavour text through `generate()`, grounded in the setting.
- [ ] **Phase 4 — Player + movement.** A player token, keyboard and click movement, optional fog of war.
- [ ] **Phase 5 — Interaction narrative.** The player interacts with an object or a person; `generate()` writes dialogue or an outcome grounded in that cell's instance properties.
- [ ] **Phase 6 — Goal system.** Reintroduce the goal/objective input, define a win condition, hook it into the narrative model.
- [ ] **Stretch — Galtea-flavoured consistency checker.** Validate every `decide()` and `generate()` output against the declared constraints (interactable and barrier at once, unreachable regions, types outside the vocabulary, missing `instanceFields`) and surface a live "world consistency score". Worth naming in the demo pitch.

## Ideas and open questions

Anything raised mid-build that is not ready to implement yet. Add to it; strike through what is settled.

- **Sampling versus the argmax.** The map samples a type from the returned probabilities (options below 8% of the best are dropped). It gives variety; it also means a "wall" can appear where the model was 70% sure of "floor". A slider from "as the model says" to "surprise me" would let the demo show both. The loop already takes a `spread` parameter for this; only the control is missing.
- **Jev has no endpoints listed publicly** on OpenRouter's `/models/~typesafe/jev-latest/endpoints` as of 2026-09-19, and the `alpha/decisions` endpoint could not be exercised without a key. The chat stand-in is the plan B for the demo. Confirm the real shape of a Jev answer on the first key-holding run and adjust `readDecisionAnswer` if the payload differs.
- **Placement rules are prose.** The model reads them and the reachability check catches sealed rooms, but nothing enforces "never next to X" mechanically. A rule language (adjacency lists in the vocabulary, checked in code) would be the Galtea stretch goal's first concrete rule.
- **Larger maps** are limited by one sequential call per cell (a 24 × 24 map is 576 calls). Parallel decisions are possible for the random order (no dependency between cells) and for cells far apart in the frontier order. Not done, because the visible sequence is the demo.
- **Sealed regions could be repaired** automatically (replace one barrier between two regions with the most common walkable type) rather than only reported.
- **The tileset manifest was read off the sheet by eye.** Some tags are approximations (`bridge` is a plank, `trap` is a hatched pit). A Kenney style (their CC0 roguelike packs, richer and coloured) would be a fifth entry in the style list with its own sheet and manifest; the code needs nothing else.
- **The vocabulary box is raw JSON.** Honest and dense. A form with one row per type (label, flags, tag, rules) would make editing common instead of possible. Wait until somebody edits.
- **Shipped vocabularies go stale in spirit.** The tests catch one that no longer validates, not one that a better prompt would have written differently. Regenerate them with the model when the prompt changes meaningfully, and paste the answers back.
- **A monotone map fools the path metrics.** A map that is all corridor scores 1.0 on every path metric. The paths specification needs a metric that punishes paths covering most of the map (a `path-share-in-range`, like the barrier one), and the structures specification could use one that asks for at least one enclosed room. Add them once the first three specifications are agreed, so v1 stays comparable.
- **The generator collapses to one type.** Jev gives the ground type 85% or more on almost every cell once a few neighbours are ground. Candidates to try, one version each: drop the "prefer the most common ground type" line; put the target counts from the placement rules into the state; sample with a higher spread or a temperature; ask two questions per cell (kind of cell first, then which type).
- **Cost display**: OpenRouter returns token usage per call; summing it into "this world cost $0.03" would make the pitch concrete, and would show that a preset world costs cents.

## Evaluation in Galtea

The quality of the maps is measured, not eyeballed ([ADR 0005](adr/0005-the-map-is-evaluated-against-specifications-in-galtea.md)). Three specifications say what a good map does, each with a few deterministic metrics computed from the finished grid, and each with a dataset of five seeds:

| Specification | Metrics |
|---|---|
| Barriers form structures, not debris | share of barrier cells with a barrier neighbour; share in a group of 3 or more; barrier share in a healthy range |
| Paths form continuous routes | share of path cells with a path neighbour; share in the largest path network; share with two or more path neighbours |
| Every walkable area is reachable, and the map is playable | share of walkable cells in the largest region; 1 / number of regions; walkable share in range; vocabulary coverage; share of cells the model answered |

Every iteration of the generator is a version in [Galtea](https://galtea.ai): one session per test case, one inference result with the parameters and the map, one evaluation per metric. The rules live in `evaluation/mapMetrics.js` and are tested like the rest of the code.

```bash
cd web-projects/ai-world-gen/evaluation
pip install -r requirements.txt                         # once: the Galtea SDK
python evaluate.py setup                                # once: the product, specifications, metrics and datasets
OPENROUTER_API_KEY=sk-or-... python evaluate.py run --version v1 --description "baseline"
python evaluate.py report --version v2 --against v1     # after the next iteration
```

The keys live in `evaluation/.env` (copy `.env.example`; git-ignored). The models are pinned there (`typesafe/jev-1.13`, `anthropic/claude-sonnet-5`), so runs stay comparable when OpenRouter adds newer ones. Results are also written to `evaluation/results/vN.json`.

### Baseline, v1 (2026-09-19)

| Specification | Mean score |
|---|---|
| Barriers form structures, not debris | 0.19 |
| Paths form continuous routes | 0.99 |
| Every walkable area is reachable, and the map is playable | 0.68 |

What v1 actually draws: **monotone maps**. Thirteen of the fifteen use one type for more than 85% of the cells (a village that is all grass with one oak, a station that is all corridor, a mansion that is all hall floor); vocabulary coverage averages 0.15. The few barriers are scattered singles. The per-cell instruction "where nothing is placed nearby, prefer the most common ground type" plus neighbour reinforcement plus sampling makes the ground type win every cell. The paths score is high for the wrong reason: a map that is all corridor has no isolated path cell. That is the first thing to fix in the generation, and the first gap in the metrics (see open questions).

## Tests

```bash
cd web-projects/ai-world-gen && bun test
```

Every non-visual module has a sibling `*.test.js`, written first (root ADR 0012). `render.js`, `app.js` and `openRouterClient.js` have none by design.

## Privacy

Everything runs in your browser. The only server this page talks to is `openrouter.ai`, with your own key, and the key is sent nowhere else. When "Remember this key" is on, it is kept in this browser's `localStorage`; anything else with access to this browser can read it, so set a credit limit on the key and forget it here when you are done.

## Credits

Tiles: [Urizen 1-bit tileset](https://vurmux.itch.io/urizen-onebit-tileset) by vurmux, CC0. Credit is not required and is given gladly.
