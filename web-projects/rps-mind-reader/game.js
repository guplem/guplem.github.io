// Pure rock-paper-scissors rules, scoring, stats, and persistable game state.
// No DOM access -- safe to import from tests.

export const MOVES = ["rock", "paper", "scissors"];

// Capped window of rounds kept for display + model replay. Cumulative totals
// are tracked separately so the all-time counters survive past the cap.
export const MAX_ROUNDS = 500;

// Rotate a move forward around the rock -> paper -> scissors -> rock wheel.
// shift(move, 1) is exactly the move that BEATS `move` (paper beats rock, ...).
export function shift(move, k = 1) {
  const i = MOVES.indexOf(move);
  if (i < 0) return null;
  const n = MOVES.length;
  return MOVES[(((i + k) % n) + n) % n];
}

// The move that beats `move`.
export function counter(move) {
  return shift(move, 1);
}

// True if move `a` beats move `b`.
export function beats(a, b) {
  if (!MOVES.includes(a) || !MOVES.includes(b)) return false;
  return shift(b, 1) === a; // a beats b iff a is the counter of b
}

// Outcome from the PLAYER's perspective.
export function judge(playerMove, aiMove) {
  if (playerMove === aiMove) return "tie";
  return beats(playerMove, aiMove) ? "win" : "loss";
}

// Numeric value of an AI move vs a player move, from the AI's perspective:
// +1 AI wins, 0 tie, -1 AI loses. Used to score predictor experts.
export function gameValue(aiMove, playerMove) {
  if (aiMove === playerMove) return 0;
  return beats(aiMove, playerMove) ? 1 : -1;
}

// ---- Game state ----------------------------------------------------------

export function emptyState() {
  return {
    version: 1,
    totals: { win: 0, loss: 0, tie: 0 }, // cumulative, all-time
    bestStreak: 0, // best run of consecutive player wins
    rounds: [], // capped window: { p: player, a: ai, o: outcome, g: predicted|null }
  };
}

// Consecutive player wins at the tail of the rounds list.
export function currentStreak(state) {
  const r = state.rounds;
  let s = 0;
  for (let i = r.length - 1; i >= 0; i--) {
    if (r[i].o === "win") s++;
    else break;
  }
  return s;
}

// Apply a revealed round. Returns a NEW state (does not mutate the input).
export function applyRound(state, playerMove, aiMove, predicted = null) {
  const outcome = judge(playerMove, aiMove);
  const round = {
    p: playerMove,
    a: aiMove,
    o: outcome,
    g: MOVES.includes(predicted) ? predicted : null,
  };
  const rounds = state.rounds.concat([round]);
  while (rounds.length > MAX_ROUNDS) rounds.shift();
  const totals = {
    win: state.totals.win + (outcome === "win" ? 1 : 0),
    loss: state.totals.loss + (outcome === "loss" ? 1 : 0),
    tie: state.totals.tie + (outcome === "tie" ? 1 : 0),
  };
  const next = { ...state, totals, rounds };
  next.bestStreak = Math.max(state.bestStreak || 0, currentStreak(next));
  return next;
}

export function totalsCount(totals) {
  return totals.win + totals.loss + totals.tie;
}

// Fractions over the total. Returns zeros (never NaN) when no rounds played.
export function percentages(totals) {
  const total = totalsCount(totals);
  if (total === 0) return { win: 0, loss: 0, tie: 0, total: 0 };
  return {
    win: totals.win / total,
    loss: totals.loss / total,
    tie: totals.tie / total,
    total,
  };
}

// ---- Persistence ---------------------------------------------------------

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(raw) {
  if (typeof raw !== "string" || raw.length === 0) return emptyState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

// Defensively coerce an arbitrary parsed object into a valid state, dropping
// anything malformed. Keeps stored data from ever crashing the app.
export function normalizeState(obj) {
  if (!obj || typeof obj !== "object") return emptyState();
  const totals = obj.totals && typeof obj.totals === "object" ? obj.totals : {};
  const rounds = Array.isArray(obj.rounds)
    ? obj.rounds
        .filter(isValidRound)
        .map((r) => ({ p: r.p, a: r.a, o: r.o, g: MOVES.includes(r.g) ? r.g : null }))
        .slice(-MAX_ROUNDS)
    : [];
  return {
    version: 1,
    totals: {
      win: toCount(totals.win),
      loss: toCount(totals.loss),
      tie: toCount(totals.tie),
    },
    bestStreak: toCount(obj.bestStreak),
    rounds,
  };
}

function toCount(n) {
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function isValidRound(r) {
  return (
    r &&
    MOVES.includes(r.p) &&
    MOVES.includes(r.a) &&
    (r.o === "win" || r.o === "loss" || r.o === "tie")
  );
}
