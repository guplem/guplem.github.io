// Ghana Ludo: the rules, and nothing else.
//
// No DOM, no network, no randomness: the die value comes in from outside,
// a state goes in, a new state comes out, and the input is never changed.
// That is what lets the host run the game and every other page draw it
// with the very same code (see online-sync/session.js).
//
// The board is the classic 11 x 11 cross. A field is addressed one of
// four ways:
//
//   ring    the 40-field track, numbered clockwise from seat 0's start
//   house   the four fields that lead from a seat's entry to the star
//   star    the goal in the middle, shared by everybody
//   yard    the four spaces in a corner where pieces wait to come out
//
// A piece on the ring stores its STEP: how far it has come from its own
// start field (0-39), not the field it stands on. That one choice makes
// the back kick cost what it should: step back past your own start and
// the step wraps to 39, the long way round.
//
// The Ghanaian rules add three kicks to the ordinary one (landing on a
// piece going forwards):
//
//   back kick   move backwards exactly the number rolled onto an opponent
//   side kick   after a move, jump two fields across a house onto an
//               opponent, if the house field between is empty
//   home kick   walk into an opponent's house with the exact number and
//               knock a piece out of it; the raider walks back out later

export const RING_LENGTH = 40;
export const HOUSE_LENGTH = 4;
/** Steps from a piece's start field to the star: a lap, then the house. */
export const GOAL_STEP = RING_LENGTH + HOUSE_LENGTH;
export const STAR = [5, 5];

/** The house rules, all on by default; the host may switch each one off. */
export const DEFAULT_OPTIONS = Object.freeze({
  back: true, // back kick
  side: true, // side kick
  home: true, // home kick
  three: true, // three rolls while nothing of yours is out
  stack: true, // up to four of your own may share your start field
  safe: true, // nobody can be knocked off their own start field
});

/**
 * The track as grid cells [x, y], clockwise from seat 0's start field at
 * the top of the left arm. Built from the runs a finger traces round the
 * cross, so the shape is readable in the numbers.
 */
export const TRACK = (() => {
  const runs = [
    [1, 0, 4], // right, along the left arm
    [0, -1, 4], // up the top arm
    [1, 0, 2], // across its tip
    [0, 1, 4], // down
    [1, 0, 4], // right, along the right arm
    [0, 1, 2], // across its tip
    [-1, 0, 4],
    [0, 1, 4], // down the bottom arm
    [-1, 0, 2], // across its tip
    [0, -1, 4],
    [-1, 0, 4],
    [0, -1, 1], // up the left tip, back to the field before the start
  ];
  const cells = [[0, 4]];
  runs.forEach(([dx, dy, length]) => {
    for (let i = 0; i < length; i++) {
      const [x, y] = cells.at(-1);
      cells.push([x + dx, y + dy]);
    }
  });
  return cells;
})();

export const START_FIELD = [0, 10, 20, 30];
/** The last ring field before a seat turns into its house. */
export const ENTRY_FIELD = START_FIELD.map((s) => (s + RING_LENGTH - 1) % RING_LENGTH);

/** Each house, from beside its entry field inwards to beside the star. */
export const HOUSES = ENTRY_FIELD.map((field) => {
  const [ex, ey] = TRACK[field];
  const dx = Math.sign(STAR[0] - ex);
  const dy = Math.sign(STAR[1] - ey);
  return [1, 2, 3, 4].map((k) => [ex + dx * k, ey + dy * k]);
});

/** Waiting spaces, one corner per seat, in turn order. */
export const YARDS = [
  [1, 1],
  [8, 1],
  [8, 8],
  [1, 8],
].map(([x, y]) => [
  [x, y],
  [x + 1, y],
  [x, y + 1],
  [x + 1, y + 1],
]);

const cellKey = ([x, y]) => `${x},${y}`;
const ringAtCell = new Map(TRACK.map((cell, field) => [cellKey(cell), field]));
const houseAtCell = new Map();
HOUSES.forEach((cells, house) => cells.forEach((cell, depth) => houseAtCell.set(cellKey(cell), { house, depth })));

/**
 * For each ring field, the fields it faces across a house: two cells away
 * in a straight line with a house cell in between. That condition picks
 * exactly the pairs across an arm, and none of the fields round the tips.
 */
