import { describe, expect, test } from "bun:test";
import {
  MESSAGES,
  escapeHtml,
  joinWithAnd,
  noteMenuLabel,
  say,
  sayEmptyBoard,
  summariseChecks,
} from "./messages.js";

describe("summariseChecks", () => {
  const ok = (label) => ({ label, ok: true, detail: "fine" });
  const bad = (label) => ({ label, ok: false, detail: "not fine" });

  // The line on the folded row. It has to answer "do I need to open this?"
  // on its own, because a reader who has to unfold every token to find the
  // broken one is not being helped by the folding.
  test("says everything passed when everything did", () => {
    expect(summariseChecks([ok("Sign in"), ok("Work"), ok("Notes")])).toBe("All 3 checks passed");
  });

  test("names the one that failed, because one is the common case", () => {
    expect(summariseChecks([ok("Sign in"), ok("Work"), bad("Notes")])).toBe("Notes did not pass");
  });

  test("counts them when more than one failed", () => {
    expect(summariseChecks([ok("Sign in"), bad("Work"), bad("Notes")])).toBe("2 of 3 checks did not pass");
  });

  test("says so when there is nothing to show", () => {
    expect(summariseChecks([])).toBe("Not connected yet");
    expect(summariseChecks(null)).toBe("Not connected yet");
  });

  test("never throws, whatever it is handed", () => {
    expect(typeof summariseChecks([null, 7, { ok: true }])).toBe("string");
  });
});

describe("noteMenuLabel", () => {
  test("offers to add the first note, and to edit one that is there", () => {
    expect(noteMenuLabel("")).toBe("Add note");
    expect(noteMenuLabel("   ")).toBe("Add note");
    expect(noteMenuLabel("look at the rate limit")).toBe("Edit note");
  });

  test("never throws, whatever it is handed", () => {
    expect(noteMenuLabel(null)).toBe("Add note");
    expect(noteMenuLabel(7)).toBe("Add note");
  });
});

describe("joinWithAnd", () => {
  test("reads a list the way a person says it", () => {
    expect(joinWithAnd(["guplem"])).toBe("guplem");
    expect(joinWithAnd(["guplem", "Galtea-AI"])).toBe("guplem and Galtea-AI");
    expect(joinWithAnd(["a", "b", "c"])).toBe("a, b and c");
  });

  test("answers with nothing for nothing", () => {
    expect(joinWithAnd([])).toBe("");
    expect(joinWithAnd(null)).toBe("");
    expect(joinWithAnd(["", null, "a"])).toBe("a");
  });
});

describe("sayEmptyBoard", () => {
  // "Nothing is assigned to you" is a lie when the truth is "your token cannot
  // see the organisation your work lives in". The sentence has to say how far
  // the board can actually see.
  test("says how many tokens are in use and what they reach", () => {
    const sentence = sayEmptyBoard({ tokenCount: 2, owners: ["guplem", "Galtea-AI"] });
    expect(sentence).toContain("2 tokens");
    expect(sentence).toContain("guplem and Galtea-AI");
  });

  test("counts one token in the singular", () => {
    expect(sayEmptyBoard({ tokenCount: 1, owners: ["guplem"] })).toContain("1 token,");
  });

  test("says plainly when the tokens reached nowhere at all", () => {
    expect(sayEmptyBoard({ tokenCount: 1, owners: [] })).toContain("no repository");
  });

  test("never throws, whatever it is handed", () => {
    expect(typeof sayEmptyBoard()).toBe("string");
    expect(sayEmptyBoard({ tokenCount: 0 })).toContain("No token");
  });
});

describe("say", () => {
  test("puts the parameters into the sentence", () => {
    expect(say("ui.deployed", { date: "17 September 2026", pr: "#120" })).toBe(
      "Deployed 17 September 2026 by pull request #120.",
    );
  });

  test("answers with the key when the message is missing, so nothing goes blank", () => {
    expect(say("ui.notAMessage")).toBe("ui.notAMessage");
  });

  test("leaves a placeholder alone when its value was not given", () => {
    expect(say("ui.deployed", { date: "today" })).toContain("{pr}");
  });

  test("every message the deploy line needs exists", () => {
    for (const key of ["ui.deployed", "ui.deployedUnknown", "ui.deployHistory"]) {
      expect(typeof MESSAGES[key]).toBe("string");
    }
  });
});

describe("escapeHtml", () => {
  // The page shows issue titles and note text that came from other people.
  // This is the only thing standing between that text and the token in storage.
  test("neutralises every character that can open a tag or an attribute", () => {
    expect(escapeHtml('<img src=x onerror="steal()">')).toBe(
      "&lt;img src=x onerror=&quot;steal()&quot;&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  test("escapes the ampersand first, so an escape is not double-read", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  test("answers with an empty string for anything that is not text", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(7)).toBe("7");
  });
});
