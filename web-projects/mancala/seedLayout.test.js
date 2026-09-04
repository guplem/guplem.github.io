import { describe, it, expect } from "bun:test";
import { MAX_DOTS, spotsIn, landingSpot } from "./seedLayout.js";
import { PIT_COUNT } from "./board.js";

describe("the places seeds rest in a pit", () => {
  it("gives every pit the same twelve places every time", () => {
    for (let pit = 0; pit < PIT_COUNT; pit += 1) {
      expect(spotsIn(pit)).toHaveLength(MAX_DOTS);
      expect(spotsIn(pit)).toEqual(spotsIn(pit));
    }
  });

  it("keeps every place inside the bowl and clear of the count", () => {
    for (let pit = 0; pit < PIT_COUNT; pit += 1) {
      for (const spot of spotsIn(pit)) {
        expect(spot.x).toBeGreaterThan(20);
        expect(spot.x).toBeLessThan(80);
        expect(spot.y).toBeGreaterThan(15);
        // The count pill sits along the bottom of the bowl, so no seed goes
        // below the middle of the lower half.
        expect(spot.y).toBeLessThan(70);
      }
    }
  });

  it("spreads the places out instead of stacking them", () => {
    for (let pit = 0; pit < PIT_COUNT; pit += 1) {
      const spots = spotsIn(pit);
      for (let one = 0; one < spots.length; one += 1) {
        for (let two = one + 1; two < spots.length; two += 1) {
          const apart = Math.hypot(spots[one].x - spots[two].x, spots[one].y - spots[two].y);
          expect(apart).toBeGreaterThan(6);
        }
      }
    }
  });

  it("gives two pits different patterns", () => {
    expect(spotsIn(0)).not.toEqual(spotsIn(1));
  });
});

describe("the place a landing seed takes", () => {
  it("is the next free place in the pit", () => {
    // The screen paints seed number n at place n - 1, so a flying seed must
    // aim at that place. Aiming at the middle of the pit is what made a seed
    // jump when it landed.
    for (let pit = 0; pit < PIT_COUNT; pit += 1) {
      for (let seeds = 1; seeds <= MAX_DOTS; seeds += 1) {
        expect(landingSpot(pit, seeds)).toEqual(spotsIn(pit)[seeds - 1]);
      }
    }
  });

  it("has no place for a seed the pit does not draw", () => {
    // Past MAX_DOTS the pit shows a number instead of dots, so there is no
    // place to aim at and the caller falls back to the middle of the pit.
    expect(landingSpot(3, MAX_DOTS + 1)).toBeNull();
    expect(landingSpot(3, 40)).toBeNull();
    expect(landingSpot(3, 0)).toBeNull();
  });

  it("has no place for a pit that is not on the board", () => {
    expect(landingSpot(-1, 1)).toBeNull();
    expect(landingSpot(PIT_COUNT, 1)).toBeNull();
  });
});
