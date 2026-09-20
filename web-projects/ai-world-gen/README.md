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

For each cell the decision model receives a small state: the world's name and summary, the setting text, the cell's coordinates and which grid edges it touches, its placed 8-neighbours with their types, type counts within two steps, type counts for the whole map so far, and two things the code works out for it. A **balance sheet**: each type's target share, read from the rarity word in its placement rules ("most common" 45%, "common" 15%, "uncommon" 6%, "rare" 2%), against its share so far, with the types most below target listed as needed and those far above as overused. And **continuation hints**: the barrier and route lines that reach the cell from its four sides with their length, the types standing on two opposite sides, and one *suggested* type when a gap can be closed or a line shorter than four cells continued (never an overused type). It never receives the whole grid. It is asked one `choice` question whose options are the type ids, each described with its label, description, placement rules and flags, with an instruction to follow the suggestion when there is one and the balance sheet when there is none. It answers with a choice, a confidence and a probability per option.

### Files

| File | What it holds |
|---|---|
| `openRouterClient.js` | The **only** file that calls the network: `checkKey`, `listModels`, `generate`, `decide` |
| `models.js` | Default model ids, the catalogue read from OpenRouter, and which endpoint a model needs |
| `settings.js` | The key, the model choices and the art style, in an injected storage |
| `vocabulary.js` | The vocabulary prompt, its JSON schema, validation, the ask-again loop, and reading the setup box's text |
| `blueprint.js` | Where the structures stand: seeded rectangles with a door, drawn from the vocabulary's `structures` before any cell is decided |
| `cellDecision.js` | The per-cell state and question (the cell's part of the plan, the allowed types, the map sketch, the balance sheet, the hints), reading the answer, sampling a type, the chat stand-in, the fallback |
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
- [x] **Phase 2c — Measured quality.** Specifications with deterministic metrics, seeded test cases, and a Galtea product where every iteration of the generator is a version with its scores. The baseline is `v1`; there are seven specifications and 38 test cases now, three of them 16 × 16.
- [x] **Phase 2d — Places, not tiles.** Nine measured versions (below): a typed `placement` per type and `structures` per world, a blueprint that draws each structure as a rectangle with a door before the model fills it, hard rules enforced before the model answers, and a state that names what the world still lacks. Coherence went from 0.50 to 0.89.
- [ ] **Phase 3 — Interactive element detail generation.** A second pass over interactable cells that fills each type's self-declared `instanceFields`, typed values through `decide()` and flavour text through `generate()`, grounded in the setting.
- [ ] **Phase 4 — Player + movement.** A player token, keyboard and click movement, optional fog of war.
- [ ] **Phase 5 — Interaction narrative.** The player interacts with an object or a person; `generate()` writes dialogue or an outcome grounded in that cell's instance properties.
- [ ] **Phase 6 — Goal system.** Reintroduce the goal/objective input, define a win condition, hook it into the narrative model.
- [ ] **Stretch — Galtea-flavoured consistency checker.** Validate every `decide()` and `generate()` output against the declared constraints (interactable and barrier at once, unreachable regions, types outside the vocabulary, missing `instanceFields`) and surface a live "world consistency score". The "rules hold" specification already computes the map half of it in `evaluation/mapMetrics.js`; the live score on the page is what remains.

## Ideas and open questions

Anything raised mid-build that is not ready to implement yet. Add to it; strike through what is settled.

- **Sampling versus the argmax.** The map samples a type from the returned probabilities (options below a third of the best are dropped since v6; at 8% the sample overrode the model on a quarter of the cells). A slider from "as the model says" to "surprise me" would let the demo show both. The loop already takes a `spread` parameter for this; only the control is missing.
- **Jev has no endpoints listed publicly** on OpenRouter's `/models/~typesafe/jev-latest/endpoints` as of 2026-09-19, and the `alpha/decisions` endpoint could not be exercised without a key. The chat stand-in is the plan B for the demo. Confirm the real shape of a Jev answer on the first key-holding run and adjust `readDecisionAnswer` if the payload differs.
- ~~**Placement rules are prose.**~~ Settled in v7 and v8: each type carries a typed `placement` (zone, never next, only next, edge) that code enforces before the model answers, and the "rules hold" specification checks the finished map against it. The prose stays as the description the model reads.
- **Larger maps** are limited by one sequential call per cell (a 24 × 24 map is 576 calls). Parallel decisions are possible for the random order (no dependency between cells) and for cells far apart in the frontier order. Not done, because the visible sequence is the demo.
- **Sealed regions could be repaired** automatically (replace one barrier between two regions with the most common walkable type) rather than only reported. Less pressing since v8: every planned room has a door, and the regions that still split come from free-standing barriers (trees, dunes, pipes) the model draws across the map.
- **The tileset manifest was read off the sheet by eye.** Some tags are approximations (`bridge` is a plank, `trap` is a hatched pit). A Kenney style (their CC0 roguelike packs, richer and coloured) would be a fifth entry in the style list with its own sheet and manifest; the code needs nothing else.
- **The vocabulary box is raw JSON.** Honest and dense. A form with one row per type (label, flags, tag, rules) would make editing common instead of possible. Wait until somebody edits.
- **Shipped vocabularies go stale in spirit.** The tests catch one that no longer validates, not one that a better prompt would have written differently. Regenerate them with the model when the prompt changes meaningfully, and paste the answers back.
- ~~**A monotone map fools the path metrics.**~~ Settled: `path-share-in-range` and `enclosed-room-exists` exist, and every version was rescored with them (v1's paths score went from 0.99 to 0.74).
- ~~**Closed shapes need a door.**~~ Settled in v8: the blueprint gives every planned room one door in a wall that faces the middle of the map.
- ~~**Sampling noise.**~~ Settled in v6: the floor is a third of the best option.
- **Coverage is the price of the plan.** With the options narrowed to a cell's part, the rarer types come up less: coverage fell from 0.72 (v5) to 0.52 (v8). v9's `missing` list is the first answer; if it is not enough, a target count per type in the plan (the way structures have one) is the next.
- ~~**Paths still flood the outside.**~~ Settled in v11, once v10 showed the flood was a vocabulary problem: a route type that is also the only floor. The rule for a vocabulary is now: the most common cell is a ground, and a route is a line on it. The hard cap (v10) stays as a guard.
- **Routes are stubs.** With the flood gone, the corridors are two or three cells that lead nowhere (path continuity 0.58, doors with a route 0.79 in v11). A route between two doors, or from a door to the map edge, is a shape, and the blueprint should draw it the way it draws the rooms: one-cell paths from door to door, then the model fills the rest. This is the next version.
- **Empty rooms.** A planned interior is mostly floor: the model rarely puts the chest in the cottage or the console in the lab. A per-room "this room still lacks" hint (the indoor things not yet in this room) is the room-sized version of `missing`.
- **Free-standing barriers split the map.** Trees, dunes and pipes are the barriers the blueprint does not place, and they are what still splits walkable regions (0.77 in v8). Either the plan places them too (as clusters with a declared count) or the reachability check repairs one cell.
- **Structures could touch.** The blueprint keeps a one-cell gap between rectangles. The reference maps have rooms that share a wall (a dungeon, a mansion); a shared-wall mode per structure would give those settings their look.
- **Cost display**: OpenRouter returns token usage per call; summing it into "this world cost $0.03" would make the pitch concrete, and would show that a preset world costs cents.

## Evaluation in Galtea

The quality of the maps is measured, not eyeballed ([ADR 0005](adr/0005-the-map-is-evaluated-against-specifications-in-galtea.md)). Seven specifications say what a good map does, each with a few deterministic metrics computed from the finished grid, and each with a dataset of five 8 × 8 seeds. The fourth also has a second dataset of three 16 × 16 maps, because a room or a street needs more than 8 × 8 cells to exist:

| Specification | Metrics |
|---|---|
| Barriers form structures, not debris | share of barrier cells with a barrier neighbour; share in a group of 3 or more; barrier share in a healthy range |
| Paths form continuous routes | share of path cells with a path neighbour; share in the largest path network; share with two or more path neighbours; path share in a healthy range |
| Every walkable area is reachable, and the map is playable | share of walkable cells in the largest region; 1 / number of regions; walkable share in range; vocabulary coverage; share of cells the model answered |
| A place reads as a place | share of doors set into a wall; share of barrier cells that are an outline rather than a filled block; whether one enclosed room exists; share of ground cells in a patch of their own type; interactable share in range |
| The vocabulary's own rules hold | share of cells respecting a never-next rule, an only-next rule, an edge rule, a zone rule |
| Routes lead to doors and off the map | share of doors passable on both open sides; share of doors with a route next to them; whether the main route reaches the map edge |
| Landmarks are there, once, and nothing floods the map | share of unique types present; share of those present exactly once; no type covering more than half the map; interactable things standing next to plain ground; and one judge metric, "reads as the setting", that Galtea's evaluator (GPT-5.2) scores from the logged map |

Every iteration of the generator is a version in [Galtea](https://galtea.ai): one session per test case, one inference result with the parameters and the map, one evaluation per metric. The rules live in `evaluation/mapMetrics.js` and are tested like the rest of the code. A metric added later gets its history with `rescore`, which computes the current metrics on the saved grids of an old version, with no model call, and sends the new scores to that version's sessions.

```bash
cd web-projects/ai-world-gen/evaluation
pip install -r requirements.txt                         # once: the Galtea SDK, the renderer and its upload
python evaluate.py setup                                # once: the product, specifications, metrics and datasets
OPENROUTER_API_KEY=sk-or-... python evaluate.py run --version v1 --description "baseline"
python evaluate.py report --version v2 --against v1     # after the next iteration
python evaluate.py rescore --version v1                 # after a new metric: score the saved maps of v1 with it
python evaluate.py backfill --version v1                # after a new dataset: draw its cases with v1's own code
```

Every map is also drawn as a PNG with the page's own tiles, saved under `evaluation/results/vN/`, and attached to the Galtea output next to the ASCII view, so a result can be seen at a glance in the dashboard and compared across versions in the repository. The keys live in `evaluation/.env` (copy `.env.example`; git-ignored). The models are pinned there (`typesafe/jev-1.13`, `anthropic/claude-sonnet-5`, and `GPT-5.2` as the judge), so runs stay comparable when OpenRouter adds newer ones. A full run is 38 maps and about 3,000 decisions: a few cents of Jev and under ten minutes. Results are also written to `evaluation/results/vN.json`.

### Versions so far (2026-09-20)

Mean score per specification over the 38 test cases, with every metric as it is today (older versions were rescored, so v1's paths score is no longer the 0.99 it first showed). Seven columns: structures, paths, reachable and playable, a place reads as a place, the vocabulary's rules hold, routes lead to doors, landmarks and story.

| Version | What changed | Struct. | Paths | Reach. | Place | Rules | Routes | Story |
|---|---|---|---|---|---|---|---|---|
| v1 | The generator as first shipped | 0.18 | 0.74 | 0.69 | 0.48 | 0.83 | (1.00) | 0.07 |
| v2 | Balance sheet in the state; "prefer the ground type" line removed | 0.39 | 0.53 | 0.75 | 0.43 | 0.58 | 0.77 | 0.61 |
| v3 | Continuation hints; instruction says "structures first, continue the line" | 0.68 | 0.66 | 0.82 | 0.50 | 0.49 | 0.62 | 0.79 |
| v4 | Code judges the one suggested continuation (short lines, closable gaps, never an overused type) | 0.82 | 0.80 | 0.77 | 0.50 | 0.62 | 0.66 | 0.66 |
| v5 | The whole map in the state, one letter per cell | 0.93 | **0.82** | 0.81 | 0.53 | 0.49 | 0.70 | 0.76 |
| v6 | Sampling floor from 8% to a third of the best option | 0.95 | 0.81 | 0.81 | 0.51 | 0.61 | 0.60 | 0.68 |
| v7 | Typed `placement` per type (zone, never next, only next, edge), enforced before the model answers | 0.95 | 0.80 | 0.82 | 0.52 | 0.99 | 0.61 | 0.78 |
| v8 | The blueprint: code places each structure as a rectangle with a door; each cell is offered only its part's types | **0.99** | 0.75 | 0.84 | **0.89** | 0.99 | 0.78 | 0.77 |
| v9 | The state names what the world still lacks; a unique type is out once placed; a route is suggested outside a planned door | 0.98 | 0.80 | 0.87 | 0.87 | 0.98 | 0.87 | **0.84** |
| v10 | Hard cap: a ground type past twice its target is not offered while another ground is allowed | 0.98 | 0.78 | 0.87 | 0.88 | 0.99 | 0.86 | 0.83 |
| v11 | The station and the city block get a ground that is not a route (open deck, plaza); corridor and street become lines | 0.98 | 0.77 | **0.88** | 0.88 | **0.99** | 0.82 | 0.83 |

Every version is scored on the same 38 seeds: the seeds a dataset added later were drawn afterwards with that version's own code (`evaluate.py backfill`), so a row is a mean over the same maps as every other row. v1's routes score is in brackets because v1 drew almost no doors, so there was little to judge.

What each version actually drew:

- **v1: monotone maps.** Thirteen of fifteen used one type for more than 85% of the cells (a village that is all grass with one oak, a station that is all corridor); vocabulary coverage 0.15.
- **v2: confetti.** The balance sheet fixed coverage (0.91) but the model placed the needed types anywhere: single walls, single path cells, nothing joined up.
- **v3: floods.** Told to continue every line, the model did, across the map: 39 path cells in a village, 58 corridors in a station.
- **v4: lines.** With the continuation judged by code, walls form lines and closed shapes and routes mostly join up. But 21 of 23 doors stood in open ground, walls came as filled blocks, and no map had a room you could enter.
- **v5: the model reads the sketch, a little.** Showing the whole map moved coherence from 0.50 to 0.53 and left doors in walls where they were (0.26 to 0.22): the gain the first 23 seeds showed on doors did not survive the same 38 seeds. The 16 × 16 maps showed the limit: walls still come as solid slabs, because a model deciding one cell cannot see where a rectangle should end.
- **v6: less noise.** The sample had been overriding the model's own choice on 27% of the cells. At a third of the best option it overrides 18%: ground in patches 0.25 to 0.52, fewer split regions, and the rare types lost their chances (coverage 0.72 to 0.54).
- **v7: the local rules hold, the rooms do not.** With the typed rules enforced, "rules hold" went from 0.61 to 0.98 and nothing else moved: "never next to X" cannot say "in a wall".
- **v8: rooms.** The blueprint draws each structure first. Doors in walls 0.15 to 0.96, an enclosed room on every map, structures 1.00, one walkable region 0.56 to 0.77. The price: coverage 0.52, and the route type spread over the outside.
- **v9: the world remembers what it lacks.** Landmarks single 0.68 to 1.00, doors with a route 0.56 to 0.88, coverage 0.52 to 0.73, interactable share 0.78 to 0.97. Doors passable fell to 0.82: the model now puts a console or a bed right behind the door.
- **v10: the cap that could not fire.** A ground type past twice its target is no longer offered, but the maps that flooded were the settings whose vocabulary made the route the only floor (corridor in the station: 0.53 of the map; street in the block: 0.58), where nothing else may fill the cell. Route share of the map stayed at 0.24 overall.
- **v11: a floor that is not a road.** The station gets an open deck and the block a concrete plaza; corridor and street become lines. Path share in range 0.65 to 0.84, the station's route share 0.53 to 0.12. The corridors are now short stubs on the deck (path continuity 0.73 to 0.58, doors with a route 0.90 to 0.79): a route between two doors is a shape, and shapes are the plan's job.

Pictures of every map of every version are under `evaluation/results/vN/`.

## Tests

```bash
cd web-projects/ai-world-gen && bun test
```

Every non-visual module has a sibling `*.test.js`, written first (root ADR 0012). `render.js`, `app.js` and `openRouterClient.js` have none by design.

## Privacy

Everything runs in your browser. The only server this page talks to is `openrouter.ai`, with your own key, and the key is sent nowhere else. When "Remember this key" is on, it is kept in this browser's `localStorage`; anything else with access to this browser can read it, so set a credit limit on the key and forget it here when you are done.

## Credits

Tiles: [Urizen 1-bit tileset](https://vurmux.itch.io/urizen-onebit-tileset) by vurmux, CC0. Credit is not required and is given gladly.
