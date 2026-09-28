// The table: who sits where, which rules are on, and the round in play.
//
// This is the state online-sync's host shares (see ../online-sync/session.js).
// It wraps the rules (rules.js) with the parts a round needs around it: a
// lobby, seats for guests, bots and extra players on the host's own device,
// and the reducer that decides whether an intent from a given player is
// theirs to make. Everything here is pure; the page glue (app.js) only
// calls these and draws the result.
//
//   seat kinds   host    the device that opened the table
//                guest   a friend on their own device, over the link
//                bot     played by the host's device (bot.js)
//                local   a second person passing the host's device round

import { DEFAULT_OPTIONS, chooseSide, newGame, playMove, removePlayer, roll } from "./rules.js";

export const MAX_SEATS = 4;
export const BOT_NAMES = ["Kwame", "Akosua", "Yaw", "Efua", "Kofi", "Abena", "Kwesi", "Adwoa"];

const copy = (value) => structuredClone(value);
const roundRunning = (table) => table.game != null && table.game.phase === "play";
const inLobby = (table) => !roundRunning(table);

/** A table with its host in the first seat and every house rule on. */
export function newTable(host) {
  return {
    seats: [{ id: host.id, name: host.name, kind: "host" }],
    options: { ...DEFAULT_OPTIONS },
    game: null,
    round: 0,
  };
}

/**
 * The online-sync `admit` hook: may this player sit down?
 * A returning player keeps their seat, even mid-round. A newcomer gets a
 * free seat, or a bot's chair, but never a seat in a round already running.
 *
 * @returns {{ state: object } | { refuse: "running" | "full" }}
 */
export function admit(table, player) {
  if (table.seats.some((s) => s.id === player.id)) return { state: table };
  if (roundRunning(table)) return { refuse: "running" };
  const next = copy(table);
  const seat = { id: player.id, name: player.name || "Guest", kind: "guest" };
  if (next.seats.length < MAX_SEATS) {
    next.seats.push(seat);
    return { state: next };
  }
  const botChair = next.seats.findIndex((s) => s.kind === "bot");
  if (botChair < 0) return { refuse: "full" };
  next.seats[botChair] = seat;
  return { state: next };
}

