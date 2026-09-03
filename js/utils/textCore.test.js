import { describe, it, expect } from "bun:test";
import {
  capitalizeFirstLetter,
  allToLower,
  turnTextArrayIntoDistinctPragraphs,
  idFromText,
  allToId,
  workMatchesText,
  workMatchesTagFilters,
  nextTagFilterState,
  markdownToPlainText,
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

describe("nextTagFilterState", () => {
  it("turns an unused filter into must-include", () => {
    expect(nextTagFilterState("none")).toBe("include");
  });

  it("turns must-include into must-exclude", () => {
    expect(nextTagFilterState("include")).toBe("exclude");
  });

  it("turns must-exclude back into unused", () => {
    expect(nextTagFilterState("exclude")).toBe("none");
  });

  it("treats an unknown state as unused", () => {
    expect(nextTagFilterState(undefined)).toBe("include");
  });
});

describe("workMatchesTagFilters", () => {
  const work = {
    types: ["Web"],
    skills: ["Vibe Coded", "Architecture"],
  };

  it("matches every work when no filter is set", () => {
    expect(workMatchesTagFilters(work, {})).toBe(true);
  });

  it("matches a work that carries one of the included skills", () => {
    expect(workMatchesTagFilters(work, { includedSkills: ["Architecture"] })).toBe(true);
  });

  it("rejects a work that carries none of the included skills", () => {
    expect(workMatchesTagFilters(work, { includedSkills: ["Unity"] })).toBe(false);
  });

  it("matches a work that carries any one of several included skills (OR inside a group)", () => {
    expect(workMatchesTagFilters(work, { includedSkills: ["Unity", "Architecture"] })).toBe(true);
  });

  it("requires the type group and the skill group to both pass (AND between groups)", () => {
    expect(workMatchesTagFilters(work, { includedTypes: ["Web"], includedSkills: ["Architecture"] })).toBe(true);
    expect(workMatchesTagFilters(work, { includedTypes: ["Videogame"], includedSkills: ["Architecture"] })).toBe(false);
  });

  it("rejects a work that carries an excluded skill", () => {
    expect(workMatchesTagFilters(work, { excludedSkills: ["VibeCoded"] })).toBe(false);
  });

  it("rejects a work that carries an excluded type", () => {
    expect(workMatchesTagFilters(work, { excludedTypes: ["Web"] })).toBe(false);
  });

  it("matches a work that carries none of the excluded skills", () => {
    expect(workMatchesTagFilters(work, { excludedSkills: ["Unity"] })).toBe(true);
  });

  it("lets an exclusion win over an inclusion", () => {
    expect(workMatchesTagFilters(work, { includedSkills: ["Architecture"], excludedSkills: ["VibeCoded"] })).toBe(false);
  });

  it("normalizes the work's tags the same way as the filter ids", () => {
    expect(workMatchesTagFilters({ skills: ["Mobile app"] }, { excludedSkills: ["MobileApp"] })).toBe(false);
    expect(workMatchesTagFilters({ skills: ["Mobile app"] }, { includedSkills: ["MobileApp"] })).toBe(true);
  });

  it("keeps a work that has no skills at all when only exclusions are set", () => {
    expect(workMatchesTagFilters({ types: ["Web"] }, { excludedSkills: ["VibeCoded"] })).toBe(true);
  });

  it("rejects a work that has no skills at all when an inclusion is set", () => {
    expect(workMatchesTagFilters({ types: ["Web"] }, { includedSkills: ["VibeCoded"] })).toBe(false);
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

describe("markdownToPlainText", () => {
  it("removes bold markers", () => {
    expect(markdownToPlainText("I'm a **software engineer**")).toBe("I'm a software engineer");
  });

  it("removes italic markers", () => {
    expect(markdownToPlainText("*Bondy* is an app")).toBe("Bondy is an app");
  });

  it("reduces links to their text", () => {
    expect(markdownToPlainText("visit my [LinkedIn](https://linkedin.com/in/guplem) profile")).toBe("visit my LinkedIn profile");
  });

  it("removes heading markers at line starts", () => {
    expect(markdownToPlainText("####  Get to know me\nI enjoy learning")).toBe("Get to know me\nI enjoy learning");
  });

  it("cleans emphasis inside link text", () => {
    expect(markdownToPlainText("[**ADR 0001**](https://example.com)")).toBe("ADR 0001");
  });

  it("trims surrounding whitespace", () => {
    expect(markdownToPlainText("  plain  ")).toBe("plain");
  });

  it("passes plain text through unchanged", () => {
    expect(markdownToPlainText("no markdown here")).toBe("no markdown here");
  });

  it("throws on non-string input", () => {
    expect(() => markdownToPlainText(null)).toThrow();
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
