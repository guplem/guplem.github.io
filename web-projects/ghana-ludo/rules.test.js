import { describe, expect, it } from "bun:test";
import {
  DEFAULT_OPTIONS,
  ENTRY_FIELD,
  HOUSES,
  LATERALS,
  RING_LENGTH,
  START_FIELD,
  TRACK,
  YARDS,
  chooseSide,
  legalMoves,
  movePath,
  needsSix,
  newGame,
  playMove,
  removePlayer,
  roll,
} from "./rules.js";

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));

/**
 * Places pieces by hand. `where` is "yard", "star", { ring: absoluteField },
 * or { house: seat, depth }. A ring field is given absolute (0-39), the way
 * a person reads the board, and converted to the piece's own step here.
 */
function put(state, placements) {
  const next = structuredClone(state);
  Object.entries(placements).forEach(([id, where]) => {
    const piece = next.pieces[Number(id)];
    if (where === "yard") Object.assign(piece, { at: "yard", step: piece.id % 4, house: null });
    else if (where === "star") Object.assign(piece, { at: "star", step: 0, house: null });
    else if ("ring" in where) {
      const step = (where.ring - START_FIELD[piece.seat] + RING_LENGTH) % RING_LENGTH;
      Object.assign(piece, { at: "ring", step, house: null });
    } else Object.assign(piece, { at: "house", step: where.depth, house: where.house });
  });
  return next;
}

/** A fresh two-player game (seats 0 and 2) with the given placements. */
function board(placements = {}, options = {}, count = 2) {
  return put(newGame(players(count), options), placements);
}

const kindsFor = (state, pieceId) => legalMoves(state).filter((m) => m.piece === pieceId).map((m) => m.kind).sort();
const moveOf = (state, pieceId, kind) => legalMoves(state).find((m) => m.piece === pieceId && m.kind === kind);
const abs = (piece) => (START_FIELD[piece.seat] + piece.step) % RING_LENGTH;
const withDie = (state, value) => ({ ...structuredClone(state), die: value, awaiting: "move" });

describe("the board", () => {
  it("has a 40-field track where every field touches the next", () => {
    expect(TRACK).toHaveLength(40);
    expect(new Set(TRACK.map(String)).size).toBe(40);
    TRACK.forEach(([x, y], i) => {
      const [nx, ny] = TRACK[(i + 1) % 40];
      expect(Math.abs(nx - x) + Math.abs(ny - y)).toBe(1);
    });
  });

  it("puts the four start fields at the arm ends, ten fields apart", () => {
    expect(START_FIELD).toEqual([0, 10, 20, 30]);
    expect(START_FIELD.map((f) => TRACK[f])).toEqual([
      [0, 4],
      [6, 0],
      [10, 6],
      [4, 10],
    ]);
    expect(ENTRY_FIELD).toEqual([39, 9, 19, 29]);
  });

  it("runs every house from beside its entry field to beside the star", () => {
    HOUSES.forEach((cells, seat) => {
      const [ex, ey] = TRACK[ENTRY_FIELD[seat]];
      const [hx, hy] = cells[0];
      expect(Math.abs(hx - ex) + Math.abs(hy - ey)).toBe(1);
      const [lx, ly] = cells[3];
      expect(Math.abs(lx - 5) + Math.abs(ly - 5)).toBe(1);
    });
  });

  it("gives each seat a four-space yard in its own corner", () => {
    expect(YARDS[0]).toContainEqual([1, 1]);
    expect(YARDS[1]).toContainEqual([9, 1]);
    expect(YARDS[2]).toContainEqual([9, 9]);
    expect(YARDS[3]).toContainEqual([1, 9]);
  });

  it("pairs the fields that face each other across a house", () => {
    const pairs = LATERALS.flatMap((list, from) => list.map((l) => [from, l.to]));
    expect(pairs).toHaveLength(32); // 16 pairs, each seen from both sides
    expect(LATERALS[1]).toEqual([{ to: 37, via: { house: 0, depth: 0 } }]);
    // An inner corner of the cross faces across both houses beside it.
    expect(LATERALS[4]).toEqual([
      { to: 14, via: { house: 1, depth: 3 } },
      { to: 34, via: { house: 0, depth: 3 } },
    ]);
    expect(LATERALS[0]).toEqual([]); // start fields face nothing
  });
});

