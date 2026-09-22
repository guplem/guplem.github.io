import { describe, expect, test } from "bun:test";
import { projectKey, readJson, removeKey, writeJson } from "./localStore.js";

const fakeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

const refusing = {
  getItem() {
    throw new Error("off");
  },
  setItem() {
    throw new Error("off");
  },
  removeItem() {
    throw new Error("off");
  },
};

describe("readJson and writeJson", () => {
  test("round-trip anything JSON can hold", () => {
    const storage = fakeStorage();
    expect(writeJson(storage, "k", { a: [1, "é"] })).toBe(true);
    expect(readJson(storage, "k", null)).toEqual({ a: [1, "é"] });
  });

  test("hand back the fallback for a missing, broken or null value", () => {
    const storage = fakeStorage();
    expect(readJson(storage, "missing", "fb")).toBe("fb");
    storage.setItem("broken", "{ nope");
    expect(readJson(storage, "broken", "fb")).toBe("fb");
    storage.setItem("null", "null");
    expect(readJson(storage, "null", "fb")).toBe("fb");
  });

  // A private window throws on the first write. The project keeps working; it
  // only forgets (root ADR 0007).
  test("a browser that refuses storage is forgotten, not an error", () => {
    expect(writeJson(refusing, "k", 1)).toBe(false);
    expect(readJson(refusing, "k", "fb")).toBe("fb");
    expect(() => removeKey(refusing, "k")).not.toThrow();
    expect(readJson(null, "k", "fb")).toBe("fb");
    expect(writeJson(null, "k", 1)).toBe(false);
  });

  test("removeKey forgets one key", () => {
    const storage = fakeStorage();
    writeJson(storage, "k", 1);
    removeKey(storage, "k");
    expect(readJson(storage, "k", null)).toBeNull();
  });
});

describe("projectKey", () => {
  test("is the project slug, a dot, and the name", () => {
    expect(projectKey("mancala", "speed")).toBe("mancala.speed");
  });
});
