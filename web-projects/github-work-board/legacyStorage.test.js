import { beforeEach, describe, expect, test } from "bun:test";
import { readRepo, readToken } from "../cloud-storage/cloudSettings.js";
import { LEGACY_KEYS, STORAGE_KEYS, readTokens } from "./settings.js";
import { adoptLegacyStorage } from "./legacyStorage.js";

const fakeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

const refusingStorage = {
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

const WRITER = { id: "b", token: "github_pat_writes", name: "Mine", owners: ["guplem"], canWriteBoard: true, grantedPermissions: "x" };
const READER = { id: "a", token: "github_pat_reads", name: "Work", owners: ["Galtea-AI"], canWriteBoard: false };

let storage;
beforeEach(() => {
  storage = fakeStorage();
});

describe("adoptLegacyStorage", () => {
  // Before the shared cloud storage, the board kept its own data repository and
  // remembered which token could write it. Nobody sets the board up again: the
  // token that wrote the board becomes the cloud token, once (root ADR 0016).
  test("hands the writing token and the repository to cloud storage, and clears the old key", () => {
    storage.setItem(STORAGE_KEYS.tokens, JSON.stringify([READER, WRITER]));
    storage.setItem(LEGACY_KEYS.dataRepo, JSON.stringify({ owner: "guplem", repo: "work-board-data" }));
    expect(adoptLegacyStorage(storage)).toBe(true);
    expect(readToken(storage)).toMatchObject({ token: "github_pat_writes", login: "guplem", name: "Mine" });
    expect(readRepo(storage)).toEqual({ owner: "guplem", repo: "work-board-data" });
    expect(storage.getItem(LEGACY_KEYS.dataRepo)).toBeNull();
    // The board's own list is untouched: it still reads work with both.
    expect(readTokens(storage).map((one) => one.id)).toEqual(["a", "b"]);
  });

  test("does nothing when cloud storage is already set up, and still clears the old key", () => {
    storage.setItem("triunity-studios.cloud.token", JSON.stringify({ token: "already" }));
    storage.setItem(STORAGE_KEYS.tokens, JSON.stringify([WRITER]));
    storage.setItem(LEGACY_KEYS.dataRepo, JSON.stringify({ owner: "guplem", repo: "work-board-data" }));
    expect(adoptLegacyStorage(storage)).toBe(false);
    expect(readToken(storage).token).toBe("already");
    expect(storage.getItem(LEGACY_KEYS.dataRepo)).toBeNull();
  });

  test("does nothing when there is no old repository, or no token that wrote it", () => {
    storage.setItem(STORAGE_KEYS.tokens, JSON.stringify([WRITER]));
    expect(adoptLegacyStorage(storage)).toBe(false);
    storage.setItem(LEGACY_KEYS.dataRepo, JSON.stringify({ owner: "guplem", repo: "work-board-data" }));
    storage.setItem(STORAGE_KEYS.tokens, JSON.stringify([READER]));
    expect(adoptLegacyStorage(storage)).toBe(false);
    expect(readToken(storage)).toBeNull();
  });

  test("survives a storage that refuses", () => {
    expect(adoptLegacyStorage(refusingStorage)).toBe(false);
  });
});
