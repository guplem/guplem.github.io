import { describe, test, expect } from "bun:test";
import {
  hashStringToSeed,
  mulberry32,
  generateRandomSeed,
  pickOptions,
  splitOptionsText,
  optionsToText,
  parseUrlState,
  serializeUrlState,
} from "./picker.js";

describe("hashStringToSeed", () => {
  test("returns the same number for the same input", () => {
    expect(hashStringToSeed("foo")).toBe(hashStringToSeed("foo"));
  });

  test("returns different numbers for different inputs", () => {
    expect(hashStringToSeed("foo")).not.toBe(hashStringToSeed("bar"));
  });

  test("returns a non-negative 32-bit integer", () => {
    const h = hashStringToSeed("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe("mulberry32", () => {
  test("produces deterministic sequences for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  test("produces values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test("different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});

describe("generateRandomSeed", () => {
  test("uses the injected random function", () => {
    const seed = generateRandomSeed(() => 0.5);
    expect(typeof seed).toBe("string");
    expect(seed.length).toBeGreaterThan(0);
  });

  test("produces strings of stable length", () => {
    const seed = generateRandomSeed(() => 0.123456789);
    expect(seed.length).toBe(6);
  });

  test("pads short outputs to 6 characters", () => {
    const seed = generateRandomSeed(() => 0.0000001);
    expect(seed.length).toBe(6);
  });
});

describe("pickOptions", () => {
  test("returns one of the provided options when count is 1", () => {
    const opts = ["a", "b", "c"];
    const { picks } = pickOptions({ options: opts, count: 1, seed: "test" });
    expect(picks).toHaveLength(1);
    expect(opts).toContain(picks[0]);
  });

  test("returns count picks when count is greater than 1", () => {
    const { picks } = pickOptions({ options: ["a", "b", "c"], count: 5, seed: "test" });
    expect(picks).toHaveLength(5);
  });

  test("allows repeats", () => {
    const { picks } = pickOptions({ options: ["only"], count: 3, seed: "test" });
    expect(picks).toEqual(["only", "only", "only"]);
  });

  test("produces the same picks for the same seed and options", () => {
    const a = pickOptions({ options: ["a", "b", "c", "d"], count: 3, seed: "shared" });
    const b = pickOptions({ options: ["a", "b", "c", "d"], count: 3, seed: "shared" });
    expect(a.picks).toEqual(b.picks);
  });

  test("returns the seed used", () => {
    const { seed } = pickOptions({ options: ["a"], count: 1, seed: "explicit" });
    expect(seed).toBe("explicit");
  });

  test("generates a seed when none is provided", () => {
    const { seed } = pickOptions({ options: ["a", "b"], count: 1 });
    expect(typeof seed).toBe("string");
    expect(seed.length).toBeGreaterThan(0);
  });

  test("throws when options is empty", () => {
    expect(() => pickOptions({ options: [], count: 1, seed: "x" })).toThrow();
  });

  test("throws when options is not an array", () => {
    expect(() => pickOptions({ options: null, count: 1, seed: "x" })).toThrow();
  });

  test("throws when count is invalid", () => {
    expect(() => pickOptions({ options: ["a"], count: 0, seed: "x" })).toThrow();
    expect(() => pickOptions({ options: ["a"], count: -1, seed: "x" })).toThrow();
    expect(() => pickOptions({ options: ["a"], count: 1.5, seed: "x" })).toThrow();
  });
});

describe("splitOptionsText", () => {
  test("splits by newlines, trims, drops blanks", () => {
    expect(splitOptionsText("a\nb\n  c  \n\nd")).toEqual(["a", "b", "c", "d"]);
  });

  test("handles CRLF line endings", () => {
    expect(splitOptionsText("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
  });

  test("returns empty array for empty or whitespace input", () => {
    expect(splitOptionsText("")).toEqual([]);
    expect(splitOptionsText("   \n  \n")).toEqual([]);
  });

  test("returns empty array for non-string input", () => {
    expect(splitOptionsText(null)).toEqual([]);
    expect(splitOptionsText(undefined)).toEqual([]);
  });
});

describe("optionsToText", () => {
  test("joins with newlines", () => {
    expect(optionsToText(["a", "b", "c"])).toBe("a\nb\nc");
  });

  test("returns empty string for non-array input", () => {
    expect(optionsToText(null)).toBe("");
  });

  test("round-trips with splitOptionsText", () => {
    const input = ["Alice", "Bob", "Carol"];
    expect(splitOptionsText(optionsToText(input))).toEqual(input);
  });
});

describe("parseUrlState", () => {
  test("reads multiple o params, n, and s", () => {
    const state = parseUrlState("?o=a&o=b&o=c&n=2&s=xyz");
    expect(state.options).toEqual(["a", "b", "c"]);
    expect(state.count).toBe(2);
    expect(state.seed).toBe("xyz");
  });

  test("decodes percent-encoded options", () => {
    const state = parseUrlState("?o=" + encodeURIComponent("Hello world"));
    expect(state.options).toEqual(["Hello world"]);
  });

  test("defaults count to 1 when missing or invalid", () => {
    expect(parseUrlState("").count).toBe(1);
    expect(parseUrlState("?n=foo").count).toBe(1);
    expect(parseUrlState("?n=0").count).toBe(1);
    expect(parseUrlState("?n=-3").count).toBe(1);
  });

  test("defaults seed to null when missing", () => {
    expect(parseUrlState("?o=a").seed).toBe(null);
  });

  test("accepts a query string with or without a leading ?", () => {
    expect(parseUrlState("?o=a").options).toEqual(["a"]);
    expect(parseUrlState("o=a").options).toEqual(["a"]);
  });

  test("accepts empty input", () => {
    expect(parseUrlState("")).toEqual({ options: [], count: 1, seed: null });
    expect(parseUrlState(null)).toEqual({ options: [], count: 1, seed: null });
  });
});

describe("serializeUrlState", () => {
  test("emits one o per option", () => {
    const s = serializeUrlState({ options: ["a", "b"], count: 1 });
    expect(s).toContain("o=a");
    expect(s).toContain("o=b");
  });

  test("omits n when count is 1", () => {
    expect(serializeUrlState({ options: ["a"], count: 1 })).not.toContain("n=");
  });

  test("includes n when count is greater than 1", () => {
    expect(serializeUrlState({ options: ["a"], count: 3 })).toContain("n=3");
  });

  test("includes s when seed is set", () => {
    expect(serializeUrlState({ options: ["a"], seed: "abc" })).toContain("s=abc");
  });

  test("omits s when seed is null or empty", () => {
    expect(serializeUrlState({ options: ["a"], seed: null })).not.toContain("s=");
    expect(serializeUrlState({ options: ["a"], seed: "" })).not.toContain("s=");
  });

  test("encodes special characters", () => {
    const s = serializeUrlState({ options: ["hello world"] });
    expect(s).toContain("hello+world");
  });

  test("round-trips with parseUrlState", () => {
    const original = { options: ["Alice", "Bob"], count: 2, seed: "xyz" };
    const s = serializeUrlState(original);
    const parsed = parseUrlState("?" + s);
    expect(parsed.options).toEqual(original.options);
    expect(parsed.count).toBe(original.count);
    expect(parsed.seed).toBe(original.seed);
  });

  test("ignores empty options", () => {
    const s = serializeUrlState({ options: ["a", "", "b"] });
    const parsed = parseUrlState("?" + s);
    expect(parsed.options).toEqual(["a", "b"]);
  });
});
