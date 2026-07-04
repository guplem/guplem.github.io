import { describe, it, expect } from "bun:test";
import {
  capitalizeFirstLetter,
  allToLower,
  turnTextArrayIntoDistinctPragraphs,
  idFromText,
  allToId,
  workMatchesText,
} from "./textCore.js";

// Characterization tests: they pin the CURRENT behavior of these pure helpers,
// including its quirks (e.g. idFromText("C#") -> "C"). Do not "fix" the code to
// make a nicer assertion -- element IDs and filter matching depend on this exact
// output across the site.

describe("idFromText", () => {
  it("capitalizes each word and strips spaces", () => {
    expect(idFromText("mobile app")).toBe("MobileApp");
  });

  it("strips punctuation", () => {
    expect(idFromText("Drink & Play!")).toBe("DrinkPlay");
  });

  it("strips apostrophes including the typographic one", () => {
    const result = idFromText("What's next’s");
    expect(result).not.toContain("'");
    expect(result).not.toContain("’");
  });

  it("removes non-ASCII-word characters (documenting real behavior)", () => {
    expect(idFromText("C#")).toBe("C");
  });

  it("throws on empty string", () => {
    expect(() => idFromText("")).toThrow();
  });

  it("throws on null", () => {
    expect(() => idFromText(null)).toThrow();
  });

  it("throws on undefined", () => {
    expect(() => idFromText(undefined)).toThrow();
  });

  it("throws on non-string input", () => {
    expect(() => idFromText(123)).toThrow();
  });
});

describe("workMatchesText", () => {
  const work = {
    title: "Mobile App",
    description: ["A fun little game built for phones."],
    skills: ["Unity", "C#"],
  };

  it("matches everything on an empty query", () => {
    expect(workMatchesText(work, "")).toBe(true);
  });

  it("matches everything on a whitespace-only query", () => {
    expect(workMatchesText(work, "   ")).toBe(true);
  });

  it("matches everything on an undefined query", () => {
    expect(workMatchesText(work, undefined)).toBe(true);
  });

  it("matches a token in the title (case-insensitive)", () => {
    expect(workMatchesText(work, "MOBILE")).toBe(true);
  });

  it("matches a token in a description paragraph", () => {
    expect(workMatchesText(work, "game")).toBe(true);
  });

  it("matches a token in a skill", () => {
    expect(workMatchesText(work, "unity")).toBe(true);
  });

  it("requires all tokens to appear (AND semantics)", () => {
    expect(workMatchesText(work, "mobile game")).toBe(true);
  });

  it("returns false when one token is missing", () => {
    expect(workMatchesText(work, "mobile missing")).toBe(false);
  });

  it("matches tokens across different fields", () => {
    expect(workMatchesText(work, "mobile unity")).toBe(true);
  });

  it("does not throw and can still match on title when description/skills are missing", () => {
    const bareWork = { title: "Mobile App" };
    expect(workMatchesText(bareWork, "mobile")).toBe(true);
    expect(workMatchesText(bareWork, "unity")).toBe(false);
  });
});

describe("capitalizeFirstLetter", () => {
  it("lowers the rest by default", () => {
    expect(capitalizeFirstLetter("hELLO")).toBe("Hello");
  });

  it("preserves the rest when lowerRest is false", () => {
    expect(capitalizeFirstLetter("hELLO", false)).toBe("HELLO");
  });

  it("capitalizes each word when firstLetterOfEveryWord is true", () => {
    expect(capitalizeFirstLetter("hello world", true, true)).toBe("Hello World");
  });

  it("throws on empty string", () => {
    expect(() => capitalizeFirstLetter("")).toThrow();
  });

  it("throws on non-string input", () => {
    expect(() => capitalizeFirstLetter(123)).toThrow();
  });
});

describe("allToId", () => {
  it("maps idFromText over an array", () => {
    expect(allToId(["mobile app", "Drink & Play!"])).toEqual(["MobileApp", "DrinkPlay"]);
  });

  it("throws on non-array input", () => {
    expect(() => allToId("not an array")).toThrow();
  });
});

describe("allToLower", () => {
  it("lowercases every element", () => {
    expect(allToLower(["Unity", "C#"])).toEqual(["unity", "c#"]);
  });

  it("throws on non-array input", () => {
    expect(() => allToLower("not an array")).toThrow();
  });
});

describe("turnTextArrayIntoDistinctPragraphs", () => {
  it("joins an array with blank lines between paragraphs", () => {
    expect(turnTextArrayIntoDistinctPragraphs(["one", "two"])).toBe("one\n\ntwo");
  });

  it("passes a plain string through unchanged", () => {
    expect(turnTextArrayIntoDistinctPragraphs("just a string")).toBe("just a string");
  });
});
