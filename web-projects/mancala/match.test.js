import { describe, it, expect } from "bun:test";
import { distributePits, createMatch, recordRound, DEFAULT_PITS_TO_WIN } from "./match.js";

describe("distributePits", () => {
  it("buys one pit for every four seeds captured", () => {
    expect(distributePits([24, 24], 0)).toEqual([6, 6]);
    expect(distributePits([32, 16], 0)).toEqual([8, 4]);
    expect(distributePits([4, 44], 0)).toEqual([1, 11]);
  });

  it("gives the spare pit to the bigger leftover", () => {
    // 45 seeds is eleven pits and one seed left over; 3 seeds is no pit and
    // three left over, which is the bigger share of the twelfth pit.
    expect(distributePits([45, 3], 0)).toEqual([11, 1]);
    expect(distributePits([3, 45], 0)).toEqual([1, 11]);
  });

  it("uses the given player to break an even split of the spare pit", () => {
    expect(distributePits([26, 22], 0)).toEqual([7, 5]);
    expect(distributePits([26, 22], 1)).toEqual([6, 6]);
  });

  it("leaves a player with nothing when they captured less than four", () => {
    expect(distributePits([46, 2], 1)).toEqual([11, 1]);
    expect(distributePits([48, 0], 1)).toEqual([12, 0]);
  });

  it("refuses scores that are not the whole board", () => {
    expect(() => distributePits([10, 10], 0)).toThrow();
  });
});

describe("a Kalah match", () => {
  it("is one single game", () => {
    const match = createMatch({ mode: "kalah" });
    expect(match.conquest).toBe(false);
    expect(match.round).toBe(1);
    expect(match.pitCounts).toEqual([6, 6]);

    const after = recordRound(match, { scores: [30, 18], winner: 0, endReason: "side-empty" });
    expect(after.over).toBe(true);
    expect(after.winner).toBe(0);
    expect(after.history).toHaveLength(1);
  });
});

describe("a Ba-awa match", () => {
  const match = createMatch({ mode: "baawa" });

  it("starts both players with their own six pits and South to move", () => {
    expect(match.conquest).toBe(true);
    expect(match.owner).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    expect(match.firstPlayer).toBe(0);
    expect(match.pitsToWin).toBe(DEFAULT_PITS_TO_WIN);
  });

  it("turns captured seeds into pits and swaps who starts", () => {
    const after = recordRound(match, { scores: [28, 20], winner: 0, endReason: "starved" });
    expect(after.over).toBe(false);
    expect(after.round).toBe(2);
    expect(after.pitCounts).toEqual([7, 5]);
    // South took pit 6, the first pit of North's row in sowing order.
    expect(after.owner).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(after.firstPlayer).toBe(1);
  });

  it("keeps a running list of the rounds played", () => {
    const one = recordRound(match, { scores: [28, 20], winner: 0, endReason: "starved" });
    const two = recordRound(one, { scores: [20, 28], winner: 1, endReason: "starved" });
    expect(two.history).toHaveLength(2);
    expect(two.history[0]).toMatchObject({ round: 1, winner: 0, pitCounts: [7, 5] });
    expect(two.history[1]).toMatchObject({ round: 2, winner: 1, pitCounts: [5, 7] });
    expect(two.round).toBe(3);
  });

  it("ends the match when a player holds enough pits", () => {
    const after = recordRound(match, { scores: [40, 8], winner: 0, endReason: "starved" });
    expect(after.pitCounts).toEqual([10, 2]);
    expect(after.over).toBe(true);
    expect(after.winner).toBe(0);
    expect(after.endReason).toBe("conquest");
  });

  it("ends the match when a player is left with no pit at all", () => {
    // Two seeds buy no pit, and the spare pit goes to North on the even
    // leftover, so South is wiped out.
    const after = recordRound(match, { scores: [2, 46], winner: 1, endReason: "starved" });
    expect(after.pitCounts).toEqual([0, 12]);
    expect(after.over).toBe(true);
    expect(after.winner).toBe(1);
    expect(after.endReason).toBe("wipeout");
  });

  it("can be played as a single round instead", () => {
    const single = createMatch({ mode: "baawa", conquest: false });
    const after = recordRound(single, { scores: [26, 22], winner: 0, endReason: "starved" });
    expect(after.over).toBe(true);
    expect(after.winner).toBe(0);
    expect(after.endReason).toBe("round");
  });

  it("breaks an even leftover in favour of the player who moved second", () => {
    // South started round 1, so North gets the benefit of the doubt.
    const after = recordRound(match, { scores: [26, 22], winner: 0, endReason: "starved" });
    expect(after.pitCounts).toEqual([6, 6]);
  });

  it("never changes the match it was given", () => {
    const before = JSON.stringify(match);
    recordRound(match, { scores: [28, 20], winner: 0, endReason: "starved" });
    expect(JSON.stringify(match)).toBe(before);
  });
});
