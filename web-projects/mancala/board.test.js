import { describe, it, expect } from "bun:test";
import {
  PIT_COUNT,
  SOUTH,
  NORTH,
  other,
  homePits,
  homeStart,
  oppositePit,
  initialPits,
  seedsIn,
  totalOnBoard,
  fixedOwners,
  ownersFromPitCounts,
} from "./board.js";

describe("board geometry", () => {
  it("has twelve pits in the sowing ring", () => {
    expect(PIT_COUNT).toBe(12);
  });

  it("gives each player six home pits", () => {
    expect(homePits(SOUTH)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(homePits(NORTH)).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it("starts each home row at the first pit the player sows into", () => {
    expect(homeStart(SOUTH)).toBe(0);
    expect(homeStart(NORTH)).toBe(6);
  });

  it("faces pit i across the board from pit 11 - i", () => {
    expect(oppositePit(0)).toBe(11);
    expect(oppositePit(5)).toBe(6);
    expect(oppositePit(6)).toBe(5);
    expect(oppositePit(11)).toBe(0);
  });

  it("swaps between the two players", () => {
    expect(other(SOUTH)).toBe(NORTH);
    expect(other(NORTH)).toBe(SOUTH);
  });
});

describe("seed counting", () => {
  it("fills every pit with the same number of seeds", () => {
    expect(initialPits(4)).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(totalOnBoard(initialPits(4))).toBe(48);
  });

  it("adds up the seeds in a list of pits", () => {
    const pits = [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 9];
    expect(seedsIn(pits, [0, 1, 2])).toBe(6);
    expect(seedsIn(pits, [11])).toBe(9);
    expect(seedsIn(pits, [])).toBe(0);
  });
});

describe("pit ownership", () => {
  it("gives each player their own row when nothing is conquered", () => {
    expect(fixedOwners()).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  });

  it("keeps the six-six split when both players own six pits", () => {
    expect(ownersFromPitCounts(6, 6)).toEqual(fixedOwners());
  });

  it("extends the winner forward from their own row and leaves the loser the tail of theirs", () => {
    // South owns 8: their own row 0-5 plus 6 and 7, the first two pits of
    // North's row in sowing order. North keeps 8-11.
    expect(ownersFromPitCounts(8, 4)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
    // The mirror case: North owns 9, so it takes 0, 1, 2 from South's row.
    expect(ownersFromPitCounts(3, 9)).toEqual([1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  });

  it("gives one player the whole ring when the other owns nothing", () => {
    expect(ownersFromPitCounts(12, 0)).toEqual(new Array(12).fill(0));
    expect(ownersFromPitCounts(0, 12)).toEqual(new Array(12).fill(1));
  });

  it("rejects counts that do not tile the ring", () => {
    expect(() => ownersFromPitCounts(5, 5)).toThrow();
    expect(() => ownersFromPitCounts(7, 7)).toThrow();
  });
});
