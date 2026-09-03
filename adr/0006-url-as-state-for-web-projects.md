# ADR 0006: URL Query Params as Source of Truth for Web-Project State

## Context

Some `web-projects/` are small tools whose primary value depends on **sharing the exact same view with someone else** -- e.g. `random-option-picker` (a draw is only useful if a teammate can verify the same result), `whatsapp-no-contact` (a link that opens a chat with one number is the point of the page), and similar future tools where a teammate, classmate, or future-self needs to reproduce a setup.

Storage options for the in-app state:

- **In-memory only.** Simplest, but state is lost on refresh and cannot be shared.
- **`localStorage`.** Survives refresh, but is per-browser and cannot be shared. Stale state can also confuse first-time visitors.
- **URL query params with `history.replaceState`.** State lives in the URL, updates as the user edits, and any link is fully shareable.

## Decision

For web-projects whose value depends on shareability or reproducibility, **URL query params are the source of truth for state**. The user-visible URL is updated live with `history.replaceState` as the user edits, so any time the user copies the URL bar (or clicks a "Copy share link" button), the receiver loads the exact same state.

Conventions:

- Short, lowercase param names (`o` for option, `n` for count, `s` for seed, `p` for phone number). One occurrence per item for list values (`?o=A&o=B`) -- not CSV -- so options containing commas, equals signs, or other separators round-trip correctly through `URLSearchParams`.
- Defaults are not serialized (e.g. `n` is omitted when count is 1) to keep links short.
- Parsing and serializing live in the project's pure logic module (`picker.js`) and are covered by tests, so the URL contract is verifiable without a browser.
- `history.replaceState` (not `pushState`) is used so editing options does not pollute the back-button history.

**Rejected alternative:** in-memory state (lost on refresh, cannot be shared) or `localStorage` (per-browser, not shareable, and stale state can confuse first-time visitors). Both fail the shareability requirement that motivates this class of project. For private, per-device state that must persist instead of being shared, see [ADR 0007](0007-localstorage-for-private-session-persistence.md).

## Consequences

**Positive:**

- Any link is shareable and reproducible without server-side persistence.
- No per-browser state divergence and no stale `localStorage` to clear.
- The contract is testable: round-trip tests guarantee `parseUrlState(serializeUrlState(x)) === x` for valid `x`.
- Works with any static host -- consistent with ADR 0002 (no build system) and the GitHub Pages deployment.

**Negative:**

- Total state size is bounded by browser URL length limits (~2KB safe, ~8KB upper). Lists with thousands of items are not supported.
- All state is visible and editable by the user. Sensitive values must never be put in URL state. Personal data is only acceptable when sharing it **is** the feature the visitor asked for, as with the phone number in `whatsapp-no-contact`, and the page must say that the link carries it.
- The user-facing URL changes as they type, which can feel noisy; this is mitigated by using `replaceState` and only serializing meaningful values.
- Round-trip fidelity depends on consistent encoding -- options containing percent or plus characters must rely on `URLSearchParams` rather than ad-hoc string concatenation.

## Scope

This decision applies to small, shareable web-projects (`random-option-picker` is the first). It is **not** a global rule for the main portfolio site. The main site does hold user-editable state (the work filter chips and the work search box, see [ADR 0014](0014-three-state-work-filters.md)), but that state is a reading aid rather than a result worth sharing, so it stays in memory and a reload clears it. New web-projects with similar shareability requirements should follow the same convention; if a project does not need shareability, in-memory state is fine. For private, per-device state that must persist across sessions instead of being shared, see [ADR 0007](0007-localstorage-for-private-session-persistence.md).
