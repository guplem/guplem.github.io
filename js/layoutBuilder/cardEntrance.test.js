import { describe, it, expect } from "bun:test";
import { cardEntranceDelayMs, playsCardEntrance } from "./cardEntrance.js";

describe("cardEntranceDelayMs", () => {
  it("starts the first card at once", () => {
    expect(cardEntranceDelayMs(0)).toBe(0);
  });

  it("staggers the next cards by 30ms each", () => {
    expect(cardEntranceDelayMs(1)).toBe(30);
    expect(cardEntranceDelayMs(4)).toBe(120);
  });

  it("caps the stagger at 300ms, so the last of 90 cards does not wait seconds", () => {
    expect(cardEntranceDelayMs(10)).toBe(300);
    expect(cardEntranceDelayMs(89)).toBe(300);
  });
});

describe("playsCardEntrance", () => {
  it("plays the entrance on the first render of the grid", () => {
    expect(playsCardEntrance(0)).toBe(true);
  });

  it("shows the cards at once on a later render (a filter, a search or a resize)", () => {
    expect(playsCardEntrance(1)).toBe(false);
    expect(playsCardEntrance(12)).toBe(false);
  });
});
