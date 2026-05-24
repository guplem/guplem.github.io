# ADR 0007: Deterministic Multiplayer Without a Server (Taboo Game)

## Context

The `taboo-game/` web-project is a multiplayer party game intended to be played in person on several phones at the same time. All players must see a consistent view of the game (which team is guessing, which player is the active describer, which card is on the table) without any of the usual tools for keeping clients in sync:

- No backend (the portfolio is hosted on static GitHub Pages — see ADR 0002).
- No persistent shared state, no rooms, no codes.
- No WebSockets, push, or polling.
- No host device whose state others must trust.

We considered:

1. **Add a tiny realtime backend** (Firebase, Supabase, PartyKit). Solves coherence but breaks ADR 0002 (no build/no server) and adds an external dependency, free-tier risk, and a moving point of failure during a party.
2. **Host-based BroadcastChannel / WebRTC**. Removes the server but introduces a host election problem and tricky failure modes (host disconnects mid-game) that are heavy for a party game.
3. **Deterministic local computation from shared inputs.** Each client independently derives the entire game state from a small set of values that the group agrees on verbally / via a shared link: a `seed`, the team sizes, and the current `turn` number.

## Decision

For `taboo-game/`, **the game has no shared state and no networking**. Each device computes the same state independently from these inputs:

- `seed` (free-form string, shared verbally or via a copy-link button)
- `teamA_size` and `teamB_size` (integers, shared)
- `turn` (integer, advanced manually at the same time by every player)
- `myTeam` and `myPlayerIndex` (personal — different on each device)

The pure logic lives in `game.js` and provides:

- `activeTeam(turn)` — strictly alternating; turn 1 → A, turn 2 → B, etc.
- `activePlayerIndex({seed, turn, teamSize})` — `mulberry32` PRNG seeded with a composite of `seed | turn | "player"`, then `floor(rng * teamSize) + 1`.
- `cardIndexForTurn({seed, turn, deckSize})` — Fisher-Yates shuffle of the deck for the current "round" (a full pass through the deck) seeded with `seed | round | "deck"`. When the deck cycles, a new round seed produces a fresh permutation while staying deterministic.
- `deriveTurnState({...})` — composes the above and returns the rendered state including a role (`active_player` / `guessing_teammate` / `judge`) and a visibility object derived from it.

`seed`, `teamA`, `teamB`, and `turn` are mirrored in the URL (`?s=...&a=...&b=...&t=...`) so a single link can pre-populate the shared inputs in every device — but the URL is convenience, not source of truth: each player can also type the values manually if they joined late, and the same game is reconstructable from those inputs alone.

The cards dataset (`cards.json`) is treated as part of the inputs: its `version` field is embedded in the URL (`v=...`) so divergent datasets surface as a warning instead of silent disagreement.

## Consequences

**Positive:**

- No backend, no auth, no rooms, no host election. The game can never desync because of a network blip.
- Works fully offline once the page is loaded.
- Late joiners are first-class: typing `turn=50` reconstructs turn 50 exactly. There is no "must-be-present-from-the-start" requirement.
- Pure logic is testable without a browser (45 tests under `bun test`).
- Aligns with ADRs 0001 (data-driven JSON) and 0002 (no build system).

**Negative:**

- Coordination is human. The group has to agree on the seed verbally and advance turns at the same time. There is no automated nudge if one device falls behind.
- Datasets are versioned manually. Editing `cards.json` while a game is in progress will silently change cards on a refresh unless the `version` is bumped. The URL-embedded version mitigates this with a warning.
- No persistent scoring or history. Scorekeeping happens on paper or on people's heads (and that is intentional — this is a party game).
- Determinism limits some quality-of-life features (e.g. "draw a different card" requires re-deriving from a new seed or turn, not an in-place reshuffle).

## Algorithms in detail

**PRNG.** `mulberry32` initialized with a 32-bit FNV-1a hash of `seed | namespace | turn | round`. Stable across browsers; no crypto needed.

**Player selection.** A single `Math.floor(rng() * teamSize)` draw. With `teamSize ≤ 20` and a 32-bit RNG the modulo bias is undetectable in practice; the property is verified with a rough uniformity test in `game.test.js`.

**Card selection (deterministic Fisher-Yates per round).** For round `R = floor((turn - 1) / deckSize)` we shuffle `[0..deckSize-1]` with a fresh RNG seeded by `seed | "deck" | R`, then return entry `(turn - 1) % deckSize`. This guarantees every card appears exactly once before any repeats, and the repeat order itself is determined (not random) but different from round 1 — so a long party does not show identical cycles. Verified by tests.

## Scope

This decision is specific to `taboo-game/`. The pattern — "trade realtime sync for deterministic derivation from a shared input" — is reusable for other group games where the entire state is reconstructable from a small parameter set; future projects with the same shape should follow this ADR rather than introducing a backend.
