# ADR 0004: One message catalogue, so generated explanations translate too

## Context

The tool speaks English and Spanish. Most of the page is fixed text, which any
translation approach handles. The hard part is that this tool's main output is
**generated prose**. A hint reads:

> Inside box 1, 7 has only one place left, and that place is r3c3. The other
> empty cells of box 1 cannot take 7: r1c1 and r1c2 see the 7 in r1c9.

That sentence is assembled at run time from a move: a house, a digit, a list of
cells, and a list of blocking cells. There is no fixed string to translate.

The options:

- **Two copies of the explanation code**, one per language. Every technique's
  reasoning would exist twice, and the two copies would drift.
- **Translate the finished English sentence**, with a service or a table of
  phrases. It needs a network call, and it would mistranslate the notation.
- **Build every sentence from a keyed template with named slots**, and keep one
  entry per language for each key.

## Decision

**All text lives in one flat catalogue in `i18n.js`, keyed, with one entry per
language, and `t(lang, key, params)` fills the `{name}` slots.**

- `explain.js` writes no sentence of its own. It picks a key and hands over the
  cells and digits. The same code path produces both languages.
- The catalogue is flat, `key -> { en, es }`, so a translation sits next to the
  text it translates.
- Cell names (`r4c7`) are notation, not prose, and stay the same in every
  language. House names, relation words and joining words are keys.
- Every sentence is written so that no translation needs its arguments in a
  different order. That keeps the ordering rules of a language out of the
  explanation code.
- The language is part of the URL (`?lang=es`), following root ADR 0006, so a
  hint can be shared in the language it was read in. Without it, the page follows
  the browser.

`i18n.test.js` guards the catalogue: every key must exist in every language, no
key may carry a language the page does not offer, and every translation of a key
must use the same placeholders as the English one. A missing or mistyped
translation fails the build rather than reaching a player.

## Consequences

**Positive:**

- One explanation engine serves every language. A new technique is written once.
- A new language is a column in the catalogue and an entry in `LANGUAGES`; no
  logic changes.
- The tests make a half-finished translation impossible to merge.
- Nothing is fetched at run time, so the page still works offline.

**Negative:**

- Sentences must be phrased so their slots can stay in the same order in every
  language. That is a real constraint on the wording, and it will bind harder for
  a language whose word order differs more from English than Spanish does.
- Plural forms are handled with separate keys, chosen by the caller
  (`explain.witness.one` and `explain.witness.many`). A language with more plural
  categories than two would need a different mechanism.
- The whole catalogue loads with the page, in every language. It is a few
  kilobytes of text, which is cheaper than a fetch per language at this size, but
  it would not stay that way with many languages.
