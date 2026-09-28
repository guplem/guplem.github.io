// The words the game says: one line per log entry, and the turn line.
//
// Pure, so the tests read exactly what a player reads. The page has one
// language, so the sentences live here rather than in a catalogue.

/** Seat colours in seat order: the board's corners, clockwise from top left. */
export const SEAT_COLOURS = ["Red", "Gold", "Green", "Blue"];

function nameOf(game, seat) {
  return game.players.find((p) => p.seat === seat)?.name ?? SEAT_COLOURS[seat];
}

function knockout(game, entry) {
  const victim = nameOf(game, entry.victimSeat);
  return entry.victims > 1 ? `knocks out ${entry.victims} of ${victim}'s pieces` : `knocks ${victim} out`;
}

/**
 * One log entry as a sentence, or null for an entry not worth a line
 * (a plain step: the board already shows it).
 *
 * @param {object} entry - An item of `game.log`.
 * @param {object} game - The game, for the players' names.
 * @returns {string | null}
 */
export function describeEntry(entry, game) {
  const who = entry.seat == null ? "" : nameOf(game, entry.seat);
  const kicked = entry.victims > 0;
  switch (entry.kind) {
    case "roll":
      return `${who} rolled a ${entry.value}.`;
    case "stuck":
      return `${who} has nothing to move.`;
    case "leave":
      return kicked ? `${who} comes out and ${knockout(game, entry)}.` : `${who} brings a piece out.`;
    case "forward":
    case "walkout":
      return kicked ? `${who} ${knockout(game, entry)}.` : null;
    case "home":
    case "homestep":
      return kicked ? `${who} throws an intruder out of the house.` : null;
    case "backkick":
      return `Back kick! ${who} ${knockout(game, entry)}.`;
    case "sidekick":
      return `Side kick! ${who} ${knockout(game, entry)}.`;
    case "homekick":
      return `Home kick! ${who} raids ${nameOf(game, entry.house)}'s house and ${knockout(game, entry)}.`;
    case "backstep":
      return `${who} steps back to line up a side kick.`;
    case "goal":
      return `${who} reaches the star.`;
    case "finished":
      return `${who} is home! Place ${entry.place}.`;
    case "removed":
      return `${who} left the round.`;
    case "over":
      return entry.seat == null ? "Not enough players left to finish the round." : `${who} is the last one home.`;
    default:
      return null;
  }
}

/**
 * The line above the board: what the player on turn must do, said to
 * them when this device plays that seat, and who is playing otherwise.
 *
 * @param {object} game
 * @param {string[]} mine - The seat ids this device plays.
 * @returns {string}
 */
export function turnLine(game, mine) {
  if (game.phase !== "play") return "The round is over.";
  const player = game.players[game.turn];
  if (!mine.includes(player.id)) return `${player.name} is playing.`;
  const several = mine.filter((id) => game.players.some((p) => p.id === id && !p.gone && p.place == null)).length > 1;
  switch (game.awaiting) {
    case "roll":
      return several ? `${player.name}'s turn. Roll the die.` : "Your turn. Roll the die.";
    case "move":
      return several ? `${player.name}: pick a piece to move.` : "Pick a piece to move.";
    case "side":
      return game.last?.kind === "backstep"
        ? "You stepped back for it: now take the side kick."
        : "Side kick on offer. Take it?";
    default:
      return "";
  }
}
