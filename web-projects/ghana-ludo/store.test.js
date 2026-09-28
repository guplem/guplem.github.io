import { describe, expect, it } from "bun:test";
import { clearTable, loadName, loadPlayerId, loadTable, saveName, saveTable } from "./store.js";

function memory() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    keys: () => [...data.keys()],
  };
}

describe("store", () => {
  it("remembers the name, under the project's own key", () => {
    const s = memory();
    expect(loadName(s)).toBe("");
    saveName(s, "Ama");
    expect(loadName(s)).toBe("Ama");
    expect(s.keys()).toEqual(["ghana-ludo.name"]);
  });

  it("makes a player id once and gives the same one back", () => {
    const s = memory();
    const first = loadPlayerId(s, () => "id-1");
    const second = loadPlayerId(s, () => "id-2");
    expect(first).toBe("id-1");
    expect(second).toBe("id-1");
  });

  it("keeps the host's table for a reload, and forgets a stale one", () => {
    const s = memory();
    saveTable(s, { room: "R1", state: { a: 1 }, version: 7 }, () => 1000);
    expect(loadTable(s, () => 2000)).toEqual({ room: "R1", state: { a: 1 }, version: 7, savedAt: 1000 });
    expect(loadTable(s, () => 1000 + 13 * 3600 * 1000)).toBeNull();
    clearTable(s);
    expect(loadTable(s, () => 2000)).toBeNull();
  });

  it("never throws without storage", () => {
    expect(loadName(null)).toBe("");
    expect(loadPlayerId(null, () => "x")).toBe("x");
    expect(loadTable(null)).toBeNull();
    expect(() => saveTable(null, { room: "R", state: {}, version: 1 })).not.toThrow();
  });
});
