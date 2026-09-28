// A computer player: greedy, the way people play at a table.
//
// No DOM, no network, no timers: a state goes in, a decision comes out.
// The host runs it for every bot seat, through the same rules module as
// everybody else, so a bot can do nothing a person could not.
//
// It scores the board after each legal move and takes the best: knock
// somebody out (more for a piece that had come far), reach the star, get
// into the house, come out on a six, gain ground, and do not stop just in
// front of an opponent. The side kick that may follow a move counts
// towards that move.

import { GOAL_STEP, RING_LENGTH, START_FIELD, ENTRY_FIELD, chooseSide, playMove } from "./rules.js";

const fieldOf = (p) => (START_FIELD[p.seat] + p.step) % RING_LENGTH;

/** How far a piece is along its own way: -1 in the yard, up to 44 on the star. */
function progress(p) {
  if (p.at === "yard" || p.at === "gone") return -1;
  if (p.at === "ring") return p.step;
  if (p.at === "star") return GOAL_STEP;
  if (p.house === p.seat) return RING_LENGTH + p.step;
  // A raider in an opponent's house counts as where it will come out.
  return (ENTRY_FIELD[p.house] - START_FIELD[p.seat] + RING_LENGTH) % RING_LENGTH;
}

/**
 * How exposed a piece on the ring is: one for each opponent up to six
 * fields behind it, half for each one up to six ahead when the back kick
 * is on (that needs the exact number). A piece safe on its own start is
 * in no danger.
 */
function danger(state, piece) {
  if (piece.at !== "ring") return 0;
  if (state.options.safe && piece.step === 0) return 0;
  const here = fieldOf(piece);
  let risk = 0;
  state.pieces.forEach((q) => {
    if (q.seat === piece.seat || q.at !== "ring") return;
    const behind = (here - fieldOf(q) + RING_LENGTH) % RING_LENGTH;
    if (behind >= 1 && behind <= 6 && q.step + behind < RING_LENGTH) risk += 1;
    else if (state.options.back) {
      const ahead = (fieldOf(q) - here + RING_LENGTH) % RING_LENGTH;
      if (ahead >= 1 && ahead <= 6) risk += 0.5;
    }
  });
  return risk;
}

const kickValue = (state, ids) => ids.reduce((sum, id) => sum + 35 + Math.max(0, progress(state.pieces[id])), 0);

function score(before, after, move, seat) {
  const was = before.pieces[move.piece];
  const now = after.pieces[move.piece];
  let s = kickValue(before, move.kicks);
  if (now.at === "star") s += 80;
  else if (now.at === "house" && now.house === seat && was.at !== "house") s += 40;
  if (was.at === "yard") s += 35;
  if (was.at === "house" && was.house !== seat) s += 15; // leave a raided house soon
  s += (progress(now) - progress(was)) * 0.5;
  after.pieces.forEach((p) => {
    if (p.seat !== seat) return;
    const extra = danger(after, p) - danger(before, before.pieces[p.id]);
    s -= extra * (10 + Math.max(0, progress(p)) * 0.5);
  });
  return s;
}

/**
 * The bot's decision for the state it is given.
 *
 * @param {object} state - A game state with a bot on turn.
 * @param {() => number} [random] - Breaks near-ties, so two bots do not play
 *   like twins. Pass a fixed function in tests.
 * @returns {number | null} A move id while a move is due, a side-kick id
 *   (or null to leave it) while a side kick is on offer, null otherwise.
 */
export function chooseAction(state, random = Math.random) {
  if (state.phase !== "play") return null;
  const seat = state.players[state.turn].seat;

  if (state.awaiting === "side") {
    if (!state.sides.length) return null;
    const scored = state.sides
      .map((side) => ({ id: side.id, s: score(state, chooseSide(state, side.id), side, seat) }))
      .sort((a, b) => b.s - a.s);
    const mustTake = state.last?.kind === "backstep";
    return scored[0].s < -25 && !mustTake ? null : scored[0].id;
  }

  if (state.awaiting !== "move" || !state.moves.length) return null;
  let best = null;
  state.moves.forEach((move) => {
    const after = playMove(state, move.id);
    const followUp = after.awaiting === "side" ? Math.max(...after.sides.map((sd) => kickValue(after, sd.kicks))) : 0;
    const s = score(state, after, move, seat) + followUp + random() * 2;
    if (!best || s > best.s) best = { id: move.id, s };
  });
  return best.id;
}
