// The words the screen says about a move.
//
// Three jobs, all of them pure text:
//   - `captionFor` turns one event into the short words that pop up over the
//     board, and the sentence the status line shows at that moment.
//   - `summarise` turns a whole finished move into one line.
//   - `previewText` turns a held pit into the line that says what the move
//     would do.
//
// The words live here, away from the screen, so they can be tested and so one
// wording change is one edit. `tone` names a colour and follows the seats:
// seat 0 is Blue and seat 1 is Red, the same as the pit and chip classes.
// `mood` names the status line's colour: "good", "bad" or nothing.

import { other } from "./board.js";

/** The colour each seat's floating words take. */
const TONES = ["blue", "red"];

/**
 * `+4` for the player who is moving, `Red +4` for anybody else, because a
 * bare number over the board would look like the mover's own score.
 * @param {number} taker the player the seeds go to
 * @param {number} count how many seeds
 * @param {number} mover the player whose move this is
 * @param {string[]} names what to call each player
 * @returns {string}
 */
function plus(taker, count, mover, names) {
  return taker === mover ? `+${count}` : `${names[taker]} +${count}`;
}

/**
 * The words for one event of a move, as the event plays.
 * @param {Object} event one event from an engine move
 * @param {number} mover the player whose move this is
 * @param {string[]} names what to call each player
 * @returns {{text: string, tone: string, status: string, mood: string}|null}
 *   the floating words, their colour, the status line and its colour; null for
 *   an event the player does not need words for
 */
export function captionFor(event, mover, names) {
  switch (event.type) {
    case "store":
      // Every seed a Kalah move drops in a store is a point, so it is worth a
      // "+1" even though the store's own number also goes up.
      return {
        text: plus(event.player, 1, mover, names),
        tone: TONES[event.player],
        status: "",
        mood: "",
      };

    case "capture": {
      const taker = event.player;
      const mine = taker === mover;
      return {
        text: plus(taker, event.count, mover, names),
        tone: TONES[taker],
        // Ba-awa pays the pit's owner, so a move can score for the opponent.
        // Saying why stops that looking like a mistake.
        status: event.byOwner
          ? `${names[taker]} owns that pit, so ${names[taker]} takes ${event.count}.`
          : `${names[taker]} takes ${event.count}.`,
        mood: mine ? "good" : "bad",
      };
    }

    case "extraTurn":
      return {
        text: "Play again",
        tone: "gold",
        status: `${names[event.player]} plays again.`,
        mood: "good",
      };

    case "sweep":
      return {
        text: plus(event.player, event.count, mover, names),
        tone: TONES[event.player],
        status: `${names[event.player]} takes the ${event.count} seeds left on the board.`,
        mood: event.player === mover ? "good" : "bad",
      };

    case "lift":
      // The first lift needs no words. A later one is the relay going round
      // again, which is the rule a new Ba-awa player asks about first.
      if (!event.lap || event.lap < 2) return null;
      return {
        text: "",
        tone: "gold",
        status: `Lap ${event.lap}: that pit was not empty, so the move lifts again.`,
        mood: "",
      };

    case "relayCutOff":
      return {
        text: "",
        tone: "gold",
        status: `The relay went round ${event.laps} times, so it stops there.`,
        mood: "",
      };

    default:
      return null;
  }
}

/**
 * One line about a move that has finished.
 * @param {Object[]} events the events of the move
 * @param {number} mover the player who moved
 * @param {string[]} names what to call each player
 * @returns {{text: string|null, tone: string, badge: string|null}} the line,
 *   its colour, and the tag to pop over the mover's score; `text` is null when
 *   the move did nothing worth a line
 */
export function summarise(events, mover, names) {
  const captures = events.filter((event) => event.type === "capture");
  const extra = events.some((event) => event.type === "extraTurn");
  const mine = captures
    .filter((event) => event.player === mover)
    .reduce((sum, event) => sum + event.count, 0);
  const theirs = captures
    .filter((event) => event.player !== mover)
    .reduce((sum, event) => sum + event.count, 0);
  const laps = events.filter((event) => event.type === "lift").length;

  if (extra) {
    return {
      text: `${names[mover]} lands in their own store and plays again.`,
      tone: "good",
      badge: "+1 turn",
    };
  }

  const parts = [];
  if (mine > 0) parts.push(`${names[mover]} takes ${mine}`);
  if (theirs > 0) parts.push(`${names[other(mover)]} takes ${theirs}`);
  if (laps > 1) parts.push(`${laps} laps`);
  if (parts.length > 0) {
    return { text: `${parts.join(", ")}.`, tone: mine >= theirs ? "good" : "bad", badge: null };
  }
  return { text: null, tone: "", badge: null };
}

/**
 * The line a held pit shows: what the move would do, before it is played.
 * Both engines answer `describeMove` with the same fields, so one wording
 * covers both games.
 * @param {Object} look the answer from an engine's `describeMove`
 * @param {number} mover the player whose move this would be
 * @param {string[]} names what to call each player
 * @returns {string} one to four short sentences
 */
export function previewText(look, mover, names) {
  const parts = [];
  if (look.laps > 1) parts.push(`The move lifts ${look.laps} times.`);
  parts.push(
    look.landsInStore !== null
      ? `The last seed falls into ${names[look.landsInStore]}'s store.`
      : `The last seed lands in pit ${look.lands + 1}.`
  );
  if (look.captured > 0) parts.push(`${names[mover]} takes ${look.captured}.`);
  if (look.given > 0) parts.push(`${names[other(mover)]} takes ${look.given}.`);
  if (look.extraTurn) parts.push(`${names[mover]} plays again.`);
  return parts.join(" ");
}
