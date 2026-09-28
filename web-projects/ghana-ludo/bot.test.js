import { describe, expect, it } from "bun:test";
import { chooseAction } from "./bot.js";
import { RING_LENGTH, START_FIELD, chooseSide, legalMoves, newGame, playMove, roll } from "./rules.js";

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

function put(state, placements) {
  const next = structuredClone(state);
  Object.entries(placements).forEach(([id, where]) => {
    const piece = next.pieces[Number(id)];
    if (where === "star") Object.assign(piece, { at: "star", step: 0, house: null });
    else if ("ring" in where) {
      Object.assign(piece, {
        at: "ring",
        step: (where.ring - START_FIELD[piece.seat] + RING_LENGTH) % RING_LENGTH,
        house: null,
      });
    } else Object.assign(piece, { at: "house", step: where.depth, house: where.house });
  });
  return next;
}

/** A two-player board, seat 0 on turn, with the die already rolled. */
function rolled(placements, die, options = {}) {
  const g = put(newGame(players(2), options), placements);
  g.die = die;
  g.awaiting = "move";
  g.moves = legalMoves(g);
  return g;
}

const chosen = (g) => g.moves.find((m) => m.id === chooseAction(g, () => 0));

describe("chooseAction", () => {
  it("knocks an opponent out when it can", () => {
    const g = rolled({ 0: { ring: 5 }, 1: { ring: 12 }, 4: { ring: 8 } }, 3);
    expect(chosen(g).kicks).toEqual([4]);
  });

  it("goes to the star rather than take a plain step", () => {
    const g = rolled({ 0: { ring: 38 }, 1: { ring: 10 } }, 6);
    expect(chosen(g).kind).toBe("goal");
  });

  it("brings a piece out on a six when nothing better is on", () => {
    const g = rolled({ 0: { ring: 12 } }, 6);
    expect(chosen(g).kind).toBe("leave");
  });

  it("does not park a piece just in front of an opponent when a safe step exists", () => {
    // Piece 0 at 10 could go to 13, two ahead of the opponent on 11.
    // Piece 1 at 25 goes to 28, far from anybody.
    const g = rolled({ 0: { ring: 10 }, 1: { ring: 25 }, 4: { ring: 11 } }, 3, { back: false });
    expect(chosen(g).piece).toBe(1);
  });

  it("takes a side kick on offer, and must take it after lining one up", () => {
    let g = roll(put(newGame(players(2)), { 0: { ring: 31 }, 4: { ring: 4 } }), 3);
    g = playMove(g, g.moves.find((m) => m.kind === "forward").id);
    expect(g.awaiting).toBe("side");
    expect(chooseAction(g, () => 0)).toBe(g.sides[0].id);

    let step = roll(put(newGame(players(2)), { 0: { ring: 4 }, 4: { ring: 37 } }), 3);
    step = playMove(step, step.moves.find((m) => m.kind === "backstep").id);
    expect(chooseAction(step, () => 0)).toBe(step.sides[0].id);
  });

  it("returns null when there is nothing to decide", () => {
    expect(chooseAction(newGame(players(2)))).toBeNull();
  });

  it("wins most two-player games against a player who moves at random", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let botWins = 0;
    const games = 30;
    for (let n = 0; n < games; n++) {
      let g = newGame(players(2));
      while (g.phase === "play") {
        const botTurn = g.turn === 0;
        if (g.awaiting === "roll") g = roll(g, 1 + Math.floor(random() * 6));
        else if (g.awaiting === "move") {
          const id = botTurn ? chooseAction(g, random) : g.moves[Math.floor(random() * g.moves.length)].id;
          g = playMove(g, id);
        } else {
          const id = botTurn ? chooseAction(g, random) : g.last.kind === "backstep" ? g.sides[0].id : null;
          g = chooseSide(g, id);
        }
      }
      if (g.loser === 1) botWins++;
    }
    expect(botWins).toBeGreaterThanOrEqual(22);
  });
});
