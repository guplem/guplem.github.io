# ADR 0004: Ship the vocabulary for every preset, and let the reader edit it

## Context

The first real runs showed where the money goes. A map of 144 cells costs a
few hundred decision calls at about $0.04 per million tokens, which rounds to
nothing. The vocabulary costs one call to a frontier text model with a long
prompt and a long JSON answer, and that one call is most of the bill for a
world.

The vocabulary is also the part a person might want to read and change. It is
the list of what the world is made of, and a wrong placement rule or a missing
type shows up on every cell of the map. Until now it was written by the model,
used once, and shown to nobody.

For the eight setting presets the setting text never changes, so the same
question was asked of the model again and again, for the same answer.

## Decision

**Every preset ships its vocabulary, and the vocabulary is a field on the
setup screen.**

1. **`presetVocabularies.js` holds one vocabulary per preset**, in the exact
   shape `vocabulary.js` asks a model for. They were written by Claude in the
   build session, not by the page at run time. `presetVocabularies.test.js`
   and `invariants.test.js` run each one through `normaliseVocabulary`, the
   same validation a generated answer must pass, so a shipped vocabulary can
   never be one the page would reject from a model.

2. **The setup screen has a "Vocabulary (optional)" box.** It holds the
   vocabulary as JSON. A preset chip fills it. A link whose setting still
   equals a preset fills it too (`presets.presetMatching`). A person may edit
   any word, paste their own, or clear it. `vocabulary.describeVocabularyText`
   reads the box into one of three states, and the one-line summary under the
   box says which: empty (the model writes it, one paid call), valid (no call),
   or invalid (the same errors a model would be asked to fix).

3. **Generation uses the box when it is valid and refuses when it is not.** An
   invalid box opens itself and shows its errors instead of silently falling
   back to the model. An empty box means the model writes the vocabulary, and
   the answer is written back into the box, so the next run of that world is
   free and the person can see what they paid for.

4. **A loaded map fills the box too**, so a saved world can be regenerated with
   its own vocabulary and a different order or size.

## Consequences

**A preset world costs only its decisions.** The demo's opening beat, a preset
chip and a map, no longer waits on a frontier model or a rate limit.

**The vocabulary is visible and editable.** That is the point of a schema the
model fills: a person can now write "never next to the river" and watch the
next map obey it. The box is raw JSON, which is honest and dense; a form with
one row per type is the obvious next step if editing turns out to be common.

**Shipped text goes stale.** A change to the schema, the visual tags or the
prompt rules must be reflected in eight hand-written vocabularies. The tests
catch a shipped vocabulary that no longer validates; they cannot catch one that
is merely dull. Regenerate them with the model when the prompt changes in
spirit, and paste the answers back.

**The box does not travel in the link.** A vocabulary is too long for a URL
(root ADR 0006). A link carries the setting, and a preset setting brings its
vocabulary back; an edited vocabulary is kept only through the saved JSON map.

**Rejected: cache generated vocabularies in `localStorage` by setting text.**
It saves the second run on one device and nothing on the first, and it hides
the vocabulary instead of showing it. **Rejected: a per-type form instead of a
JSON box.** More code than the rest of the setup screen for a field most
people will not touch; it can come later without changing anything else.
