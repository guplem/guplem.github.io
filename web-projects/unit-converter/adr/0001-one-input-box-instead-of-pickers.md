# ADR 0001: One input box carries the whole interface

## Context

Almost every unit converter asks for three things in order: a kind of measurement, a unit to convert from, and a unit to convert to. That is three controls and at least three taps before a person sees a number, and the first of the three is a question they should never have been asked. Somebody who wants to convert kilometres already knows they mean length. The category picker asks them to say it again.

The three-control layout also makes a phone worse than a desktop. Two long dropdowns of a hundred units each are hard to scroll and hard to search, and they hide the units that are not open on screen.

We wanted the shortest path from "I have a number" to "I can read the answer".

## Decision

The page has one text input and nothing else.

A person types the amount and the unit together, the way they would say it out loud: `100 km`, `5'10"`, `1 1/2 cup`, `20°C`, `100 USD`. The unit they type is what decides the category, so no category is ever asked for. A target is optional and is typed in the same box: `100 km to mi`.

Three modules carry the weight this removes from the interface:

- `parse.js` reads the line. It accepts compound amounts (`5'10"`, `1h30m`), fractions (`1 1/2`), both European and English decimal marks, exponents, and currency signs before or after the number.
- `search.js` finds the unit. It matches symbols, full names in English and Spanish, accented and unaccented spellings, and single-letter typos.
- `app.js` shows a suggestion list under the box while a unit is still half-written, so a person who does not know what to type can still point at it.

For a person who does not know what to type at all, the empty state offers example lines and a grid of categories. Tapping either fills the box, so the categories are still reachable; they are just not in the way.

## Consequences

**Good**

- One tap to an answer instead of three, and the same interface on a phone and a desktop.
- The keyboard is enough: type, arrow down, Enter.
- Every shape a person might write is a feature request against one module, not against a control.

**Bad, and what we do about it**

- The search now carries the whole interface. A unit that cannot be found does not exist as far as the reader is concerned. So `units.js` holds many aliases per unit, `search.js` tolerates typos, and `units.test.js` checks that every unit answers to its own symbol.
- A word that names two units has to be settled somehow. `rank` does it: `c` is Celsius and not the speed of light, `mb` is megabytes and not megabits. Those pairs are pinned in `search.test.js`, because a change to the scoring that flips one of them is a bug a reader will meet on their first try.
- Nothing on the page announces that a category picker is unnecessary. The examples in the empty state have to do that job, which is why they are eight different shapes rather than eight lengths.