function uniqueId(table, prefix) {
  let n = 1;
  while (table.seats.some((s) => s.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

/** Adds a bot to the lobby, or returns null when the table is full. */
export function addBot(table) {
  if (!inLobby(table) || table.seats.length >= MAX_SEATS) return null;
  const next = copy(table);
  const taken = new Set(next.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !taken.has(n)) ?? `Bot ${next.seats.length}`;
  next.seats.push({ id: uniqueId(next, "bot"), name, kind: "bot" });
  return next;
}

/** Adds a second person who plays on the host's device. */
export function addLocal(table, name) {
  if (!inLobby(table) || table.seats.length >= MAX_SEATS) return null;
  const next = copy(table);
  next.seats.push({ id: uniqueId(next, "local"), name: String(name || "Player").slice(0, 24), kind: "local" });
  return next;
}

/** Frees a seat in the lobby. The host's own seat cannot go. */
export function removeSeat(table, seatId) {
  if (!inLobby(table)) return null;
  const seat = table.seats.find((s) => s.id === seatId);
  if (!seat || seat.kind === "host") return null;
  const next = copy(table);
  next.seats = next.seats.filter((s) => s.id !== seatId);
  return next;
}

/** Switches one house rule, in the lobby only. */
export function setOption(table, key, value) {
  if (!inLobby(table) || !(key in DEFAULT_OPTIONS)) return null;
  const next = copy(table);
  next.options[key] = Boolean(value);
  return next;
}

/** Deals a new round to the seats, in seat order. */
export function startRound(table) {
  if (!inLobby(table) || table.seats.length < 2) return null;
  const next = copy(table);
  next.game = newGame(
    next.seats.map((s) => ({ id: s.id, name: s.name })),
    next.options,
  );
  next.round += 1;
  return next;
}

/** Takes a player out of the running round; the others play on. */
export function takeOut(table, seatId) {
  if (!roundRunning(table)) return null;
  const next = copy(table);
  next.game = removePlayer(next.game, seatId);
  return next;
}

/** After a round: back to the lobby, without anybody who was taken out. */
export function backToLobby(table) {
  if (roundRunning(table)) return null;
  const next = copy(table);
  const gone = new Set((next.game?.players ?? []).filter((p) => p.gone).map((p) => p.id));
  next.seats = next.seats.filter((s) => s.kind === "host" || !gone.has(s.id));
  next.game = null;
  return next;
}

/**
 * The seats a device may act for: its own, and for the host also every
 * local seat. Bots are never "controlled"; the host drives them itself.
 */
export function seatsControlledBy(table, deviceId) {
  const isHost = table.seats[0]?.id === deviceId;
  return table.seats.filter((s) => s.id === deviceId || (isHost && s.kind === "local")).map((s) => s.id);
}

/**
 * The reducer online-sync's host runs for every intent:
 *   { t: "roll" }  { t: "move", id }  { t: "side", id | null }
 * each with an optional `as` naming a local seat the host acts for.
 * It returns the new table, or null when the intent is not this player's
 * to make or the rules refuse it.
 *
 * @param {{ rollDie: () => number }} dependencies - The die; the host passes
 *   a fair one, the tests a loaded one.
 */
export function makeReducer({ rollDie }) {
  return (table, intent, playerId) => {
    if (!roundRunning(table) || !intent) return null;
    const game = table.game;

    let actor = playerId;
    if (intent.as != null) {
      const seat = table.seats.find((s) => s.id === intent.as);
      if (playerId !== table.seats[0].id || !seat || seat.kind !== "local") return null;
      actor = intent.as;
    }
    if (game.players[game.turn].id !== actor) return null;

    let after;
    if (intent.t === "roll" && game.awaiting === "roll") after = roll(game, rollDie());
    else if (intent.t === "move" && game.awaiting === "move") after = playMove(game, intent.id);
    else if (intent.t === "side" && game.awaiting === "side") after = chooseSide(game, intent.id ?? null);
    else return null;

    if (after === game) return null; // the rules refused it
    return { ...table, game: after };
  };
}

/**
 * A fair die from random bytes. A byte has 256 values, which six does not
 * divide, so the four highest (252-255) are thrown away rather than
 * folded in, which would favour ones to fours.
 *
 * @param {() => number} nextByte - Returns 0-255.
 * @returns {number} 1-6.
 */
export function dieFromBytes(nextByte) {
  for (let guard = 0; guard < 1000; guard++) {
    const b = nextByte();
    if (b < 252) return (b % 6) + 1;
  }
  return 1 + Math.floor(Math.random() * 6);
}

/** The die the host rolls, from the platform's secure random source. */
export function fairDie() {
  const buffer = new Uint8Array(1);
  return dieFromBytes(() => crypto.getRandomValues(buffer)[0]);
}

const seatOnTurn = (table) => table.seats.find((s) => s.id === table.game.players[table.game.turn].id);

/**
 * One step of a bot's turn (roll, move, or side-kick decision), run by the
 * host outside the reducer, because no link speaks for a bot.
 *
 * @param {object} table
 * @param {{ rollDie: () => number, choose: (game: object) => number | null }} dependencies
 * @returns {object | null} The new table, or null when no bot is on turn.
 */
export function botStep(table, { rollDie, choose }) {
  if (!roundRunning(table) || seatOnTurn(table)?.kind !== "bot") return null;
  const game = table.game;
  let after = game;
  if (game.awaiting === "roll") after = roll(game, rollDie());
  else if (game.awaiting === "move") after = playMove(game, choose(game));
  else if (game.awaiting === "side") after = chooseSide(game, choose(game));
  return after === game ? null : { ...table, game: after };
}

/**
 * Plays a person's move when it is the only one the die allows. The host
 * waits a moment first, so everybody sees the die land.
 *
 * @returns {object | null} The new table, or null when there is a real choice.
 */
export function forcedStep(table) {
  if (!roundRunning(table) || seatOnTurn(table)?.kind === "bot") return null;
  const game = table.game;
  if (game.awaiting !== "move" || game.moves.length !== 1) return null;
  return { ...table, game: playMove(game, game.moves[0].id) };
}
