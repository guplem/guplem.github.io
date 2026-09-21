import { describe, expect, test } from "bun:test";
import { MASK, describeTokenReach, maskToken, suggestedTokenName } from "./tokenIdentity.js";

describe("maskToken", () => {
  // Enough to tell two tokens apart against GitHub's own list, and obviously a
  // secret with most of it removed, so it needs no word to explain it.
  test("shows the last four characters behind a mask", () => {
    expect(maskToken("github_pat_11ABCDEFaohu")).toBe(`${MASK}aohu`);
  });

  test("never shows a short token in full", () => {
    expect(maskToken("abc")).toBe(MASK);
    expect(maskToken("abcd")).toBe(MASK);
    expect(maskToken("abcde")).toBe(`${MASK}bcde`);
  });

  test("answers with nothing when there is no token", () => {
    expect(maskToken("")).toBe("");
    expect(maskToken(null)).toBe("");
    expect(maskToken(7)).toBe("");
  });
});

describe("suggestedTokenName", () => {
  // A name the reader can change, but never an empty row. The suggestion comes
  // from where this token actually found work, which is the useful fact.
  test("suggests the owners the token found work in", () => {
    expect(suggestedTokenName({ owners: ["Galtea-AI"] }, 1)).toBe("Galtea-AI");
    expect(suggestedTokenName({ owners: ["guplem", "Galtea-AI"] }, 0)).toBe("guplem, Galtea-AI");
  });

  test("falls back to its place in the list when it found nothing", () => {
    expect(suggestedTokenName({ owners: [] }, 0)).toBe("Token 1");
    expect(suggestedTokenName({}, 2)).toBe("Token 3");
    expect(suggestedTokenName(null, 0)).toBe("Token 1");
  });
});

describe("describeTokenReach", () => {
  test("says what it found and what it does", () => {
    expect(describeTokenReach({ token: "github_pat_aohu", itemCount: 18, canWriteBoard: true })).toBe(
      `${MASK}aohu · 18 items · reads your work and saves your board`,
    );
  });

  test("counts one item in the singular", () => {
    expect(describeTokenReach({ token: "xxxxaohu", itemCount: 1 })).toContain("1 item ·");
  });

  // An empty token is not broken. It may simply be the one that holds the notes
  // repository, so the sentence has to read as a fact and not as a fault.
  test("says plainly when it found nothing", () => {
    const sentence = describeTokenReach({ token: "xxxxaohu", itemCount: 0, canWriteBoard: true });
    expect(sentence).toContain("no work found");
    expect(sentence).toContain("saves your board");
  });

  test("never throws, whatever it is handed", () => {
    expect(typeof describeTokenReach()).toBe("string");
    expect(typeof describeTokenReach({})).toBe("string");
  });
});
