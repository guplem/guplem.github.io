import { describe, test, expect } from "bun:test";
import {
  cumulativeSeries,
  moveDistribution,
  streaks,
  rollingWinRate,
  seriesToPoints,
} from "./analytics.js";

// Build a rounds list from a compact outcome string: w=win, l=loss, t=tie.
// Optional moves string uses r=rock, p=paper, s=scissors (defaults to rock).
const MOVE = { r: "rock", p: "paper", s: "scissors" };
function rounds(outcomes, moves = "") {
  return outcomes.split("").map((o, i) => ({
    p: MOVE[moves[i]] || "rock",
    a: "rock",
    o: o === "w" ? "win" : o === "l" ? "loss" : "tie",
    g: null,
  }));
}

describe("cumulativeSeries", () => {
  test("accumulates wins, losses and ties across rounds", () => {
    const s = cumulativeSeries(rounds("wlwt"));
    expect(s.wins).toEqual([1, 1, 2, 2]);
    expect(s.losses).toEqual([0, 1, 1, 1]);
    expect(s.ties).toEqual([0, 0, 0, 1]);
    expect(s.length).toBe(4);
  });
  test("ends at the overall totals", () => {
    const s = cumulativeSeries(rounds("wwwll"));
    expect(s.wins.at(-1)).toBe(3);
    expect(s.losses.at(-1)).toBe(2);
    expect(s.ties.at(-1)).toBe(0);
  });
  test("handles an empty history", () => {
    const s = cumulativeSeries([]);
    expect(s).toEqual({ wins: [], losses: [], ties: [], length: 0 });
  });
});

describe("moveDistribution", () => {
  test("counts each move and finds the most frequent", () => {
    const d = moveDistribution(rounds("wwww", "rrrp")); // rock x3, paper x1
    expect(d.counts).toEqual({ rock: 3, paper: 1, scissors: 0 });
    expect(d.total).toBe(4);
    expect(d.top).toBe("rock");
  });
  test("returns zeros and no top for an empty history", () => {
    expect(moveDistribution([])).toEqual({
      counts: { rock: 0, paper: 0, scissors: 0 },
      total: 0,
      top: null,
    });
  });
});

describe("streaks", () => {
  test("finds best win and worst loss runs", () => {
    const s = streaks(rounds("wwwllw"));
    expect(s.bestWin).toBe(3);
    expect(s.bestLoss).toBe(2);
    expect(s.currentWin).toBe(1);
    expect(s.currentLoss).toBe(0);
  });
  test("ties break streaks", () => {
    const s = streaks(rounds("wwtww"));
    expect(s.bestWin).toBe(2);
    expect(s.currentWin).toBe(2);
  });
  test("zeros for an empty history", () => {
    expect(streaks([])).toEqual({ bestWin: 0, bestLoss: 0, currentWin: 0, currentLoss: 0 });
  });
});

describe("rollingWinRate", () => {
  test("is the running win fraction before the window fills", () => {
    const r = rollingWinRate(rounds("wwll"), 20);
    expect(r[0]).toBeCloseTo(1); // 1/1
    expect(r[1]).toBeCloseTo(1); // 2/2
    expect(r[2]).toBeCloseTo(2 / 3); // 2/3
    expect(r[3]).toBeCloseTo(0.5); // 2/4
  });
  test("slides over a fixed window", () => {
    const r = rollingWinRate(rounds("wwww" + "llll"), 4);
    expect(r[3]).toBeCloseTo(1); // last 4 = wwww
    expect(r.at(-1)).toBeCloseTo(0); // last 4 = llll
  });
  test("all values stay within [0, 1]", () => {
    const r = rollingWinRate(rounds("wltwltwlt"), 5);
    for (const v of r) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  test("empty history yields an empty series", () => {
    expect(rollingWinRate([], 10)).toEqual([]);
  });
});

describe("seriesToPoints", () => {
  test("spreads points across the width and inverts y", () => {
    const pts = seriesToPoints([0, 5, 10], { width: 100, height: 100, maxY: 10 });
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 100 }); // value 0 -> bottom
    expect(pts[2]).toEqual({ x: 100, y: 0 }); // value max -> top
    expect(pts[1].x).toBeCloseTo(50);
    expect(pts[1].y).toBeCloseTo(50);
  });
  test("respects padding", () => {
    const pts = seriesToPoints([0, 10], { width: 120, height: 100, padding: 10, maxY: 10 });
    expect(pts[0]).toEqual({ x: 10, y: 90 });
    expect(pts[1]).toEqual({ x: 110, y: 10 });
  });
  test("a single value becomes a flat line across the box", () => {
    const pts = seriesToPoints([7], { width: 100, height: 100, maxY: 10 });
    expect(pts).toHaveLength(2);
    expect(pts[0].y).toBeCloseTo(pts[1].y);
    expect(pts[0].x).toBe(0);
    expect(pts[1].x).toBe(100);
  });
  test("empty values yield no points", () => {
    expect(seriesToPoints([], { width: 100, height: 100 })).toEqual([]);
  });
});
