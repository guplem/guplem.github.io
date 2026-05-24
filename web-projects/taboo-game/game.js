// Pure deterministic game logic for Taboo. No DOM access -- safe to import from tests.
//
// The whole game state is derived from (seed, team sizes, turn). No server, no sync.
// As long as every client uses the same seed + dataset + algorithm, they all see the
// same active team, active player, and card for any given turn.

const FNV_OFFSET = 2166261;
const FNV_PRIME = 16777619;

export function hashStringToSeed(str) {
  // FNV-1a 32-bit hash. Stable across browsers, no crypto required.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), FNV_PRIME);
  }
  return h >>> 0;
}

export function mulberry32(seedInt) {
  let state = seedInt >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(seed, ...parts) {
  const composite = [String(seed), ...parts.map(String)].join("|");
  return mulberry32(hashStringToSeed(composite));
}

export const TEAMS = Object.freeze(["A", "B"]);

export function activeTeam(turn) {
  if (!Number.isInteger(turn) || turn < 1) {
    throw new Error("turn must be a positive integer");
  }
  return turn % 2 === 1 ? "A" : "B";
}

export function judgeTeam(turn) {
  return activeTeam(turn) === "A" ? "B" : "A";
}

export function activePlayerIndex({ seed, turn, teamSize }) {
  if (!Number.isInteger(turn) || turn < 1) {
    throw new Error("turn must be a positive integer");
  }
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    throw new Error("teamSize must be a positive integer");
  }
  // Rotate within the team: each player describes exactly once before any repeats.
  // The active team's turns are interleaved (A plays 1,3,5,..., B plays 2,4,6,...),
  // so we compute the team-local index first, then permute [1..teamSize] per round.
  const team = activeTeam(turn);
  const localIndex = team === "A" ? (turn - 1) / 2 : (turn - 2) / 2;
  const round = Math.floor(localIndex / teamSize);
  const positionInRound = localIndex % teamSize;
  const order = shuffledPlayerOrder(seed, team, round, teamSize);
  return order[positionInRound];
}

function shuffledPlayerOrder(seed, team, round, teamSize) {
  const rng = rngFor(seed, "player", team, round);
  const order = new Array(teamSize);
  for (let i = 0; i < teamSize; i++) order[i] = i + 1; // 1-based
  for (let i = teamSize - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

// Round size = full pass through the deck. Each round uses a fresh shuffle derived
// from the seed + round number, so when the deck cycles the order changes -- but
// every client still computes the same order.
function shuffledIndicesForRound(seed, round, deckSize) {
  const rng = rngFor(seed, "deck", round);
  const indices = new Array(deckSize);
  for (let i = 0; i < deckSize; i++) indices[i] = i;
  // Fisher-Yates.
  for (let i = deckSize - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices;
}

export function cardIndexForTurn({ seed, turn, deckSize }) {
  if (!Number.isInteger(turn) || turn < 1) {
    throw new Error("turn must be a positive integer");
  }
  if (!Number.isInteger(deckSize) || deckSize < 1) {
    throw new Error("deckSize must be a positive integer");
  }
  const zeroBased = turn - 1;
  const round = Math.floor(zeroBased / deckSize);
  const positionInRound = zeroBased % deckSize;
  const order = shuffledIndicesForRound(seed, round, deckSize);
  return order[positionInRound];
}

export function pickCard({ seed, turn, deck }) {
  if (!Array.isArray(deck) || deck.length === 0) {
    throw new Error("deck must be a non-empty array");
  }
  const idx = cardIndexForTurn({ seed, turn, deckSize: deck.length });
  return { card: deck[idx], index: idx };
}

export const ROLES = Object.freeze({
  ACTIVE_PLAYER: "active_player",
  GUESSING_TEAMMATE: "guessing_teammate",
  JUDGE: "judge",
});

export function roleForPlayer({ seed, turn, teamSizes, myTeam, myPlayerIndex }) {
  if (!teamSizes || !Number.isInteger(teamSizes.A) || !Number.isInteger(teamSizes.B)) {
    throw new Error("teamSizes must be { A: int, B: int }");
  }
  if (myTeam !== "A" && myTeam !== "B") {
    throw new Error("myTeam must be 'A' or 'B'");
  }
  const teamSize = teamSizes[myTeam];
  if (!Number.isInteger(myPlayerIndex) || myPlayerIndex < 1 || myPlayerIndex > teamSize) {
    throw new Error("myPlayerIndex out of range for team");
  }
  const guessing = activeTeam(turn);
  if (myTeam !== guessing) return ROLES.JUDGE;
  const activeIdx = activePlayerIndex({ seed, turn, teamSize });
  return myPlayerIndex === activeIdx ? ROLES.ACTIVE_PLAYER : ROLES.GUESSING_TEAMMATE;
}

// Visibility derived from role.
// - active_player:    sees word + forbidden
// - guessing_teammate: sees nothing (they have to guess)
// - judge:            sees word + forbidden (to enforce both the forbidden words and validate guesses)
export function visibilityForRole(role) {
  switch (role) {
    case ROLES.ACTIVE_PLAYER:
      return { word: true, forbidden: true };
    case ROLES.JUDGE:
      return { word: true, forbidden: true };
    case ROLES.GUESSING_TEAMMATE:
      return { word: false, forbidden: false };
    default:
      throw new Error("unknown role");
  }
}

export function deriveTurnState({ seed, turn, teamSizes, myTeam, myPlayerIndex, deck }) {
  const guessing = activeTeam(turn);
  const judge = judgeTeam(turn);
  const activeIdx = activePlayerIndex({ seed, turn, teamSize: teamSizes[guessing] });
  const role = roleForPlayer({ seed, turn, teamSizes, myTeam, myPlayerIndex });
  const { card, index: cardIndex } = pickCard({ seed, turn, deck });
  return {
    turn,
    guessingTeam: guessing,
    judgeTeam: judge,
    activePlayerIndex: activeIdx,
    role,
    visibility: visibilityForRole(role),
    card,
    cardIndex,
  };
}

// ---- URL state ----
// Carries the shareable inputs only. Personal inputs (myTeam, myPlayerIndex) stay
// in localStorage on each device.

export function parseUrlState(searchString) {
  const params = new URLSearchParams(searchString || "");
  const seed = params.get("s") || "";
  const a = parseInt(params.get("a") || "", 10);
  const b = parseInt(params.get("b") || "", 10);
  const t = parseInt(params.get("t") || "", 10);
  const v = params.get("v") || "";
  return {
    seed,
    teamA: Number.isInteger(a) && a > 0 ? a : null,
    teamB: Number.isInteger(b) && b > 0 ? b : null,
    turn: Number.isInteger(t) && t > 0 ? t : null,
    version: v || null,
  };
}

export function serializeUrlState({ seed, teamA, teamB, turn, version } = {}) {
  const params = new URLSearchParams();
  if (seed) params.set("s", String(seed));
  if (Number.isInteger(teamA) && teamA > 0) params.set("a", String(teamA));
  if (Number.isInteger(teamB) && teamB > 0) params.set("b", String(teamB));
  if (Number.isInteger(turn) && turn > 0) params.set("t", String(turn));
  if (version) params.set("v", String(version));
  return params.toString();
}

export function generateRandomSeed(random = Math.random) {
  return random().toString(36).slice(2, 8).padEnd(6, "0");
}
