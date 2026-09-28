import { describe, expect, it } from "bun:test";
import { SEAT_COLOURS, describeEntry, turnLine } from "./captions.js";
import { newGame } from "./rules.js";

const game = newGame([
  { id: "a", name: "Ama" },
  { id: "k", name: "Kofi" },
]);

describe("describeEntry", () => {
  const say = (entry) => describeEntry(entry, game);

  it("names who rolled what", () => {
    expect(say({ kind: "roll", seat: 0, value: 4 })).toBe("Ama rolled a 4.");
  });

  it("names each kind of kick and its victim", () => {
    expect(say({ kind: "forward", seat: 0, victims: 1, victimSeat: 2 })).toBe("Ama knocks Kofi out.");
    expect(say({ kind: "backkick", seat: 0, victims: 1, victimSeat: 2 })).toBe("Back kick! Ama knocks Kofi out.");
    expect(say({ kind: "sidekick", seat: 2, victims: 2, victimSeat: 0 })).toBe(
      "Side kick! Kofi knocks out 2 of Ama's pieces.",
    );
    expect(say({ kind: "homekick", seat: 0, victims: 1, victimSeat: 2, house: 2 })).toBe(
      "Home kick! Ama raids Kofi's house and knocks Kofi out.",
    );
  });

  it("stays quiet about a plain step, which the board already shows", () => {
    expect(say({ kind: "forward", seat: 0, victims: 0 })).toBeNull();
  });

  it("tells the moments that matter", () => {
    expect(say({ kind: "leave", seat: 0, victims: 0 })).toBe("Ama brings a piece out.");
    expect(say({ kind: "goal", seat: 2, victims: 0 })).toBe("Kofi reaches the star.");
    expect(say({ kind: "finished", seat: 0, place: 1 })).toBe("Ama is home! Place 1.");
    expect(say({ kind: "stuck", seat: 2 })).toBe("Kofi has nothing to move.");
    expect(say({ kind: "over", seat: 2 })).toBe("Kofi is the last one home.");
    expect(say({ kind: "over", seat: null })).toBe("Not enough players left to finish the round.");
    expect(say({ kind: "removed", seat: 2 })).toBe("Kofi left the round.");
  });

  it("falls back to the colour when a seat has no player", () => {
    expect(describeEntry({ kind: "goal", seat: 3 }, game)).toBe(`${SEAT_COLOURS[3]} reaches the star.`);
  });
});

describe("turnLine", () => {
  it("speaks to the player on turn", () => {
    expect(turnLine(game, ["a"])).toBe("Your turn. Roll the die.");
    expect(turnLine({ ...game, awaiting: "move" }, ["a"])).toBe("Pick a piece to move.");
    expect(turnLine({ ...game, awaiting: "side" }, ["a"])).toBe("Side kick on offer. Take it?");
    expect(turnLine({ ...game, awaiting: "side", last: { kind: "backstep" } }, ["a"])).toBe(
      "You stepped back for it: now take the side kick.",
    );
  });

  it("says who is playing to everybody else", () => {
    expect(turnLine(game, ["k"])).toBe("Ama is playing.");
  });

  it("names the player when one device plays several seats", () => {
    const g = { ...game, turn: 1 };
    expect(turnLine(g, ["a", "k"])).toBe("Kofi's turn. Roll the die.");
  });
});
