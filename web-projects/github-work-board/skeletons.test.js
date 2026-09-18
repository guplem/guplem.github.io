import { describe, expect, test } from "bun:test";
import { MOST_SKELETONS, SKELETON_FALLBACK, skeletonCount } from "./skeletons.js";

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
