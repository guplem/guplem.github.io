import { describe, expect, test } from "bun:test";
import { CARD_PARTS, cardPartLabel, isCardPart } from "./cardParts.js";

describe("the parts of a card the reader can hide", () => {
  // An id is written into `board.json` the moment the reader flips a switch,
  // so it is as permanent as a storage key. A rename would show a part again
  // on every board that hid it (ADR 0047).
  test("the ids never change", () => {
    expect(CARD_PARTS.map((part) => part.id)).toEqual([
      "labels",
      "milestone",
      "fields",
      "people",
      "links",
      "children",
    ]);
  });

  test("every part has words for its switch", () => {
    for (const part of CARD_PARTS) {
      expect(typeof part.label).toBe("string");
      expect(part.label.length).toBeGreaterThan(0);
      expect(typeof part.says).toBe("string");
      expect(part.says.length).toBeGreaterThan(0);
    }
  });

  test("knows its own parts, and nothing else", () => {
    expect(isCardPart("labels")).toBe(true);
    expect(isCardPart("fields")).toBe(true);
    expect(isCardPart("title")).toBe(false);
    expect(isCardPart(undefined)).toBe(false);
  });

  test("names a part, or nothing for an id it does not know", () => {
    expect(cardPartLabel("milestone")).toBe("Milestone");
    expect(cardPartLabel("nope")).toBe("");
  });
});