export const LATERALS = TRACK.map(([x, y]) =>
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].flatMap(([dx, dy]) => {
    const via = houseAtCell.get(cellKey([x + dx, y + dy]));
    const to = ringAtCell.get(cellKey([x + dx * 2, y + dy * 2]));
    return via && to !== undefined ? [{ to, via }] : [];
  }),
);

/** Two players sit opposite each other; three or four take the seats in order. */
const SEATING = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

const clone = (value) => structuredClone(value);
const fieldOf = (piece) => (START_FIELD[piece.seat] + piece.step) % RING_LENGTH;
const onRing = (state, field) => state.pieces.filter((p) => p.at === "ring" && fieldOf(p) === field);
const inHouse = (state, house, depth) =>
  state.pieces.find((p) => p.at === "house" && p.house === house && p.step === depth) ?? null;
const onOwnStart = (piece) => piece.at === "ring" && piece.step === 0;
const seatOnTurn = (state) => state.players[state.turn].seat;
const piecesOf = (state, seat) => state.pieces.filter((p) => p.seat === seat);
const stillPlaying = (state) => state.players.filter((p) => p.place == null && !p.gone);

/**
 * Starts a round.
 *
 * @param {{ id: string, name: string }[]} players - Two to four, in turn order.
 * @param {Partial<typeof DEFAULT_OPTIONS>} [options] - House rules to switch off.
 * @returns {object} The game state.
 */
export function newGame(players, options = {}) {
  const seats = SEATING[players.length] ?? SEATING[4];
  const rules = { ...DEFAULT_OPTIONS, ...options };
  const pieces = [];
  players.forEach((_, n) => {
    for (let k = 0; k < 4; k++) pieces.push({ id: pieces.length, seat: seats[n], at: "yard", step: k, house: null });
  });
  return {
    phase: "play",
    options: rules,
    players: players.map((p, n) => ({ id: p.id, name: p.name, seat: seats[n], place: null, gone: false })),
    pieces,
    turn: 0,
    die: null,
    rolls: 0,
    triesLeft: rules.three ? 3 : 1,
    awaiting: "roll",
    moves: [],
    sides: [],
    held: null,
    last: null,
    loser: null,
    log: [],
  };
}

/**
 * True when a seat has nothing on the board that could move: every piece
 * is in the yard or on the star. A piece walking out of an opponent's
 * house counts as out: it moves with any number.
 */
export function needsSix(state, seat) {
  return piecesOf(state, seat).every((p) => p.at === "yard" || p.at === "star" || p.at === "gone");
}

/**
 * Every move the player on turn may make with the die showing. Each move
 * carries where the piece ends and whom it knocks out, so applying it is
 * bookkeeping and a board can show the options without knowing a rule.
 *
 * @returns {{ id: number, piece: number, kind: string, to: object, kicks: number[] }[]}
 */