describe("a new game", () => {
  it("seats two players opposite each other, three or four in order", () => {
    expect(newGame(players(2)).players.map((p) => p.seat)).toEqual([0, 2]);
    expect(newGame(players(3)).players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(newGame(players(4)).players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
  });

  it("parks four pieces per player in the yard, and waits for the first roll", () => {
    const g = newGame(players(3));
    expect(g.pieces).toHaveLength(12);
    expect(g.pieces.every((p) => p.at === "yard")).toBe(true);
    expect(g.awaiting).toBe("roll");
    expect(g.turn).toBe(0);
    expect(g.phase).toBe("play");
  });

  it("switches every house rule on unless told otherwise", () => {
    expect(newGame(players(2)).options).toEqual(DEFAULT_OPTIONS);
    expect(newGame(players(2), { side: false }).options.side).toBe(false);
  });

  it("gives three tries to a player with nothing out, one when the rule is off", () => {
    expect(newGame(players(2)).triesLeft).toBe(3);
    expect(newGame(players(2), { three: false }).triesLeft).toBe(1);
  });
});

describe("rolling", () => {
  it("lets a player with nothing out try three times, then passes the turn", () => {
    let g = newGame(players(2));
    g = roll(g, 2);
    expect([g.turn, g.awaiting, g.triesLeft]).toEqual([0, "roll", 2]);
    g = roll(roll(g, 5), 1);
    expect([g.turn, g.awaiting]).toEqual([1, "roll"]);
    expect(g.log.at(-1).kind).toBe("stuck");
  });

  it("offers the first parked piece onto the start field on a six", () => {
    const g = roll(newGame(players(2)), 6);
    expect(g.awaiting).toBe("move");
    expect(g.moves).toEqual([{ id: 0, piece: 0, kind: "leave", to: { at: "ring", step: 0 }, kicks: [] }]);
  });

  it("gives another roll after a six, with a single try", () => {
    let g = roll(newGame(players(2)), 6);
    g = playMove(g, 0);
    expect([g.turn, g.awaiting, g.triesLeft]).toEqual([0, "roll", 1]);
    expect(g.pieces[0]).toMatchObject({ at: "ring", step: 0 });
  });

  it("passes on a miss once a piece is out", () => {
    let g = board({ 0: { ring: 5 } });
    g.triesLeft = 1;
    g = roll(g, 3);
    expect(g.awaiting).toBe("move");
    g = playMove(g, moveOf(g, 0, "forward").id);
    expect(g.turn).toBe(1);
  });

  it("never changes the state it was given", () => {
    const g = newGame(players(2));
    const copy = structuredClone(g);
    roll(g, 6);
    expect(g).toEqual(copy);
  });
});

describe("moving forwards", () => {
  it("moves a piece the number rolled", () => {
    const g = withDie(board({ 0: { ring: 5 } }), 3);
    expect(moveOf(g, 0, "forward").to).toEqual({ at: "ring", step: 8 });
  });

  it("knocks an opponent it lands on back to the first free yard space (front kick)", () => {
    let g = withDie(board({ 0: { ring: 5 }, 4: { ring: 8 } }), 3);
    g.moves = legalMoves(g);
    const kick = moveOf(g, 0, "forward");
    expect(kick.kicks).toEqual([4]);
    g = playMove(g, kick.id);
    expect(g.pieces[4]).toMatchObject({ at: "yard", step: 0 });
    expect(g.log.some((e) => e.kind === "forward" && e.victims === 1)).toBe(true);
  });

  it("knocks out every piece of a pile at once", () => {
    const g = withDie(board({ 0: { ring: 17 }, 4: { ring: 20 }, 5: { ring: 20 } }, { safe: false }), 3);
    expect(moveOf(g, 0, "forward").kicks).toEqual([4, 5]);
  });

  it("cannot land on its own piece", () => {
    const g = withDie(board({ 0: { ring: 5 }, 1: { ring: 8 } }), 3);
    expect(kindsFor(g, 0)).not.toContain("forward");
  });

  it("jumps over anybody on the way", () => {
    const g = withDie(board({ 0: { ring: 5 }, 1: { ring: 6 }, 4: { ring: 7 } }), 3);
    expect(moveOf(g, 0, "forward").to.step).toBe(8);
  });

  it("leaves an opponent on its own start field alone while the safe rule is on", () => {
    const safe = withDie(board({ 0: { ring: 17 }, 4: { ring: 20 } }), 3);
    expect(kindsFor(safe, 0)).not.toContain("forward");
    const open = withDie(board({ 0: { ring: 17 }, 4: { ring: 20 } }, { safe: false }), 3);
    expect(moveOf(open, 0, "forward").kicks).toEqual([4]);
  });

  it("lets up to four of one's own pile on one's start field only with the stack rule", () => {
    const stacked = withDie(board({ 0: { ring: 0 } }), 6);
    expect(moveOf(stacked, 1, "leave").kicks).toEqual([]);
    const plain = withDie(board({ 0: { ring: 0 } }, { stack: false }), 6);
    expect(kindsFor(plain, 1)).toEqual([]);
  });

  it("throws an opponent off the start field when a piece comes out onto it", () => {
    const g = withDie(board({ 4: { ring: 0 } }), 6);
    expect(moveOf(g, 0, "leave").kicks).toEqual([4]);
  });
});

describe("the house and the star", () => {
  it("turns into its own house after a full lap", () => {
    const g = withDie(board({ 0: { ring: 38 } }), 4);
    expect(moveOf(g, 0, "home").to).toEqual({ at: "house", house: 0, step: 2 });
  });

  it("reaches the star with the exact number only", () => {
    expect(moveOf(withDie(board({ 0: { ring: 38 } }), 6), 0, "goal").to).toEqual({ at: "star" });
    expect(kindsFor(withDie(board({ 0: { ring: 39 } }), 6), 0)).toEqual([]);
  });

  it("walks on inside the house, blocked only by its own piece", () => {
    expect(moveOf(withDie(board({ 0: { house: 0, depth: 1 } }), 2), 0, "homestep").to.step).toBe(3);
    expect(moveOf(withDie(board({ 0: { house: 0, depth: 1 } }), 3), 0, "goal")).toBeDefined();
    expect(kindsFor(withDie(board({ 0: { house: 0, depth: 1 }, 1: { house: 0, depth: 3 } }), 2), 0)).toEqual([]);
  });

  it("throws an intruder out of its own house when it lands on it", () => {
    const g = withDie(board({ 0: { ring: 38 }, 4: { house: 0, depth: 2 } }), 4);
    expect(moveOf(g, 0, "home").kicks).toEqual([4]);
  });

  it("records the finishing place, and ends a two-player round", () => {
    let g = board({ 1: "star", 2: "star", 3: "star", 0: { house: 0, depth: 3 } });
    g = roll(g, 1);
    g = playMove(g, moveOf(g, 0, "goal").id);
    expect(g.players[0].place).toBe(1);
    expect(g.phase).toBe("over");
    expect(g.loser).toBe(1);
  });

  it("gives no extra roll to a player who finishes on a six", () => {
    let g = board({ 1: "star", 2: "star", 3: "star", 0: { ring: 38 } }, {}, 3);
    g = roll(g, 6);
    g = playMove(g, moveOf(g, 0, "goal").id);
    expect(g.players[0].place).toBe(1);
    expect(g.phase).toBe("play");
    expect(g.turn).toBe(1);
  });
});

describe("home kick", () => {
  it("walks into an opponent's house with the exact number, only to knock a piece out", () => {
    // Seat 2's entry field is 19; from 17 that is 2 steps, then depth 1.
    const g = withDie(board({ 0: { ring: 17 }, 4: { house: 2, depth: 1 } }), 4);
    expect(moveOf(g, 0, "homekick")).toMatchObject({ to: { at: "house", house: 2, step: 1 }, kicks: [4] });
    const empty = withDie(board({ 0: { ring: 17 } }), 4);
    expect(kindsFor(empty, 0)).not.toContain("homekick");
  });

  it("is off when the rule is off", () => {
    const g = withDie(board({ 0: { ring: 17 }, 4: { house: 2, depth: 1 } }, { home: false }), 4);
    expect(kindsFor(g, 0)).not.toContain("homekick");
  });

  it("lets the raider walk back out the way it came, with any number", () => {
    const inside = board({ 0: { house: 2, depth: 1 } });
    expect(needsSix(inside, 0)).toBe(false);
    expect(moveOf(withDie(inside, 1), 0, "walkout").to).toEqual({ at: "house", house: 2, step: 0 });
    // Two steps reach the entry field (19), the third lands on 20.
    const out = moveOf(withDie(inside, 3), 0, "walkout");
    expect(out.to).toEqual({ at: "ring", step: 20 });
  });
});

describe("back kick", () => {
  it("moves backwards onto an opponent exactly the number behind", () => {
    const g = withDie(board({ 0: { ring: 10 }, 4: { ring: 7 } }), 3);
    expect(moveOf(g, 0, "backkick")).toMatchObject({ to: { at: "ring", step: 7 }, kicks: [4] });
  });

  it("costs the long way round when it passes back over the start field", () => {
    const g = withDie(board({ 0: { ring: 1 }, 4: { ring: 38 } }), 3);
    expect(moveOf(g, 0, "backkick").to.step).toBe(38);
  });

  it("does not step back onto an empty field unless a side kick waits there", () => {
    const g = withDie(board({ 0: { ring: 10 } }), 3);
    expect(kindsFor(g, 0)).toEqual(["forward"]);
  });

  it("is off when the rule is off", () => {
    const g = withDie(board({ 0: { ring: 10 }, 4: { ring: 7 } }, { back: false }), 3);
    expect(kindsFor(g, 0)).not.toContain("backkick");
  });
});

describe("side kick", () => {
  // Field 34 faces field 4 across seat 0's house (the cell between is depth 3).
  const lined = { 0: { ring: 31 }, 4: { ring: 4 } };

  it("is offered after a move that ends facing an opponent across a house", () => {
    let g = roll(board(lined), 3);
    g = playMove(g, moveOf(g, 0, "forward").id);
    expect(g.awaiting).toBe("side");
    expect(g.sides).toHaveLength(1);
    expect(g.sides[0]).toMatchObject({ piece: 0, kind: "sidekick", kicks: [4], to: { at: "ring", step: 4 } });
  });

  it("knocks the opponent out when taken", () => {
    let g = roll(board(lined), 3);
    g = playMove(g, moveOf(g, 0, "forward").id);
    g = chooseSide(g, g.sides[0].id);
    expect(g.pieces[4].at).toBe("yard");
    expect(abs(g.pieces[0])).toBe(4);
    expect(g.turn).toBe(1);
  });

  it("may be left, and the turn goes on", () => {
    let g = roll(board(lined), 3);
    g = playMove(g, moveOf(g, 0, "forward").id);
    g = chooseSide(g, null);
    expect(g.pieces[4].at).toBe("ring");
    expect(g.turn).toBe(1);
  });

  it("is blocked by any piece in the house cell between", () => {
    let g = roll(board({ ...lined, 1: { house: 0, depth: 3 } }), 3);
    g = playMove(g, moveOf(g, 0, "forward").id);
    expect(g.awaiting).toBe("roll");
    expect(g.turn).toBe(1);
  });

  it("lines up by stepping back onto an empty field, and then must be taken", () => {
    // From 4, three back is 1, and 1 faces 37 across the house.
    let g = roll(board({ 0: { ring: 4 }, 4: { ring: 37 } }), 3);
    const step = moveOf(g, 0, "backstep");
    expect(step.to.step).toBe(1);
    g = playMove(g, step.id);
    expect(g.awaiting).toBe("side");

    const refused = chooseSide(g, null);
    expect(refused).toEqual(g); // saying no is not allowed

    g = chooseSide(g, g.sides[0].id);
    expect(g.pieces[4].at).toBe("yard");
    expect(abs(g.pieces[0])).toBe(37);
  });

  it("is off when the rule is off", () => {
    let g = roll(board(lined, { side: false }), 3);
    g = playMove(g, moveOf(g, 0, "forward").id);
    expect(g.awaiting).toBe("roll");
  });
});

describe("leaving the table", () => {
  it("takes a player's pieces off the board and passes the turn on", () => {
    let g = board({ 4: { ring: 25 } }, {}, 3);
    g.turn = 1;
    g = removePlayer(g, "p1");
    expect(g.players[1].gone).toBe(true);
    expect(g.pieces.filter((p) => p.seat === 1).every((p) => p.at === "gone")).toBe(true);
    expect(g.turn).toBe(2);
  });

  it("ends the round when only one player is left, with no loser if nobody finished", () => {
    const g = removePlayer(newGame(players(2)), "p1");
    expect(g.phase).toBe("over");
    expect(g.loser).toBeNull();
  });

  it("skips finished and departed players in the turn order", () => {
    let g = newGame(players(4), { three: false });
    g.players[1].place = 1;
    g = removePlayer(g, "p2");
    g = roll(g, 2);
    expect(g.turn).toBe(3);
  });
});

describe("movePath", () => {
  it("lists every field a forward move passes, ending where it lands", () => {
    let g = roll(board({ 0: { ring: 5 } }), 3);
    g = playMove(g, moveOf(g, 0, "forward").id);
    expect(movePath(g.last)).toEqual([TRACK[6], TRACK[7], TRACK[8]]);
  });

  it("walks a back kick the wrong way round", () => {
    let g = roll(board({ 0: { ring: 10 }, 4: { ring: 7 } }), 3);
    g = playMove(g, moveOf(g, 0, "backkick").id);
    expect(movePath(g.last)).toEqual([TRACK[9], TRACK[8], TRACK[7]]);
  });

  it("walks into the house and onto the star", () => {
    let g = roll(board({ 0: { ring: 38 } }), 6);
    g = playMove(g, moveOf(g, 0, "goal").id);
    const path = movePath(g.last);
    expect(path).toHaveLength(6);
    expect(path.at(-1)).toEqual([5, 5]);
  });
});

describe("random games", () => {
  /** mulberry32: a small seeded generator, so a failure can be replayed. */
  const seeded = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function checkBoard(g) {
    const byField = new Map();
    g.pieces
      .filter((p) => p.at === "ring")
      .forEach((p) => {
        const field = (START_FIELD[p.seat] + p.step) % RING_LENGTH;
        byField.set(field, [...(byField.get(field) ?? []), p]);
      });
    byField.forEach((list, field) => {
      // Never two colours on one field, and a pile only on its own start.
      expect(new Set(list.map((p) => p.seat)).size).toBe(1);
      if (list.length > 1) expect(field).toBe(START_FIELD[list[0].seat]);
    });
    const houseCells = g.pieces.filter((p) => p.at === "house").map((p) => `${p.house}:${p.step}`);
    expect(new Set(houseCells).size).toBe(houseCells.length);
  }

  [2, 3, 4].forEach((count) => {
    it(`always ends, and never breaks the board, with ${count} players`, () => {
      for (let game = 0; game < 12; game++) {
        const random = seeded(count * 1000 + game);
        let g = newGame(players(count), { stack: random() < 0.5, safe: random() < 0.5 });
        let steps = 0;
        while (g.phase === "play") {
          steps++;
          if (steps > 20000) throw new Error(`game ${game} did not end`);
          if (g.awaiting === "roll") g = roll(g, 1 + Math.floor(random() * 6));
          else if (g.awaiting === "move") g = playMove(g, g.moves[Math.floor(random() * g.moves.length)].id);
          else {
            const options = g.last?.kind === "backstep" ? g.sides : [...g.sides, null];
            const pick = options[Math.floor(random() * options.length)];
            g = chooseSide(g, pick == null ? null : pick.id);
          }
          checkBoard(g);
        }
        expect(g.players.filter((p) => p.place != null)).toHaveLength(count - 1);
        expect(g.loser).not.toBeNull();
      }
    });
  });
});
