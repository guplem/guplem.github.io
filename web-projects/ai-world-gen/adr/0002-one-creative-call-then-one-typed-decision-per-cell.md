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
   placement rules, flags (`walkable`, `interactable`, `isBarrier`), a visual
   tag, and its own `instanceFields`. `vocabulary.js` validates the answer and,
   when it is wrong, sends the errors back and asks again, three times at most.
   That is the one job here that is genuinely generative.

2. **`decide()` places every cell.** For each cell, `cellDecision.js` builds a
   small state (the world, the cell and its edges, the placed 8-neighbours,
   type counts within two steps, type counts for the whole map so far, a
   balance sheet of each type against its target share, and the barrier and
   route lines that reach the cell with one code-judged suggestion) and one
   `choice` question whose options are the type ids, each described with its
   rules. The model answers with a choice and probabilities. The state never
   carries the grid.

   The two judgements are code on purpose. Measured against the
   specifications (ADR 0005): a model that sees only neighbours collapses the
   map to one type (v1); a balance sheet alone scatters the vocabulary (v2);
   an instruction to continue every line floods the map (v3); a suggestion
   limited by code to short lines and closable gaps builds structures (v4).

3. **The two are not interchangeable.** `openRouterClient.js` has two methods
   with two request shapes and two endpoints. `models.transportFor` says which
   one a model needs. A text model may stand in for Jev through the chat
   endpoint when Jev is down; a decisions model can never write a vocabulary.

4. **The map samples the probabilities.** `chooseType` draws a type from the
   returned probabilities rather than taking the top one, and drops options
   below 8% of the best. A model that is 60% sure of "floor" and 40% of "wall"
   should give a map with some walls, not a solid floor.

5. **The order is a strategy.** `orderStrategies.js` answers
   `nextCoordinate(placed)` five ways. The order decides which neighbours exist
   when a cell is asked about, so it changes the map as much as the model does.

6. **The loop is sequential and visible.** `generation.js` decides one cell,
   draws it, then asks about the next. The per-cell latency on screen is the
   demo. It retries transient failures with a growing pause, marks a cell that
   still fails as a fallback, and stops on a failure that would repeat (a bad
   key, no credits, a model that is not served) or after four failures in a
   row.

7. **Plain code checks the result.** `reachability.js` flood-fills the walkable
   cells when the map is complete. No per-cell decision can see that two rooms
   never meet; a breadth-first search over the finished grid can.

## Consequences

**Cost and speed are where they should be.** One narrative call of a few
thousand tokens, then a few hundred decision calls of about a thousand input
tokens each. A 24 by 24 map is a few cents.

**Errors cascade.** A wrong early cell shapes its neighbours. The spiral and
frontier orders keep that local; the random order shows it clearly. The
reachability check catches the one structural failure, and the inspector shows
the model's probabilities for every cell so a reader can see where it was
unsure.

**Placement rules are prose.** The decision model reads them; nothing checks
them mechanically. A rule language checked in code is the natural first piece
of the consistency-checker stretch goal, and it is listed in the README's
open questions.

**Everything but the network is testable.** `runGeneration` takes `decide` as
a parameter, `generateVocabulary` takes `generate`, and both are tested with a
fake model. `openRouterClient.js` is the one untested file.

**Rejected: the whole map in one call.** Nothing to watch, one failure loses
all, and a language model doing a classifier's job. **Rejected: a language
model per cell as the default.** It works, and it is kept as the stand-in, but
it is slower, dearer, and turns a typed decision back into text parsing.
**Rejected: no model per cell (procedural placement from the vocabulary's
rules).** It would need a rule language the model cannot yet be asked to
write reliably, and it removes the part worth showing.
