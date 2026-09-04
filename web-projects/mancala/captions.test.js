import { describe, it, expect } from "bun:test";
import { captionFor, summarise, previewText } from "./captions.js";

const NAMES = ["Blue", "Red"];

describe("the words for one event", () => {
  it("says nothing about a seed that only moves", () => {
    expect(captionFor({ type: "drop", pit: 3, seeds: 2, player: 0 }, 0, NAMES)).toBeNull();
    expect(captionFor({ type: "turn", player: 1 }, 0, NAMES)).toBeNull();
    expect(captionFor({ type: "gameOver", winner: 0 }, 0, NAMES)).toBeNull();
    expect(captionFor({ type: "lift", pit: 3, count: 4, player: 0, lap: 1 }, 0, NAMES)).toBeNull();
  });

  it("counts a seed into a store as a point", () => {
    const said = captionFor({ type: "store", player: 0, total: 3, last: false }, 0, NAMES);
    expect(said).toMatchObject({ text: "+1", tone: "blue", status: "" });
  });

  it("names the mover's own capture", () => {
    const said = captionFor({ type: "capture", pit: 3, facing: 8, count: 6, player: 0 }, 0, NAMES);
    expect(said).toMatchObject({ text: "+6", tone: "blue", status: "Blue takes 6.", mood: "good" });
  });

  it("names the other player when the pit's owner takes the four", () => {
    // Ba-awa pays the pit's owner, so a move can score for the opponent. The
    // caption must say whose four it is, or the score looks like a mistake.
    const said = captionFor(
      { type: "capture", pit: 7, count: 4, player: 1, last: false, byOwner: true },
      0,
      NAMES
    );
    expect(said).toMatchObject({
      text: "Red +4",
      tone: "red",
      status: "Red owns that pit, so Red takes 4.",
      mood: "bad",
    });
  });

  it("calls out the extra turn", () => {
    const said = captionFor({ type: "extraTurn", player: 1 }, 1, NAMES);
    expect(said).toMatchObject({ text: "Play again", tone: "gold", status: "Red plays again.", mood: "good" });
  });

  it("names who takes the seeds left on the board", () => {
    const said = captionFor({ type: "sweep", player: 1, count: 7, pits: [6, 7] }, 0, NAMES);
    expect(said).toMatchObject({
      text: "Red +7",
      tone: "red",
      status: "Red takes the 7 seeds left on the board.",
      mood: "bad",
    });
  });

  it("explains a relay lifting again", () => {
    const said = captionFor({ type: "lift", pit: 3, count: 4, player: 0, lap: 3 }, 0, NAMES);
    expect(said.text).toBe("");
    expect(said.status).toBe("Lap 3: that pit was not empty, so the move lifts again.");
  });

  it("explains the relay cut-off", () => {
    const said = captionFor({ type: "relayCutOff", pit: 3, laps: 300 }, 0, NAMES);
    expect(said.text).toBe("");
    expect(said.status).toBe("The relay went round 300 times, so it stops there.");
  });
});

describe("the one line a finished move gets", () => {
  it("leads with the extra turn, because that is what happens next", () => {
    const events = [
      { type: "lift", pit: 5, count: 1, player: 0 },
      { type: "store", player: 0, total: 1, last: true },
      { type: "extraTurn", player: 0 },
    ];
    expect(summarise(events, 0, NAMES)).toEqual({
      text: "Blue lands in their own store and plays again.",
      tone: "good",
      badge: "+1 turn",
    });
  });

  it("adds up both players' captures and the laps", () => {
    const events = [
      { type: "lift", pit: 0, count: 2, player: 0, lap: 1 },
      { type: "capture", pit: 8, count: 4, player: 1, byOwner: true },
      { type: "lift", pit: 8, count: 3, player: 0, lap: 2 },
      { type: "capture", pit: 2, count: 4, player: 0 },
      { type: "turn", player: 1 },
    ];
    expect(summarise(events, 0, NAMES)).toEqual({
      text: "Blue takes 4, Red takes 4, 2 laps.",
      tone: "good",
      badge: null,
    });
  });

  it("says nothing when nothing happened", () => {
    const events = [
      { type: "lift", pit: 0, count: 2, player: 0 },
      { type: "drop", pit: 1, seeds: 5, player: 0 },
      { type: "turn", player: 1 },
    ];
    expect(summarise(events, 0, NAMES)).toEqual({ text: null, tone: "", badge: null });
  });

  it("marks a move that pays the opponent more", () => {
    const events = [
      { type: "lift", pit: 0, count: 2, player: 0 },
      { type: "capture", pit: 8, count: 4, player: 1, byOwner: true },
      { type: "turn", player: 1 },
    ];
    expect(summarise(events, 0, NAMES).tone).toBe("bad");
  });
});

describe("the line a held pit shows", () => {
  it("names the pit the last seed reaches", () => {
    const look = { lands: 6, landsInStore: null, captured: 0, given: 0, laps: 1, extraTurn: false };
    expect(previewText(look, 0, NAMES)).toBe("The last seed lands in pit 7.");
  });

  it("says the seed falls in a store, and that the turn comes back", () => {
    const look = { lands: null, landsInStore: 0, captured: 0, given: 0, laps: 1, extraTurn: true };
    expect(previewText(look, 0, NAMES)).toBe(
      "The last seed falls into Blue's store. Blue plays again."
    );
  });

  it("counts the capture the move would win", () => {
    const look = { lands: 3, landsInStore: null, captured: 6, given: 0, laps: 1, extraTurn: false };
    expect(previewText(look, 0, NAMES)).toBe("The last seed lands in pit 4. Blue takes 6.");
  });

  it("warns that a relay pays the other player too", () => {
    const look = { lands: 2, landsInStore: null, captured: 4, given: 8, laps: 4, extraTurn: false };
    expect(previewText(look, 0, NAMES)).toBe(
      "The move lifts 4 times. The last seed lands in pit 3. Blue takes 4. Red takes 8."
    );
  });
});
