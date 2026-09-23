import { describe, expect, test } from "bun:test";
import {
  MESSAGES,
  escapeHtml,
  joinWithAnd,
  describeLastRefresh,
  noteMenuLabel,
  priorityMenuLabel,
  say,
  sayEmptyBoard,
  summariseChecks,
  BOOT_STEPS,
  bootStepProgress,
  bootStepWords,
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

describe("priorityMenuLabel", () => {
  // Each one names what the row does, not what the card is, because a menu row
  // is a thing the reader presses.
  test("offers to push a card down, and to bring it back", () => {
    expect(priorityMenuLabel("normal")).toBe("Not a priority");
    expect(priorityMenuLabel("low")).toBe("Make it a priority");
  });

  test("anything it does not know offers the mark", () => {
    expect(priorityMenuLabel("")).toBe("Not a priority");
    expect(priorityMenuLabel(null)).toBe("Not a priority");
  });
});

describe("describeLastRefresh", () => {
  const at = (ms) => 1_000_000 + ms;
  const now = at(0);

  // The button says when the board last heard from GitHub, so the reader can
  // tell a quiet morning from a board that stopped asking (ADR 0029).
  test("says how long ago in the largest whole unit", () => {
    expect(describeLastRefresh(at(-3_000), now)).toBe("Refreshed just now");
    expect(describeLastRefresh(at(-34_000), now)).toBe("Refreshed 34 seconds ago");
    expect(describeLastRefresh(at(-60_000), now)).toBe("Refreshed 1 minute ago");
    expect(describeLastRefresh(at(-5 * 60_000), now)).toBe("Refreshed 5 minutes ago");
    expect(describeLastRefresh(at(-60 * 60_000), now)).toBe("Refreshed 1 hour ago");
    expect(describeLastRefresh(at(-3 * 60 * 60_000), now)).toBe("Refreshed 3 hours ago");
    expect(describeLastRefresh(at(-26 * 60 * 60_000), now)).toBe("Refreshed 1 day ago");
  });

  // "1 seconds ago" reads as a machine wrote it.
  test("one of anything is not plural", () => {
    expect(describeLastRefresh(at(-1 * 60_000), now)).toBe("Refreshed 1 minute ago");
    expect(describeLastRefresh(at(-2 * 60_000), now)).toBe("Refreshed 2 minutes ago");
  });

  // Under ten seconds, a number is noise: the reader pressed it a moment ago
  // and knows that.
  test("the first few seconds are just now", () => {
    expect(describeLastRefresh(at(-1), now)).toBe("Refreshed just now");
    expect(describeLastRefresh(at(-9_000), now)).toBe("Refreshed just now");
    expect(describeLastRefresh(at(-10_000), now)).toBe("Refreshed 10 seconds ago");
  });

  test("a board that has not read yet says so", () => {
    expect(describeLastRefresh(null, now)).toBe("Not refreshed yet");
    expect(describeLastRefresh(undefined, now)).toBe("Not refreshed yet");
    expect(describeLastRefresh("soon", now)).toBe("Not refreshed yet");
  });

  // A machine whose clock moved backwards must not say "refreshed in 4 hours".
  test("a clock that went backwards reads as just now", () => {
    expect(describeLastRefresh(at(5_000), now)).toBe("Refreshed just now");
  });
});

describe("the start-up screen says what it is doing (ADR 0036)", () => {
  // The page paints before it runs a line of its own code, so the first step is
  // written in `index.html` and the rest are set from here. The words live in
  // one place all the same.
  test("these are the steps, in the order they happen", () => {
    expect(BOOT_STEPS.map((one) => one.id)).toEqual(["code", "saved", "board"]);
    for (const step of BOOT_STEPS) expect(step.words.length).toBeGreaterThan(0);
  });

  test("each step says what is happening, and never nothing", () => {
    expect(bootStepWords("code")).toBe(BOOT_STEPS[0].words);
    expect(bootStepWords("board")).toBe(BOOT_STEPS[2].words);
    // A step nobody knows must not leave the line blank: a blank line and a
    // broken feature look the same.
    expect(bootStepWords("nonsense")).toBe(BOOT_STEPS[0].words);
  });

  // The bar only ever goes forward, and it is never empty: a bar at zero reads
  // as a page that has not started.
  test("the bar fills step by step, and ends full", () => {
    const filled = BOOT_STEPS.map((one) => bootStepProgress(one.id));
    expect(filled[0]).toBeGreaterThan(0);
    expect(filled).toEqual([...filled].sort((a, b) => a - b));
    expect(filled.at(-1)).toBe(100);
    expect(bootStepProgress("nonsense")).toBe(filled[0]);
  });
});

describe("summariseChecks with a check nothing could prove", () => {
  const ok = { label: "One", ok: true };
  const bad = { label: "Two", ok: false };
  // A check the board had nothing to run against is not a pass and not a
  // failure: the reader has no pull request with checks on it yet, so the board
  // cannot honestly say either (ADR 0005).
  const unknown = { label: "Three", ok: null };

  test("a check nothing proved is counted apart from the passes", () => {
    expect(summariseChecks([ok, ok, unknown])).toBe("2 checks passed, 1 not checked yet");
  });

  test("one failure is still named, whatever else is unknown", () => {
    expect(summariseChecks([ok, bad, unknown])).toBe("Two did not pass");
  });

  test("all passed still reads as all passed", () => {
    expect(summariseChecks([ok, ok])).toBe("All 2 checks passed");
  });

  test("nothing checked at all says so", () => {
    expect(summariseChecks([unknown, unknown])).toBe("2 checks not checked yet");
  });
});
