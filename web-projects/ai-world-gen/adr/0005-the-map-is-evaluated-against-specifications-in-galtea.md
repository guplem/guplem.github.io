# ADR 0005: The map is evaluated against written specifications, in Galtea, before every iteration

## Context

The maps the model produces are not always good. Walls appear in open ground
with nothing around them, paths break into dots, a room ends up sealed. The
work from here on is to improve the generation: the prompts, the state each
cell sees, the sampling, the orders. Every one of those changes can make one
kind of map better and another worse, and a person looking at three maps
cannot tell.

The project already has a correctness net in code (`reachability.js`, ADR
0002). What it lacks is a way to say, in numbers, whether version 12 draws
better maps than version 11, over the same worlds, with the same seeds.

Galtea is the platform for this kind of question: a product with versions,
specifications of what the product must do, datasets of test cases, sessions
that hold what the product answered, and metrics that score each answer. It
is also the hackathon's co-organiser and the author's employer, so the
evaluation is part of the pitch, not only of the process.

## Decision

**Written specifications, each with deterministic metrics computed in this
project's own code, one judge metric for the question code cannot answer,
and one Galtea version per iteration of the generator.**

1. **The rules are code first.** `evaluation/mapMetrics.js` holds the seven
   specifications and their 27 computed metrics as data and functions, tested
   like every pure module. A metric is a number from 0 to 1 computed from the
   finished grid, its vocabulary and, where there is one, its blueprint, or
   null when the map gives it nothing to judge. `evaluate.py` reads the names
   from that file, so a score in the Galtea dashboard traces back to one
   function. One judge metric, `reads-as-the-setting`, is declared in the same
   file with its prompt; Galtea's evaluator (GPT-5.2) scores it from the
   logged map.

2. **Galtea holds the product, the specifications, the datasets and the
   results.** `python evaluate.py setup` creates or finds them by name and
   writes their ids to `galtea.json`. Each specification is a Galtea
   specification linked to its metrics (source `self_hosted`, because this
   code computes the score; `partial_prompt` for the judge) and to one dataset
   of five test cases. A test case is the seed of one generation: preset,
   size, order, random seed. The coherence specification has a second dataset
   of three 16 by 16 maps, because a room or a street needs more than 8 by 8
   cells to exist.

3. **One version per iteration, one session per test case.** `python
   evaluate.py run --version vN` generates every test case with the same
   modules the page uses (`runTestCase.js`), then logs each map as one
   session with one inference result (input: the parameters; output: the map
   as text and JSON, with a PNG of the map drawn by `renderMap.py` attached
   as a file part) and one evaluation per metric with the computed score,
   then finishes the session, because a map is one turn and a session left
   open reads as an unfinished conversation. The local results are written to
   `results/vN.json`, and `report` prints the change against another version.

4. **Test cases use the shipped vocabularies and small grids.** The presets
   make the creative call unnecessary (ADR 0004), and 8 by 8 cells keep a full
   run of 38 maps at about 3,000 decisions, a few cents and under ten minutes,
   so it can run before every pull request that touches the generation.

5. **A metric added later gets its history.** `python evaluate.py rescore
   --version vN` computes the current metrics on the saved grids of an old
   version, with no model call, and sends the scores that version had not been
   scored on to its sessions. Every metric can therefore be read from v1.

6. **The rules, in the order they were needed.** Three to begin with, from
   what the first maps got wrong: barriers form structures, not debris; paths
   form continuous routes; every walkable area is reachable and the map is
   playable. A fourth after v4, from what a person sees next to a hand-drawn
   map: a place reads as a place (doors in walls, walls as outlines, an
   enclosed room, ground in patches, things sprinkled). Three more after v7:
   the vocabulary's own typed rules hold on the finished map (the
   consistency checker the roadmap names); routes lead to doors and off the
   map; the unique landmarks are there, once, and nothing floods the map. More
   rules are more entries in `SPECIFICATIONS`, `METRICS` or `JUDGE_METRICS`,
   plus a dataset, then `setup` and `rescore`.

## Consequences

**Regressions have a number.** A change to the prompt is judged by the mean
score per specification against the previous version, on the same 38 seeds.
The tests in this folder guard the metrics themselves; the metrics guard the
maps.

**A new metric can rewrite the story of the old versions.** v1 scored 0.99
on paths because a map that is all corridor has no isolated path cell; the
path-share metric, added later and rescored, put it at 0.74. Read a version
table with its date.

**The metrics are proxies, and the model is not deterministic.** A wall with
one neighbour is "not isolated" even when it is still nonsense, and two runs
of the same seed give two maps, because the decisions come from a model. Read
the trend over fifteen cases, not one score, and add a metric when a failure
you can see has no number.

**Two keys are needed to run it.** OpenRouter for the generation and Galtea
for the results. Neither is in the repository; `galtea.json` holds ids only.

**The judge is one metric, and it is fragile.** `reads-as-the-setting` reads
the ASCII map, the legend and the grid as JSON and scores how much the map is
the place the preset names. It is the only metric for "does this look like a
village?", and it is asynchronous, paid, and model-dependent: claude-sonnet-5
put its score inside the reason text and every evaluation failed; GPT-5.2
answers in the expected shape. Its score is not in the local summary; read
it in the dashboard.

**Rejected: compute the scores in Python.** The rules would then live in two
languages, and the stretch goal of a live consistency score inside the page
(the README's Galtea-flavoured checker) needs them in JavaScript. **Rejected:
judge every metric with a model.** Slower, dearer, and less trustworthy than
a flood fill for the questions a flood fill can answer.
