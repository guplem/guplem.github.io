import { describe, it, expect } from "bun:test";
import {
  SETUP_KEY,
  loadSetup,
  saveSetup,
  loadRecord,
  saveRecord,
  addResult,
  recordFor,
  loadSpeed,
  saveSpeed,
} from "./store.js";

/** A localStorage stand-in for the tests. */
function fakeStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

/** A storage that refuses everything, like a browser with cookies blocked. */
function brokenStorage() {
  return {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
}

const anySetup = () => true;

describe("the setup", () => {
  it("comes back the way it went in", () => {
    const storage = fakeStorage();
    const setup = { mode: "baawa", blue: "human", red: "deep", conquest: true };
    expect(saveSetup(storage, setup)).toBe(true);
    expect(loadSetup(storage, anySetup)).toEqual(setup);
  });

  it("is nothing when nothing was stored", () => {
    expect(loadSetup(fakeStorage(), anySetup)).toBe(null);
  });

  it("is thrown away when the caller says it is no longer valid", () => {
    const storage = fakeStorage({ [SETUP_KEY]: JSON.stringify({ mode: "chess" }) });
    expect(loadSetup(storage, (setup) => setup.mode === "kalah")).toBe(null);
  });

  it("survives a broken value in storage", () => {
    const storage = fakeStorage({ [SETUP_KEY]: "{not json" });
    expect(loadSetup(storage, anySetup)).toBe(null);
  });

  it("survives a browser that refuses storage", () => {
    expect(loadSetup(brokenStorage(), anySetup)).toBe(null);
    expect(saveSetup(brokenStorage(), { mode: "kalah" })).toBe(false);
    expect(loadSetup(null, anySetup)).toBe(null);
    expect(saveSetup(null, {})).toBe(true);
  });
});

describe("the record", () => {
  it("starts empty and counts each result once", () => {
    let record = loadRecord(fakeStorage());
    expect(record).toEqual({});
    record = addResult(record, "kalah", "deep", "loss");
    record = addResult(record, "kalah", "deep", "loss");
    record = addResult(record, "kalah", "deep", "win");
    expect(recordFor(record, "kalah", "deep")).toEqual({ win: 1, draw: 0, loss: 2 });
  });

  it("keeps each rule set and each opponent apart", () => {
    let record = {};
    record = addResult(record, "kalah", "deep", "win");
    record = addResult(record, "baawa", "deep", "loss");
    expect(recordFor(record, "kalah", "deep")).toEqual({ win: 1, draw: 0, loss: 0 });
    expect(recordFor(record, "baawa", "deep")).toEqual({ win: 0, draw: 0, loss: 1 });
    expect(recordFor(record, "kalah", "random")).toEqual({ win: 0, draw: 0, loss: 0 });
  });

  it("never changes the record it was given", () => {
    const record = { "kalah:deep": { win: 1, draw: 0, loss: 0 } };
    const frozen = JSON.stringify(record);
    addResult(record, "kalah", "deep", "win");
    expect(JSON.stringify(record)).toBe(frozen);
  });

  it("comes back from storage", () => {
    const storage = fakeStorage();
    saveRecord(storage, addResult({}, "baawa", "mcts", "draw"));
    expect(recordFor(loadRecord(storage), "baawa", "mcts")).toEqual({ win: 0, draw: 1, loss: 0 });
  });

  it("is empty when storage is broken", () => {
    expect(loadRecord(brokenStorage())).toEqual({});
  });
});

describe("the speed setting", () => {
  it("is normal until the player changes it", () => {
    expect(loadSpeed(fakeStorage())).toBe(1);
  });

  it("remembers fast", () => {
    const storage = fakeStorage();
    saveSpeed(storage, 2);
    expect(loadSpeed(storage)).toBe(2);
  });

  it("refuses a speed it does not have", () => {
    const storage = fakeStorage();
    saveSpeed(storage, 99);
    expect(loadSpeed(storage)).toBe(1);
  });
});