export function legalMoves(state) {
  if (state.phase !== "play" || state.die == null) return [];
  const seat = seatOnTurn(state);
  const die = state.die;
  const opts = state.options;
  const mine = piecesOf(state, seat);
  const list = [];

  const isSafe = (piece) => opts.safe && onOwnStart(piece);

  /** Landing on a ring field: own piece blocks (bar the stack rule), opponents go home. */
  const ontoRing = (piece, kind, field) => {
    const step = (field - START_FIELD[seat] + RING_LENGTH) % RING_LENGTH;
    const there = onRing(state, field).filter((p) => p.id !== piece.id);
    if (there.length === 0) {
      list.push({ piece: piece.id, kind, to: { at: "ring", step }, kicks: [] });
    } else if (there[0].seat === seat) {
      if (opts.stack && field === START_FIELD[seat] && there.length < 4) {
        list.push({ piece: piece.id, kind, to: { at: "ring", step }, kicks: [] });
      }
    } else if (!isSafe(there[0])) {
      list.push({ piece: piece.id, kind, to: { at: "ring", step }, kicks: there.map((p) => p.id) });
    }
  };

  /** Landing in a house: own piece blocks, anybody else is thrown out. */
  const intoHouse = (piece, kind, house, depth) => {
    const there = inHouse(state, house, depth);
    if (there && there.seat === seat) return;
    list.push({ piece: piece.id, kind, to: { at: "house", house, step: depth }, kicks: there ? [there.id] : [] });
  };

  if (die === 6) {
    const parked = mine.find((p) => p.at === "yard");
    if (parked) ontoRing(parked, "leave", START_FIELD[seat]);
  }

  mine
    .filter((p) => p.at === "ring")
    .forEach((p) => {
      const here = fieldOf(p);
      const next = p.step + die;
      if (next < RING_LENGTH) ontoRing(p, "forward", (START_FIELD[seat] + next) % RING_LENGTH);
      else if (next < GOAL_STEP) intoHouse(p, "home", seat, next - RING_LENGTH);
      else if (next === GOAL_STEP) list.push({ piece: p.id, kind: "goal", to: { at: "star" }, kicks: [] });

      if (opts.home) {
        // Every seat's house, played or not: a raider may sit in an empty seat's house.
        for (let house = 0; house < 4; house++) {
          if (house === seat) continue;
          const toEntry = (ENTRY_FIELD[house] - here + RING_LENGTH) % RING_LENGTH;
          const depth = die - toEntry - 1;
          if (depth < 0 || depth >= HOUSE_LENGTH) continue;
          const there = inHouse(state, house, depth);
          if (!there || there.seat === seat) continue; // a raid, never a parking space
          list.push({ piece: p.id, kind: "homekick", to: { at: "house", house, step: depth }, kicks: [there.id] });
        }
      }

      if (opts.back) {
        const back = (here - die + RING_LENGTH) % RING_LENGTH;
        const step = (((p.step - die) % RING_LENGTH) + RING_LENGTH) % RING_LENGTH;
        const there = onRing(state, back);
        if (there.length && there[0].seat !== seat && !isSafe(there[0])) {
          list.push({ piece: p.id, kind: "backkick", to: { at: "ring", step }, kicks: there.map((q) => q.id) });
        } else if (!there.length && sideTargets(state, seat, back).length) {
          list.push({ piece: p.id, kind: "backstep", to: { at: "ring", step }, kicks: [] });
        }
      }
    });

  mine
    .filter((p) => p.at === "house" && p.house === seat)
    .forEach((p) => {
      const depth = p.step + die;
      if (depth < HOUSE_LENGTH) intoHouse(p, "homestep", seat, depth);
      else if (depth === HOUSE_LENGTH) list.push({ piece: p.id, kind: "goal", to: { at: "star" }, kicks: [] });
    });

  // A raider in an opponent's house walks back out the way it came.
  mine
    .filter((p) => p.at === "house" && p.house !== seat)
    .forEach((p) => {
      const toMouth = p.step + 1;
      if (die < toMouth) intoHouse(p, "walkout", p.house, p.step - die);
      else ontoRing(p, "walkout", (ENTRY_FIELD[p.house] + die - toMouth) % RING_LENGTH);
    });

  return list.map((move, id) => ({ id, ...move }));
}

/** Opponents a piece of `seat` standing on ring `field` could side-kick. */
function sideTargets(state, seat, field) {
  if (!state.options.side) return [];
  return LATERALS[field].flatMap((lateral) => {
    if (inHouse(state, lateral.via.house, lateral.via.depth)) return [];
    const there = onRing(state, lateral.to);
    if (!there.length || there[0].seat === seat) return [];
    if (state.options.safe && onOwnStart(there[0])) return [];
    return [{ lateral, there }];
  });
}

function sideKicksFor(state, pieceId) {
  const piece = state.pieces[pieceId];
  if (piece.at !== "ring") return [];
  return sideTargets(state, piece.seat, fieldOf(piece)).map(({ lateral, there }, id) => ({
    id,
    piece: pieceId,
    kind: "sidekick",
    to: { at: "ring", step: (lateral.to - START_FIELD[piece.seat] + RING_LENGTH) % RING_LENGTH },
    kicks: there.map((q) => q.id),
    via: lateral.via,
  }));
}

function note(state, entry) {
  state.log.push(entry);
  if (state.log.length > 40) state.log.shift();
}

/** Back to the first free yard space: the only way a piece loses ground. */
function sendHome(state, pieceId) {
  const piece = state.pieces[pieceId];
  const taken = state.pieces.filter((q) => q.seat === piece.seat && q.at === "yard").map((q) => q.step);
  let slot = 0;
  while (taken.includes(slot)) slot++;
  Object.assign(piece, { at: "yard", step: slot, house: null });
}

