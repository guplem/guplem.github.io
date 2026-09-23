# ADR 0002: One creative call, then one typed decision per cell

## Context

A map generator can ask a model for the whole map in one answer, or for one
cell at a time. It can ask a language model, or a model that only chooses.

Asking a language model for a 12 by 12 map as one JSON grid works for a demo
and fails for the pitch. The interesting part, "given what is around this
cell, what goes here", is buried inside one long generation, nothing is
visible until it is all done, and one malformed answer loses everything. A
per-cell loop with a language model shows the process but costs a full prose
completion for every cell, and the model has to be talked into answering with
one word.

TypeSafe's Jev is a different kind of model. It answers a **typed question**
about a **state**: one of N options, a position on a scale, or a probability.
It returns a choice, a confidence and a probability per option, in tens of
milliseconds, at about $0.04 per million input tokens. It does not write. The
hackathon that started this project was co-sponsored by its maker, and a use
of it that is decorative would be noticed.

## Decision

**Creative, open-ended work goes to a language model, once per world.
Repetitive, structured decisions go to a decision model, once per cell.**

1. **`generate()` writes the vocabulary.** A text model reads the setting and
   answers with strict JSON: 6 to 24 element types, each with a description,
   placement rules in prose, flags (`walkable`, `interactable`, `isBarrier`),
   a visual tag, its own `instanceFields`, and a typed `placement` (a zone,
   the types it is never or only next to, one map edge); plus the world's
   `structures`, each naming its wall, floor and door types, its size and its
   count. `vocabulary.js` validates the answer and, when it is wrong, sends the
   errors back and asks again, three times at most. That is the one job here
   that is genuinely generative.

2. **Code draws the blueprint.** Before any cell is asked about,
   `blueprint.js` places every structure as a rectangle inside its declared
   limits, with a gap from the others, at most half the map, and one door in
   a wall that faces the middle. Every cell then has a part: a wall, the door
   or the interior of a named structure, or outside every one. The plan is
   seeded, so a test case draws the same one every time.

3. **`decide()` places every cell.** For each cell, `cellDecision.js` builds a
   state (the world, the cell and its part of the plan, the whole map as one
   letter per cell, the placed 8-neighbours, type counts within two steps and
   for the whole map, a balance sheet of each type against its target share,
   the things the world still lacks that this cell could hold, the barrier and
   route lines that reach the cell with one code-judged suggestion, and the
   types the rules exclude here with the rule) and one `choice` question whose
   options are only the types that belong to the cell's part and pass its hard
   rules, each described with its prose rules. The model answers with a choice
   and probabilities.

   Every judgement about shape is code on purpose, and each one was measured
   against the specifications (ADR 0005) before it stayed: a model that sees
   only neighbours collapses the map to one type (v1); a balance sheet alone
   scatters the vocabulary (v2); an instruction to continue every line floods
   the map (v3); a suggestion limited by code to short lines and closable gaps
   builds lines (v4); showing the whole map helps a little (v5); sampling less
   noise helps the patches (v6); enforcing the local rules changes nothing
   about rooms (v7); and only a blueprint drawn first gives rooms with doors
   (v8: doors in walls from 0.14 to 0.95). A model that decides one cell at a
   time cannot draw a rectangle, however much it sees; a person decides where
   the buildings go first, and so does the code.

4. **The two models are not interchangeable.** `openRouterClient.js` has two methods
   with two request shapes and two endpoints. `models.transportFor` says which
   one a model needs. A text model may stand in for Jev through the chat
   endpoint when Jev is down; a decisions model can never write a vocabulary.

5. **The map samples the probabilities.** `chooseType` draws a type from the
   returned probabilities rather than taking the top one, and drops options
   below a third of the best. A model that is 60% sure of "floor" and 40% of
   "wall" should give a map with some walls, not a solid floor; one that is
   80% sure should not be overruled. At 8% the sample overrode the model on
   more than a quarter of the cells (v4, v5).

6. **The order is a strategy.** `orderStrategies.js` answers
   `nextCoordinate(placed)` five ways. The order decides which neighbours exist
   when a cell is asked about, so it changes the map as much as the model does.

7. **The loop is sequential and visible.** `generation.js` decides one cell,
   draws it, then asks about the next. The per-cell latency on screen is the
   demo. It retries transient failures with a growing pause, marks a cell that
   still fails as a fallback, and stops on a failure that would repeat (a bad
   key, no credits, a model that is not served) or after four failures in a
   row.

