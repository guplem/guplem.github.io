import { describe, expect, test } from "bun:test";
import {
  READ_DRAWING,
  READ_PROGRESS_CEILING,
  READ_PROGRESS_FLOOR,
  READ_STEPS,
  readProgress,
  readingNow,
} from "./readProgress.js";

describe("which step a read is on, for the refresh button's tooltip (ADR 0039)", () => {
  // `stepsDone` counts the steps that ended, so the one running is the next.
  test("a read that has just started is asking who the first token belongs to", () => {
    expect(readingNow(0, 2)).toEqual({ step: READ_STEPS[0], tokenIndex: 0 });
  });

  test("the steps run token by token", () => {
    expect(readingNow(1, 2)).toEqual({ step: READ_STEPS[1], tokenIndex: 0 });
    expect(readingNow(READ_STEPS.length, 2)).toEqual({ step: READ_STEPS[0], tokenIndex: 1 });
    expect(readingNow(READ_STEPS.length * 2 - 1, 2)).toEqual({ step: READ_STEPS.at(-1), tokenIndex: 1 });
  });

  // Every call answered is not the board on the screen: the merge and the
  // render still come, and they get a step of their own.
  test("after the last call, the board is drawing", () => {
    expect(readingNow(READ_STEPS.length, 1)).toEqual({ step: READ_DRAWING, tokenIndex: 0 });
    expect(readingNow(99, 2)).toEqual({ step: READ_DRAWING, tokenIndex: 1 });
  });

  test("odd counts stay on a real step", () => {
    expect(readingNow(-3, 1)).toEqual({ step: READ_STEPS[0], tokenIndex: 0 });
    expect(readingNow(Number.NaN, 1)).toEqual({ step: READ_STEPS[0], tokenIndex: 0 });
    expect(readingNow(0, 0)).toEqual({ step: READ_STEPS[0], tokenIndex: 0 });
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