function apply(state, move) {
  const piece = state.pieces[move.piece];
  const from = { at: piece.at, step: piece.step, house: piece.house };
  move.kicks.forEach((id) => sendHome(state, id));

  if (move.to.at === "star") {
    const arrived = state.pieces.filter((q) => q.seat === piece.seat && q.at === "star").length;
    Object.assign(piece, { at: "star", step: arrived, house: null });
  } else {
    Object.assign(piece, { at: move.to.at, step: move.to.step, house: move.to.at === "house" ? move.to.house : null });
  }

  // Only the board reads this, to walk the piece instead of teleporting it.
  state.last = {
    n: (state.last?.n ?? 0) + 1,
    piece: piece.id,
    seat: piece.seat,
    kind: move.kind,
    die: state.die,
    from,
    to: { at: piece.at, step: piece.step, house: piece.house },
    kicks: [...move.kicks],
    via: move.via ?? null,
  };

  const victims = move.kicks.map((id) => state.pieces[id]);
  note(state, {
    kind: move.kind,
    seat: piece.seat,
    victims: victims.length,
    victimSeat: victims.length ? victims[0].seat : null,
    house: move.to.at === "house" ? move.to.house : null,
  });
}

function clearTurn(state) {
  state.die = null;
  state.awaiting = "roll";
  state.moves = [];
  state.sides = [];
  state.held = null;
}

function endTurn(state) {
  clearTurn(state);
  const left = stillPlaying(state);
  if (left.length <= 1) {
    state.phase = "over";
    state.loser = left.length ? state.players.indexOf(left[0]) : null;
    note(state, { kind: "over", seat: left.length ? left[0].seat : null });
    return;
  }
  let n = state.turn;
  do n = (n + 1) % state.players.length;
  while (state.players[n].place != null || state.players[n].gone);
  state.turn = n;
  state.triesLeft = state.options.three && needsSix(state, state.players[n].seat) ? 3 : 1;
}

function afterMove(state) {
  const player = state.players[state.turn];
  let finished = false;
  if (player.place == null && piecesOf(state, player.seat).every((p) => p.at === "star")) {
    player.place = state.players.filter((p) => p.place != null).length + 1;
    note(state, { kind: "finished", seat: player.seat, place: player.place });
    finished = true;
  }
  if (!finished && state.die === 6 && stillPlaying(state).length > 1) {
    clearTurn(state);
    state.triesLeft = 1;
    return;
  }
  endTurn(state);
}

/**
 * The player on turn rolls. The host chooses the value, so every page
 * sees the same die.
 *
 * @param {object} state
 * @param {number} value - 1 to 6.
 * @returns {object} The new state (unchanged when a roll is not due).
 */
export function roll(state, value) {
  if (state.phase !== "play" || state.awaiting !== "roll") return state;
  const next = clone(state);
  next.die = value;
  next.rolls += 1;
  next.moves = legalMoves(next);
  note(next, { kind: "roll", seat: seatOnTurn(next), value });

  if (next.moves.length) {
    next.awaiting = "move";
    return next;
  }
  next.triesLeft -= 1;
  if (next.triesLeft > 0) {
    next.die = null;
  } else {
    note(next, { kind: "stuck", seat: seatOnTurn(next) });
    endTurn(next);
  }
  return next;
}

/**
 * Plays one of the offered moves. If the piece ends facing an opponent
 * across a house, the state waits for a side-kick decision.
 *
 * @param {object} state
 * @param {number} moveId - An id from `state.moves`.
 */
export function playMove(state, moveId) {
  if (state.phase !== "play" || state.awaiting !== "move") return state;
  const move = state.moves.find((m) => m.id === moveId);
  if (!move) return state;
  const next = clone(state);
  apply(next, move);
  next.moves = [];

  const sides = sideKicksFor(next, move.piece);
  if (sides.length) {
    next.sides = sides;
    next.held = move.piece;
    next.awaiting = "side";
    return next;
  }
  afterMove(next);
  return next;
}