8. **Plain code checks the result.** `reachability.js` flood-fills the walkable
   cells when the map is complete. No per-cell decision can see that two rooms
   never meet; a breadth-first search over the finished grid can.

## Consequences

**Cost and speed are where they should be.** One narrative call of a few
thousand tokens, then a few hundred decision calls of one to two thousand
input tokens each, the map sketch included. A 24 by 24 map is a few cents.

**Errors cascade.** A wrong early cell shapes its neighbours. The spiral and
frontier orders keep that local; the random order shows it clearly. The
reachability check catches the one structural failure, and the inspector shows
the model's probabilities for every cell so a reader can see where it was
unsure.

**Placement rules are prose and typed.** The prose is advice the decision
model reads; the typed `placement` is enforced before it answers, and the
"rules hold" specification (ADR 0005) checks the finished map against the same
fields. The model followed simple prose ("never next to another villager", 0
of 20 broken in v4) and not spatial prose ("in a wall", 21 of 23 doors in
open ground), which is why the spatial part moved to the blueprint.

**The plan decides the shape, the model decides the content.** A wall cell
can still be a window, an interior cell a chest or a ghost, the outside
anything outdoors. What the model no longer decides is where a building
stands, and the version table in the README says why that was given up.

**Everything but the network is testable.** `runGeneration` takes `decide` as
a parameter, `generateVocabulary` takes `generate`, and both are tested with a
fake model. `openRouterClient.js` is the one untested file.

**Rejected, and measured: the whole map in one call.** Nothing to watch, one
failure loses all, and a language model doing a classifier's job. It is kept
as a second mode (`wholeMap.js`, the "How the map is filled" switch) so the
rejection has a number: on the same 38 seeds, with the plan and every rule in
its prompt, Claude Sonnet 5 closed a room on 47% of the maps (the loop: 92%),
held the typed rules at 0.76 (0.99) and led routes to doors at 0.61 (0.82),
while winning on landmarks (0.90 against 0.83) and on time (6 s against 90 s
for a 16 by 16 map) at the same cost per run. Control cell by cell, not
price, is what the loop buys.

**Kept as an experiment, and measured: every cell as one question in one
request.** The decisions endpoint takes `questions` as a map, so a whole map
of per-cell questions fits in one request (`batchedDecisions.js`, the same
switch, `v11-batch`). It works: Jev answered all 3,008 questions of the 38 seeds
in 49 requests, with no fallback, for $0.086 against $0.24 and 40 s of drawing
against 1,046 s. The maps are worse in exactly one way, and the way names the
decision this ADR records. Everything the code settles per cell before the
model is asked held (structures 0.97, zone 1.00, doors in walls 0.94, an
enclosed room on 0.95 of maps); everything that reads the cells around it
collapsed, because inside a batch there are none: 181 broken "never next to"
pairs, all 181 between two cells of the same batch (the loop: 11), a type whose
rules say "exactly one" placed more than once on 7 of 38 maps (the loop: 0,
worst case 39 staircases in one mansion), path continuity 0.58 to 0.26,
coverage 0.77 to 0.43, and the judge 0.69 to 0.57. Two scores rose because a
map that repeats itself is tidy: ground in patches 0.65 to 0.83, one walkable
region 0.72 to 0.93. The sequential loop is therefore not a habit: each
decision is worth what the decided cells around it are worth.

**Both experiments, measured at five stages of the loop.** Each ran again with
the code of v1, v4, v7 and v8, knowing only what that version gave Jev
(`evaluate.py run --code-of`, `evaluation/pastVersionVariants.js`). The one
call was about as good at v1 as at v11 (judge 0.68 and 0.65, where the loop
went from 0.09 to 0.69), and only rules about where things go moved it: the
typed rules at v7, the plan at v8. The batch rose at one version only, v8
(judge 0.20, 0.32 and 0.25 before it, 0.57 from it on), because every fix of
v2 to v7 reads the cells decided before. So what the loop's versions added is
control applied per cell, which neither shortcut can use except as code.

**Rejected: a language
model per cell as the default.** It works, and it is kept as the stand-in, but
it is slower, dearer, and turns a typed decision back into text parsing.
**Rejected: no model per cell (procedural placement from the vocabulary's
rules).** It would remove the part worth showing, and the content of a place
(what stands in which room, who walks where) is a judgement, not a rule.
Placing the structures is a rule, and that part is procedural since v8.
**Rejected: keeping the grid out of the state.** The first version never sent
it, for cost; a decision model at Jev's price reads a 24 by 24 sketch for a
fraction of a cent per map, and v5 measured a small gain from it.
