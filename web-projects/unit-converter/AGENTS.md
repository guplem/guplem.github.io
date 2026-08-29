# web-projects/unit-converter/AGENTS.md

> **SCOPE:** files under `web-projects/unit-converter/`. Read `web-projects/AGENTS.md` first for the rules that cover every web-project.

## What this is

A unit converter with one input box and no dropdowns. A person types an amount and a unit, and the page converts it into every other unit of the same kind at once. The unit they type is what decides the category, so there is no category picker anywhere in the interface. See ADR 0001 for why, and what that costs.

## Module map

| File | Pure? | Responsibility |
|---|---|---|
| `units.js` | Yes (data) | Every unit and category. Names in both languages, aliases, factors, `rank`, and the bundled exchange-rate snapshot |
| `convert.js` | Yes | One conversion, the whole-category conversion, and `readabilityPenalty`, which decides the order of the answers (ADR 0002) |
| `parse.js` | Yes | One typed line into an amount, a unit and a target |
| `search.js` | Yes | The unit a person means from the few letters they typed |
| `format.js` | Yes | Writing the numbers: significant digits, money, and the second reading under a value |
| `rates.js` | Yes | Reading a rate table out of what a service sends (ADR 0003) |
| `store.js` | Yes | Recent conversions, cached rates and the chosen language, through an injected storage |
| `urlState.js` | Yes | Reading and writing the address bar (root ADR 0006) |
| `i18n.js` | Yes | Every word the page says |
| `deployStamp.js` | Yes | The "deployed at" line (root ADR 0013) |
| `dataSource.js` | No | The **only** file that calls `fetch` |
| `app.js` | No | The page: listens to the input box, calls the modules above, builds elements |

Data flow: `app.js` → `parse.parseQuery` → `search.bestUnit` → `convert.convertAll` → `format.formatValue` → elements.

## Non-obvious conventions and gotchas

- **`app.js` never writes `innerHTML`.** Every string reaches the screen through `textContent`, so there is nothing to escape. The one exception is the deploy line, which needs a link inside a sentence and carries its own escaper. Keep it that way: a new `innerHTML` here is a new escaping bug.
- **A unit's `sym` shows on screen.** Never invent a suffix like `pt-us` to dodge a name clash inside a category; `units.test.js` fails on a symbol containing a hyphen. Two units whose symbols differ only by case (`MB`/`Mb`, `mW`/`MW`) carry an `exact` array that `search.js` matches case-for-case.
- **An alias must be unique inside its category**, and the same alias in two categories is fine. `search.js` settles those with `rank`, so `c` is Celsius and not the speed of light. Adding a one-letter alias hijacks every search that starts with it, so do not.
- **`rank` is not decoration.** It is 1 for an everyday unit and 4 for an exotic one, and it decides both the order of the answers and which unit wins a tied search. A wrong `rank` shows as a wrong answer at the top.
- **Only `readOnePart` in `parse.js` may treat an apostrophe as a digit separator**, and only when exactly three digits follow it. Without that lookahead `5'10"` reads as five hundred and ten. The `NUMBER_HEAD` comment says so; do not simplify the pattern.
- **`in` is a unit and a separator.** `parse.js` splits on a separator only when what sits to its left is already a complete amount, which is what makes `100 cm in in` and `100 in to cm` both work. `isCompleteAmount` has to read compound amounts too, or `5'10" in cm` looks unfinished at the `'`.
- **A currency's factor is a fallback, not the truth.** `units.js` carries a dated snapshot so the page answers with no network at all. `rates.js` replaces it when live rates arrive, and the note under the answers always says which of the two is in use. Never present a snapshot rate as today's.
- **Rates come in as "units per euro" and the engine wants "worth in euros".** `rates.js` inverts them. Getting that backwards produces prices that look plausible and are wrong, so `rates.test.js` pins it in both directions.
- **`format.js` changes its rule with the size of the number** (whole numbers stay whole, big numbers drop their decimals, money goes to the cent). Read the comment at the top before touching it: each rule is there because the obvious single rule broke a real case.
- **The second reading (`formatCompound`) stays quiet by default.** It appears only when it says something the first line did not. A `6′ 0″` under `6 ft` is clutter.

## Tests

Every module above marked "Pure" has a sibling `*.test.js`, and new behaviour goes in test-first (root ADR 0012). `app.js` and `dataSource.js` have none by design; anything in them worth a test belongs in a pure module instead.

```bash
cd web-projects/unit-converter && bun test
```

## Architecture Decision Records

| ADR | Topic |
|---|---|
| [0001](adr/0001-one-input-box-instead-of-pickers.md) | One input box carries the whole interface; no category picker, no dropdowns |
| [0002](adr/0002-answer-every-unit-ordered-by-usefulness.md) | Answer every compatible unit at once, ordered by commonness plus readability |
| [0003](adr/0003-live-rates-over-a-bundled-snapshot.md) | Live exchange rates over a bundled snapshot, and always say which is in use |
