import { describe, expect, test } from "bun:test";
import { MOST_SKELETONS, SKELETON_FALLBACK, skeletonColumnCounts, skeletonCount } from "./skeletons.js";

describe("skeletonCount", () => {
  // The point of remembering the last count is that the placeholder is the
  // shape and the size of what arrives, so the page does not jump when it does.
  test("uses what was there last time", () => {
    expect(skeletonCount(7)).toBe(7);
    expect(skeletonCount(1)).toBe(1);
  });

  test("guesses when nothing is remembered", () => {
    expect(skeletonCount(null)).toBe(SKELETON_FALLBACK);
    expect(skeletonCount(undefined)).toBe(SKELETON_FALLBACK);
    expect(skeletonCount("lots")).toBe(SKELETON_FALLBACK);
  });

  // A reader with a hundred items does not need a hundred grey boxes to know
  // the page is working, and drawing them costs more than it says.
  test("never draws more than a screenful", () => {
    expect(skeletonCount(500)).toBe(MOST_SKELETONS);
  });

  // Zero is a real memory: last time there was nothing. Showing no placeholder
  // at all would look like the page had finished and found nothing, so the
  // page still shows one.
  test("shows one placeholder when last time held nothing", () => {
    expect(skeletonCount(0)).toBe(1);
    expect(skeletonCount(-4)).toBe(1);
  });
});

describe("skeletonColumnCounts", () => {
  // Equal columns read as a grid of grey, not as a board. A real board is
  // uneven, so the placeholder is uneven too.
  test("spreads the cards unevenly across the columns", () => {
    expect(skeletonColumnCounts(12, 6)).toEqual([3, 2, 1, 2, 4, 2]);
  });

  test("keeps about the number that was there last time", () => {
    const total = skeletonColumnCounts(12, 6).reduce((sum, count) => sum + count, 0);
    expect(total).toBeGreaterThanOrEqual(12);
    expect(total).toBeLessThanOrEqual(14);
  });

  // An empty column looks like a finished column with nothing in it.
  test("gives every column at least one card", () => {
    expect(skeletonColumnCounts(1, 6).every((count) => count >= 1)).toBe(true);
  });

  test("follows the order of the columns that are shown", () => {
    expect(skeletonColumnCounts(9, 3)).toEqual([5, 3, 2]);
    expect(skeletonColumnCounts(9, 0)).toEqual([]);
  });

  // The cap on the whole board holds here too: a busy board does not turn
  // into a wall of grey boxes.
  test("draws no more than a capped board would", () => {
    expect(skeletonColumnCounts(500, 6)).toEqual(skeletonColumnCounts(MOST_SKELETONS, 6));
  });
});
