import { describe, expect, test } from "bun:test";
import { CHANGE_TYPES, readTitle } from "./titles.js";

describe("CHANGE_TYPES", () => {
  test("every type has something to draw and something to say", () => {
    for (const type of CHANGE_TYPES) {
      expect(type.id.length).toBeGreaterThan(0);
      expect(type.label.length).toBeGreaterThan(0);
      expect(type.paths.length).toBeGreaterThan(0);
    }
  });

  // The id is what a reader sees written in front of them in the title, so it
  // has to be the word the convention uses and not a tidier one.
  test("the ids are the words conventional commits uses", () => {
    expect(CHANGE_TYPES.map((one) => one.id)).toEqual([
      "feat",
      "fix",
      "docs",
      "refactor",
      "test",
      "perf",
      "style",
      "build",
      "ci",
      "chore",
      "revert",
    ]);
  });

  test("no alias belongs to two types", () => {
    const seen = new Set();
    for (const type of CHANGE_TYPES) {
      for (const alias of [type.id, ...type.aliases]) {
        expect(seen.has(alias)).toBe(false);
        seen.add(alias);
      }
    }
  });
});

describe("readTitle", () => {
  test("splits the change it announces from what it says", () => {
    const read = readTitle("feat(api): upload a dataset with a conversation history column");
    expect(read.type.id).toBe("feat");
    expect(read.scope).toBe("api");
    expect(read.description).toBe("upload a dataset with a conversation history column");
    expect(read.breaking).toBe(false);
  });

  test("a type with no scope", () => {
    const read = readTitle("fix: the board forgets the note on reload");
    expect(read.type.id).toBe("fix");
    expect(read.scope).toBe("");
    expect(read.description).toBe("the board forgets the note on reload");
  });

  test("the exclamation mark that means a breaking change", () => {
    expect(readTitle("feat(api)!: drop the old endpoint").breaking).toBe(true);
    expect(readTitle("feat!: drop it").breaking).toBe(true);
    expect(readTitle("feat!: drop it").type.id).toBe("feat");
  });

  // Issues are not written by the same rules as commits. "Bug:" and
  // "Feature:" are what people actually type, and they mean the same thing.
  test("the words people type instead", () => {
    expect(readTitle("Bug: the note disappears").type.id).toBe("fix");
    expect(readTitle("feature(board): a dark theme").type.id).toBe("feat");
    expect(readTitle("BUGFIX: the note disappears").type.id).toBe("fix");
  });

  test("the type is read whatever case it is written in", () => {
    expect(readTitle("Fix(API): something").type.id).toBe("fix");
    expect(readTitle("Fix(API): something").scope).toBe("API");
  });

  // The whole point is to take noise off the card. A word that is not a type
  // is not noise, it is the title, and cutting it would lose it.
  test("a word it does not know is left in the title", () => {
    const read = readTitle("Note: the rate limit is 5000 an hour");
    expect(read.type).toBe(null);
    expect(read.description).toBe("Note: the rate limit is 5000 an hour");
  });

  test("a title with no colon at all is left alone", () => {
    const read = readTitle("The board forgets the note on reload");
    expect(read.type).toBe(null);
    expect(read.scope).toBe("");
    expect(read.description).toBe("The board forgets the note on reload");
  });

  // A colon far into a sentence is punctuation, not a prefix.
  test("a colon in the middle of a sentence is not a prefix", () => {
    const read = readTitle("Make it clear: the token never leaves the browser");
    expect(read.type).toBe(null);
    expect(read.description).toBe("Make it clear: the token never leaves the browser");
  });

  test("a prefix with nothing after it keeps the whole title", () => {
    expect(readTitle("fix:").description).toBe("fix:");
    expect(readTitle("fix:").type).toBe(null);
  });

  test("never throws, whatever it is handed", () => {
    expect(readTitle(null).description).toBe("");
    expect(readTitle(7).description).toBe("");
    expect(readTitle(undefined).type).toBe(null);
  });
});
