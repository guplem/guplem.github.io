import { describe, it, expect } from "bun:test";
import { parseSetup, serializeSetup, isSeat, DEFAULT_SETUP } from "./urlState.js";

describe("parseSetup", () => {
  it("gives the defaults for an empty query", () => {
    expect(parseSetup("")).toEqual(DEFAULT_SETUP);
    expect(parseSetup("?")).toEqual(DEFAULT_SETUP);
  });

  it("reads a full setup", () => {
    expect(parseSetup("?mode=baawa&blue=deep&red=human&rounds=single")).toEqual({
      mode: "baawa",
      blue: "deep",
      red: "human",
      conquest: false,
    });
  });

  it("works with or without the question mark", () => {
    expect(parseSetup("mode=baawa")).toEqual(parseSetup("?mode=baawa"));
  });

  it("throws nothing away but the values it cannot use", () => {
    const setup = parseSetup("?mode=chess&blue=cheater&red=mcts");
    expect(setup.mode).toBe(DEFAULT_SETUP.mode);
    expect(setup.blue).toBe(DEFAULT_SETUP.blue);
    expect(setup.red).toBe("mcts");
  });

  it("keeps the whole match unless the link says single", () => {
    expect(parseSetup("?rounds=single").conquest).toBe(false);
    expect(parseSetup("?rounds=all").conquest).toBe(true);
    expect(parseSetup("").conquest).toBe(true);
  });
});

describe("serializeSetup", () => {
  it("writes nothing for the defaults", () => {
    expect(serializeSetup(DEFAULT_SETUP)).toBe("");
  });

  it("writes only what differs from the default", () => {
    expect(serializeSetup({ ...DEFAULT_SETUP, mode: "baawa" })).toBe("?mode=baawa");
    expect(serializeSetup({ ...DEFAULT_SETUP, red: "deep" })).toBe("?red=deep");
  });

  it("says nothing about rounds in a rule set that has none", () => {
    expect(serializeSetup({ ...DEFAULT_SETUP, mode: "kalah", conquest: false })).toBe("");
  });

  it("comes back the same after a round trip", () => {
    const setups = [
      DEFAULT_SETUP,
      { mode: "baawa", blue: "human", red: "deep", conquest: false },
      { mode: "baawa", blue: "mcts", red: "minimax", conquest: true },
      { mode: "kalah", blue: "random", red: "human", conquest: true },
    ];
    for (const setup of setups) {
      expect(parseSetup(serializeSetup(setup))).toEqual(setup);
    }
  });
});

describe("isSeat", () => {
  it("accepts a person and every opponent", () => {
    expect(isSeat("human")).toBe(true);
    expect(isSeat("deep")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isSeat("robot")).toBe(false);
    expect(isSeat(null)).toBe(false);
    expect(isSeat("")).toBe(false);
  });
});
