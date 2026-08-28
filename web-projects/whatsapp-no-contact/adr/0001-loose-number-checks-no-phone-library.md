# ADR 0001: Loose Number Checks, and No Phone-Number Library

## Context

The tool accepts a phone number from any of 227 countries and hands WhatsApp
plain digits. It must therefore decide how much it checks that number.

Every country has its own numbering plan: how many digits a number holds, which
prefixes exist, and whether a number written at home carries a trunk zero that
the international form drops. A UK mobile is `07911 123456` at home and
`44 7911 123456` abroad. Italy is the opposite: the leading zero is part of the
number and removing it breaks the call. These plans also change as operators get
new ranges.

The options:

- **[libphonenumber](https://github.com/google/libphonenumber), Google's phone-number library.** Exact per-country validation, formatting as the visitor types, and per-country example numbers. It is also hundreds of kilobytes. Root ADR 0002 rules out a build system, so it would load from a CDN at runtime, and root ADR 0005 keeps CDN use to a minimum. A CDN failure would then break the one thing the page does.
- **Per-country rules kept in this repo.** Exact today, wrong within months. A rule that drifts blocks a number that works, and the visitor cannot tell why.
- **Loose checks against the international standard only.** Accept anything that could be a real number, and let WhatsApp reject what is not.

## Decision

The page checks a number **loosely, against E.164 only** (E.164 is the ITU
standard for international phone numbers), and ships **no phone-number library**.

- A number is accepted when it holds 7 to 15 digits in total, including the dial code, and at least 4 digits after the dial code. 15 is the E.164 maximum; 7 is the shortest real number, in Saint Helena.
- There are **no per-country length or prefix rules**.
- The trunk zero is removed from the national part, because the international form drops it. `DIALS_KEEPING_LEADING_ZERO` in `phone.js` holds the exceptions. Italy (`39`) is its only member. The page says on screen when it removed a zero, so the number it shows is never a silent change.
- The number is shown as `+<dial code> <national part>` and is **not regrouped**. Grouping rules differ per country, and a wrong guess reads to the visitor as an error.
- **WhatsApp is the final authority.** It reports a number that does not exist, which is a job this page does not need to repeat.

**Rejected alternative:** libphonenumber from a CDN. It is easy to reach for,
because it answers every question this ADR leaves open, but it is large for a
page with one field, it conflicts with root ADR 0002 and 0005, and a CDN failure
would break the core function. Hand-maintained per-country rules are the other
easy mistake: they look exact, then drift, and a drifted rule blocks a valid
number.

## Consequences

**Positive:**

- No dependency, so the page keeps working after it has loaded once, consistent with root ADR 0002.
- Our own rules never reject a number that WhatsApp would accept. For a tool whose whole job is to reach a number, a false rejection is the worst failure.
- The rules are small enough to be covered by tests in full, including the trunk-zero exception and the length bounds.
- A new country costs one line in `countries.js`, with no rules to research.

**Negative:**

- A typo that keeps the length valid passes our checks. WhatsApp reports it, one step later than a strict check would.
- No per-country placeholder number and no formatting as the visitor types. The preview line, which shows exactly what will be dialled, covers the same need more cheaply.
- The trunk-zero exception set is manual. It needs a new entry if another country keeps its leading zero. Only Italy does today.
