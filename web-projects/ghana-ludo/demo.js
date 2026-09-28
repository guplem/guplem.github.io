// A round in progress, the same one every time: opened by the `#demo` link.
//
// It exists for the portfolio image (a picture must be re-takeable, and the
// capture script cannot play turns), and it is a quick way to see the board
// full of pieces. The host plus three bots play a seeded game until the
// board is busy and it is the host's turn to roll.

import { chooseAction } from "./bot.js";
import { addBot, newTable, startRound } from "./table.js";
import { chooseSide, playMove, roll } from "./rules.js";

/** mulberry32: small, seeded, the same in every browser. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {{ id?: string, name?: string, seed?: number, minSteps?: number }} [options]
 * @returns {object} A table (see table.js) with a round in progress.
 */
export function demoTable({ id = "demo-host", name = "Ama", seed = 11, minSteps = 220 } = {}) {
  const random = seeded(seed);
  let table = startRound(addBot(addBot(addBot(newTable({ id, name })))));
  let game = table.game;
  for (let step = 0; step < 5000; step++) {
    const busy = game.pieces.filter((p) => p.at === "ring").length >= 6;
    if (step >= minSteps && busy && game.turn === 0 && game.awaiting === "roll") break;
    if (game.phase !== "play") break;
    if (game.awaiting === "roll") game = roll(game, 1 + Math.floor(random() * 6));
    else if (game.awaiting === "move") game = playMove(game, chooseAction(game, random));
    else game = chooseSide(game, chooseAction(game, random));
  }
  table = { ...table, game };
  return table;
}
