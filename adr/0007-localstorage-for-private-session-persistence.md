# ADR 0007: localStorage for Private-Session Persistence in Web-Projects

## Context

Some `web-projects/` accumulate per-user state that is meaningful only on the
device that produced it and has **no value to anyone else**. The first is
`rps-mind-reader`: a rock-paper-scissors game whose AI learns from the player's
own move history. The state (match history, win/loss/tie totals, and the data the
predictor learns from) is personal and per-device by nature. Sharing it with
another person would be meaningless, and we explicitly want it to **survive across
visits** so the opponent keeps getting stronger.

This sits next to [ADR 0006](0006-url-as-state-for-web-projects.md), which makes
**URL query params** the source of truth for *shareable* web-projects. ADR 0006 is
scoped to projects "whose value depends on shareability or reproducibility" and
notes that for a project that "does not need shareability, in-memory state is
fine." It does not cover the case of state that must *persist privately* across
sessions.

Storage options considered for this class of project:

- **In-memory only.** Lost on refresh; the AI would forget the player every visit, defeating the core "it learns you over time" premise.
- **URL query params (ADR 0006).** Wrong tool: the state is large and growing (full history + learned model), not shareable, and would produce an ugly, ever-changing URL, and URLs are length-bounded (~2KB safe).
- **Cookies.** Persist, but are sent on every HTTP request (pointless on a static site with no server), capped near 4KB, and have a clunkier API.
- **`localStorage`.** Persists per-browser across sessions, ~5MB of room, never sent over the network, simple synchronous string API.

## Decision

For web-projects with **private, per-device state that must persist across
sessions but is never shared**, `localStorage` is the source of truth.

Conventions (as implemented in `rps-mind-reader`):

- A single namespaced, versioned key: `"<project>:<purpose>:v1"` (e.g. `"rps-mind-reader:state:v1"`).
- All reads and writes are wrapped in `try/catch` so private-mode / quota / disabled-storage failures degrade gracefully to an in-memory session rather than crashing.
- The **pure logic module owns (de)serialization and normalization** (`serialize`, `deserialize`, `normalizeState` in `game.js`), and these are covered by tests. The DOM layer (`app.js`) only does the actual `localStorage.getItem`/`setItem`. This keeps the storage contract verifiable without a browser, mirroring how ADR 0006 keeps URL parsing in the pure module.
- `deserialize` is **defensive**: any malformed or out-of-range stored value is coerced or dropped, so old or corrupt data can never break the app.
- A **user-facing reset** (button) clears the key, and the stored format is minimal: `rps-mind-reader` persists only the round list and cumulative totals, then *replays* them to rebuild the AI model (see rps-mind-reader ADR 0001), rather than serializing the model object itself.

**Rejected alternative:** in-memory only (the AI would forget the player every visit, defeating the "it learns you over time" premise), URL query params per ADR 0006 (the state is large, growing, and not shareable), or cookies (sent on every request, capped near 4KB, clunkier API). `localStorage` fits: it persists per-browser, has room to grow, and is never sent over the network.

## Consequences

**Positive:**

- State survives refreshes and revisits with no backend, consistent with ADR 0002 (no build system) and static GitHub Pages hosting.
- No network exposure (unlike cookies) and far more headroom than cookies or URL state.
- The persistence contract is unit-testable because (de)serialization lives in the pure module.
- Defensive deserialization plus a versioned key make future format changes and corrupt data safe to handle.

**Negative:**

- State is per-browser and not shareable or portable across devices. Acceptable, and in fact desired, for this class of project.
- `localStorage` can be disabled or cleared by the user/browser; the `try/catch` fallback means the game still plays but silently forgets, an accepted trade-off.
- Stale state can surface old data to a returning visitor; mitigated by the explicit reset control.

## Scope

This decision applies to web-projects with **private, persistent, non-shared**
state (`rps-mind-reader` is the first). It is complementary to, not a replacement
for, ADR 0006: projects whose value is **shareability/reproducibility** still use
URL state; projects that need **private cross-session memory** use `localStorage`;
projects that need neither can stay in-memory. A project that needs both (a
shareable setup *and* private device-local preferences) may combine them, as
`taboo-game` already does (URL for shared inputs, `localStorage` for personal
info).
