// A round-robin tournament between the opponents in agents.js.
//
// DEV-ONLY. The game never imports this file. Run it by hand:
//
//   bun benchmark.js                       every opponent, both rule sets
//   bun benchmark.js --games 6             more games per pairing
//   bun benchmark.js --mode baawa          one rule set only
//   bun benchmark.js --scale 1             full thinking time (slow)
//   bun benchmark.js --agents deep,mcts    only these opponents
//
// Why it exists: "hard" and "easy" have to be measured, not asserted. The
// tiers in agents.js and the difficulty table in README.md are whatever this
// prints. Every pairing plays the same number of games in each seat, because
// moving first is an advantage in both rule sets.
//
// --scale shrinks the thinking clock of the two opponents that use one
// (Dreamer and Chief) so the tournament finishes in minutes. It does not touch
// a fixed search depth. A ranking measured at a small scale can understate the
// two slow opponents, so confirm the top of the table with --scale 1 before
// changing any tier.

import { AGENT_IDS, agentById, chooseMove } from "./agents.js";
import { MODE_IDS, rulesFor, newGame, modeById } from "./modes.js";
import { mulberry32 } from "./rng.js";

const args = parseArgs(process.argv.slice(2));
const games = args.games ?? 4;
const scale = args.scale ?? 0.25;
const modes = args.mode ? [args.mode] : MODE_IDS;
const ids = args.agents ? args.agents.split(",") : AGENT_IDS;
const plyLimit = args.plies ?? 600;

/**
 * Read the command line into a plain object.
 * @param {string[]} argv the arguments after the script name
 * @returns {Object}
 */
function parseArgs(argv) {
  const out = {};
  for (let at = 0; at < argv.length; at += 1) {
    const flag = argv[at];
    if (!flag.startsWith("--")) continue;
    const name = flag.slice(2);
    const value = argv[at + 1];
    if (value === undefined || value.startsWith("--")) {
      out[name] = true;
    } else {
      out[name] = Number.isNaN(Number(value)) ? value : Number(value);
      at += 1;
    }
  }
  return out;
}

/**
 * Play one game and report who won and how long each side thought.
 * @param {string} mode the rule set
 * @param {string} south the opponent in the South seat
 * @param {string} north the opponent in the North seat
 * @param {number} seed the random seed, so the game can be replayed
 * @returns {{winner: number|null, scores: number[], plies: number, ms: number[]}}
 */
function playGame(mode, south, north, seed) {
  const rules = rulesFor(mode);
  const rng = mulberry32(seed);
  const ms = [0, 0];
  const moves = [0, 0];
  let state = newGame(mode);
  let plies = 0;

  while (!state.over && plies < plyLimit) {
    const seat = state.turn;
    const id = seat === 0 ? south : north;
    const started = performance.now();
    const move = chooseMove(id, state, rules, rng, scale);
    ms[seat] += performance.now() - started;
    moves[seat] += 1;
    state = rules.applyMove(state, move).state;
    plies += 1;
  }

  return {
    winner: state.winner,
    scores: state.scores.slice(),
    plies,
    ms,
    moves,
  };
}

/** A fresh empty result row for one opponent. */
function emptyRow() {
  return { points: 0, games: 0, wins: 0, draws: 0, losses: 0, ms: 0, moves: 0 };
}

/**
 * Run every pairing in one rule set.
 * @param {string} mode the rule set
 * @returns {{table: Object, head: Object}} per-opponent totals and head-to-head
 */
function tournament(mode) {
  const table = Object.fromEntries(ids.map((id) => [id, emptyRow()]));
  const head = {};
  let seed = 1000;

  for (let a = 0; a < ids.length; a += 1) {
    for (let b = a + 1; b < ids.length; b += 1) {
      const one = ids[a];
      const two = ids[b];
      head[`${one} vs ${two}`] = { [one]: 0, [two]: 0, draws: 0 };

      for (let round = 0; round < games; round += 1) {
        // Each pairing plays every game twice, once from each seat.
        for (const [south, north] of [
          [one, two],
          [two, one],
        ]) {
          seed += 1;
          const result = playGame(mode, south, north, seed);
          const seats = [south, north];
          for (const seat of [0, 1]) {
            const id = seats[seat];
            table[id].games += 1;
            table[id].ms += result.ms[seat];
            table[id].moves += result.moves[seat];
          }
          if (result.winner === null) {
            table[south].points += 0.5;
            table[north].points += 0.5;
            table[south].draws += 1;
            table[north].draws += 1;
            head[`${one} vs ${two}`].draws += 1;
          } else {
            const winner = seats[result.winner];
            const loser = seats[result.winner === 0 ? 1 : 0];
            table[winner].points += 1;
            table[winner].wins += 1;
            table[loser].losses += 1;
            head[`${one} vs ${two}`][winner] += 1;
          }
        }
      }
      process.stdout.write(".");
    }
  }
  process.stdout.write("\n");
  return { table, head };
}

/** Print one table, strongest first. */
function report(label, table) {
  const rows = ids
    .map((id) => ({ id, name: agentById(id).name, ...table[id] }))
    .sort((one, two) => two.points / two.games - one.points / one.games);

  console.log(`\n${label}  (${games * 2} games per pairing, scale ${scale})`);
  console.log("rank  opponent           win%   W    D    L    ms/move");
  rows.forEach((row, index) => {
    const rate = ((row.points / row.games) * 100).toFixed(1).padStart(5);
    const perMove = (row.ms / Math.max(1, row.moves)).toFixed(1).padStart(7);
    const label = `${row.name} (${row.id})`.padEnd(18);
    console.log(
      `${String(index + 1).padStart(4)}  ${label}${rate}  ${String(row.wins).padStart(3)}  ` +
        `${String(row.draws).padStart(3)}  ${String(row.losses).padStart(3)}  ${perMove}`
    );
  });
  return rows;
}

const overall = Object.fromEntries(ids.map((id) => [id, emptyRow()]));

for (const mode of modes) {
  const started = Date.now();
  const { table, head } = tournament(mode);
  report(modeById(mode).name, table);
  console.log("\nhead to head:");
  for (const [pairing, result] of Object.entries(head)) {
    const [one, two] = pairing.split(" vs ");
    console.log(`  ${pairing.padEnd(26)} ${result[one]} - ${result[two]}  (${result.draws} drawn)`);
  }
  for (const id of ids) {
    for (const key of ["points", "games", "wins", "draws", "losses", "ms", "moves"]) {
      overall[id][key] += table[id][key];
    }
  }
  console.log(`\n(${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

if (modes.length > 1) {
  console.log("\n=== both rule sets together ===");
  report("Both rule sets", overall);
  console.log("\nTiers for agents.js, weakest first:");
  const order = ids
    .map((id) => ({ id, rate: overall[id].points / overall[id].games }))
    .sort((one, two) => one.rate - two.rate)
    .map((row, index) => `${index + 1}. ${row.id} (${(row.rate * 100).toFixed(1)}%)`);
  console.log("  " + order.join("\n  "));
}
