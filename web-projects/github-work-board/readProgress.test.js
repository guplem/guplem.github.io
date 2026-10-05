import { describe, expect, test } from "bun:test";
import {
  READ_DRAWING,
  READ_PROGRESS_CEILING,
  READ_PROGRESS_FLOOR,
  READ_STEPS,
  readProgress,
  readingNow,
  stepsDone,
} from "./readProgress.js";

describe("which step a read waits on, for the refresh button's tooltip (ADR 0039, ADR 0040)", () => {
  // Every token reads at the same time, so "the step" is the earliest one that
  // some token has not finished, and the tokens still on it are the ones named.
  test("a read that has just started waits on who every token belongs to", () => {
    expect(readingNow([[], []])).toEqual({ step: READ_STEPS[0], waiting: [0, 1] });
  });

  test("a token that is ahead is not named", () => {
    expect(readingNow([READ_STEPS.slice(0, 4), ["identity"]])).toEqual({ step: "open-work", waiting: [1] });
  });

  // The first four calls of one token go together and answer in any order, so
  // a later call can be done before an earlier one.
  test("calls that answered out of order still leave the earliest open step", () => {
    expect(readingNow([["reviews", "identity", "finished-work"]])).toEqual({ step: "open-work", waiting: [0] });
  });

  // Every call answered is not the board on the screen: the merge and the
  // render still come, and they get a step of their own.
  test("after the last call of every token, the board is drawing", () => {
    expect(readingNow([[...READ_STEPS], [...READ_STEPS]])).toEqual({ step: READ_DRAWING, waiting: [] });
  });

  test("odd input stays on a real step", () => {
    expect(readingNow([])).toEqual({ step: READ_STEPS[0], waiting: [] });
    expect(readingNow(null)).toEqual({ step: READ_STEPS[0], waiting: [] });
    expect(readingNow([null])).toEqual({ step: READ_STEPS[0], waiting: [0] });
  });
});

describe("how many steps a read has done, over every token (ADR 0040)", () => {
  test("each step counts once per token, whatever order it ended in", () => {
    expect(stepsDone([["reviews", "identity"], ["identity"]])).toBe(3);
  });

  // A step reported twice, or a name nobody knows, must not push the bar on.
  test("a repeated or unknown step does not count", () => {
    expect(stepsDone([["identity", "identity", "nonsense"]])).toBe(1);
  });

  test("odd input counts nothing", () => {
    expect(stepsDone(null)).toBe(0);
    expect(stepsDone([null])).toBe(0);
  });
});

describe("the top bar says how far a read has gone (ADR 0039)", () => {
  // One entry for each call `inspectToken` waits on, in the order it waits.
  test("these are the steps of one token's read, in order", () => {
    expect(READ_STEPS).toEqual(["identity", "open-work", "finished-work", "reviews", "relationships", "checks"]);
  });

  // A bar with nothing in it reads as a page that has not started.
  test("a read that has just started is never empty", () => {
    expect(readProgress(0, 1)).toBe(READ_PROGRESS_FLOOR);
    expect(READ_PROGRESS_FLOOR).toBeGreaterThan(0);
  });

  test("the bar only goes forward, one step at a time", () => {
    const total = READ_STEPS.length * 2;
    const filled = Array.from({ length: total + 1 }, (_, done) => readProgress(done, 2));
    expect(filled).toEqual([...filled].sort((a, b) => a - b));
    expect(new Set(filled).size).toBe(filled.length);
  });

  // Every call answered is not the board drawn: the merge and the render still
  // come. Only the finish fills the bar, so a full bar always means a drawn board.
  test("every step done still stops short of full", () => {
    expect(readProgress(READ_STEPS.length, 1)).toBe(READ_PROGRESS_CEILING);
    expect(READ_PROGRESS_CEILING).toBeLessThan(100);
  });

  test("with two tokens, the first token done is about half way", () => {
    const half = readProgress(READ_STEPS.length, 2);
    expect(half).toBeGreaterThan(40);
    expect(half).toBeLessThan(60);
  });

  // A count that runs past the end, or a board with no token, must not break the bar.
  test("odd counts stay inside the bar", () => {
    expect(readProgress(99, 1)).toBe(READ_PROGRESS_CEILING);
    expect(readProgress(-3, 1)).toBe(READ_PROGRESS_FLOOR);
    expect(readProgress(2, 0)).toBe(READ_PROGRESS_FLOOR);
    expect(readProgress(Number.NaN, 1)).toBe(READ_PROGRESS_FLOOR);
  });
});