/**
 * Takes a side kick, or leaves it (null). A step back onto an empty field
 * was only allowed to line one up, so after a "backstep" leaving it is
 * refused and the state comes back unchanged.
 *
 * @param {object} state
 * @param {number | null} sideId - An id from `state.sides`, or null.
 */
export function chooseSide(state, sideId) {
  if (state.phase !== "play" || state.awaiting !== "side") return state;
  const pick = sideId == null ? null : state.sides.find((s) => s.id === sideId);
  if (!pick && (sideId != null || state.last?.kind === "backstep")) return state;
  const next = clone(state);
  if (pick) apply(next, pick);
  next.sides = [];
  next.held = null;
  afterMove(next);
  return next;
}

/**
 * Takes a player out mid-round. Their pieces leave the board, so whoever
 * they blocked is free, and the round goes on without them.
 *
 * @param {object} state
 * @param {string} playerId
 */
export function removePlayer(state, playerId) {
  const n = state.players.findIndex((p) => p.id === playerId);
  if (n < 0 || state.players[n].gone || state.phase !== "play") return state;
  const next = clone(state);
  const player = next.players[n];
  player.gone = true;
  next.pieces.forEach((p) => {
    if (p.seat === player.seat && p.at !== "star") Object.assign(p, { at: "gone", house: null });
  });
  note(next, { kind: "removed", seat: player.seat });

  const left = stillPlaying(next);
  if (left.length <= 1) {
    clearTurn(next);
    next.phase = "over";
    const someoneFinished = next.players.some((p) => p.place != null);
    next.loser = left.length && someoneFinished ? next.players.indexOf(left[0]) : null;
    note(next, { kind: "over", seat: next.loser != null ? left[0].seat : null });
    return next;
  }
  if (next.turn === n) endTurn(next);
  return next;
}

/**
 * Every cell the last move passed over, in order, ending where it landed.
 * Only the board reads this: a six visibly walks six fields, and a back
 * kick visibly walks the wrong way.
 *
 * @param {object | null} last - `state.last`.
 * @returns {number[][]} Grid cells [x, y].
 */
export function movePath(last) {
  if (!last) return [];
  const { seat, from, to } = last;
  const cells = [];
  const ring = (field) => cells.push(TRACK[((field % RING_LENGTH) + RING_LENGTH) % RING_LENGTH]);
  const house = (h, depth) => cells.push(HOUSES[h][depth]);
  const fieldFrom = (spot) => START_FIELD[seat] + spot.step;
  // Progress along a piece's own way: 0-39 ring, 40-43 own house, 44 star.
  const progress = (spot) => {
    if (spot.at === "ring") return spot.step;
    if (spot.at === "house") return RING_LENGTH + spot.step;
    return GOAL_STEP;
  };

  switch (last.kind) {
    case "leave":
      ring(START_FIELD[seat]);
      break;
    case "backkick":
    case "backstep":
      for (let k = 1; k <= last.die; k++) ring(fieldFrom(from) - k);
      break;
    case "sidekick": {
      cells.push(HOUSES[last.via.house][last.via.depth]);
      ring(fieldFrom(to));
      break;
    }
    case "homekick": {
      let field = fieldFrom(from) % RING_LENGTH;
      while (field !== ENTRY_FIELD[to.house]) {
        field = (field + 1) % RING_LENGTH;
        ring(field);
      }
      for (let k = 0; k <= to.step; k++) house(to.house, k);
      break;
    }
    case "walkout": {
      if (to.at === "house") {
        for (let k = from.step - 1; k >= to.step; k--) house(from.house, k);
      } else {
        for (let k = from.step - 1; k >= 0; k--) house(from.house, k);
        let field = ENTRY_FIELD[from.house];
        ring(field);
        const end = fieldFrom(to) % RING_LENGTH;
        while (field !== end) {
          field = (field + 1) % RING_LENGTH;
          ring(field);
        }
      }
      break;
    }
    default:
      // forward, home, homestep, goal: straight along its own way
      for (let q = progress(from) + 1; q <= progress(to); q++) {
        if (q < RING_LENGTH) ring(START_FIELD[seat] + q);
        else if (q < GOAL_STEP) house(seat, q - RING_LENGTH);
        else cells.push(STAR);
      }
  }
  return cells;
}

/** The ring field a piece stands on, for drawing. */
export function fieldOfPiece(piece) {
  return fieldOf(piece);
}
