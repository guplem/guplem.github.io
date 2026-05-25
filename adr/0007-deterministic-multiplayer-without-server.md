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
- `wordIndex` (integer, the current word within the turn; advanced manually by each device as the active player calls out the next card)
- `timerDuration` (integer seconds; shared)
- `myTeam` and `myPlayerIndex` (personal — different on each device)

Each turn now allows the active player to describe multiple cards within a fixed time window (default 30 s). Only the active player has a running timer; judges and teammates rely on the active player calling "tiempo!" verbally. The timer is intentionally NOT part of the deterministic state — it is a local UI affordance for the active player. Similarly, the **local hit counter** that judges and guessing teammates use to tally correct guesses is intentionally device-local and resets on turn change — it never leaves the device. All cards are still derivable purely from `(seed, turn, wordIndex)`.

The pure logic lives in `game.js` and provides:

- `activeTeam(turn)` — strictly alternating; turn 1 → A, turn 2 → B, etc.
- `activePlayerIndex({seed, turn, teamSize})` — rotates within the team: each player describes exactly once per "team round" (a full pass through the team) before any repeats. Uses a Fisher-Yates shuffle of `[1..teamSize]` seeded with `seed | "player" | team | round`, then indexes by the team-local position in the round. Independent permutations per team A and team B.
- `cardForTurnAndWord({seed, turn, wordIndex, deck})` — single global Fisher-Yates shuffle of the deck seeded with `seed | "deck-global"`. Each turn is given a slab of `WORDS_PER_TURN_BUDGET = 50` consecutive positions, so the linear index `(turn - 1) * BUDGET + (wordIndex - 1) mod deckSize` is guaranteed to be unique across the first `floor(deckSize / BUDGET)` turns. With a 1024-card deck that is 20 repeat-free turns, enough for a typical party game; beyond that the modulo wraps and cards may recycle.
- `deriveTurnState({...})` — composes the above and returns the rendered state including a role (`active_player` / `guessing_teammate` / `judge`), a visibility object derived from it, and the current card for `(turn, wordIndex)`.

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

**Player selection (deterministic rotation).** Team A plays odd turns (1, 3, 5, ...) and team B plays even turns (2, 4, 6, ...), so each team has its own local turn index. For the active team we compute `round = floor(localIndex / teamSize)` and `position = localIndex % teamSize`, then Fisher-Yates shuffle `[1..teamSize]` with an RNG seeded by `seed | "player" | team | round` and return `order[position]`. This guarantees every player describes exactly once before any repeats within the team, which matches the expectation of a tabletop game (each player gets a turn). The per-round reshuffle means consecutive rounds don't share the same order. Verified by tests.

**Card selection (single global Fisher-Yates with fixed per-turn slab).** Reverses the earlier per-turn-shuffle decision after players reported cross-turn collisions in real play. Now: one Fisher-Yates permutation of `[0..deckSize-1]` seeded by `seed | "deck-global"` covers the whole game. Each turn `T` is allocated `WORDS_PER_TURN_BUDGET = 50` consecutive positions, so the card for `(T, wordIndex)` lives at offset `(T - 1) * BUDGET + (wordIndex - 1)` (modulo `deckSize`). This guarantees no card repeats across turns for `floor(deckSize / BUDGET)` turns — 20 turns with the current 1024-card deck, enough for a typical party. The trade-off vs. the previous design: a hard cap of 50 words per turn (typical 30s rounds yield ~10), and unused slots inside a fast-finishing turn are skipped (the deck is "wasted" on those slots). Players who want unlimited cross-turn no-repeats with a tighter budget can shrink `BUDGET` (more turns covered) or grow the deck. Verified by tests.

## Scope

This decision is specific to `taboo-game/`. The pattern — "trade realtime sync for deterministic derivation from a shared input" — is reusable for other group games where the entire state is reconstructable from a small parameter set; future projects with the same shape should follow this ADR rather than introducing a backend.
