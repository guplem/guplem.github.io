import { beforeEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_DATA_REPO_NAME,
  STORAGE_KEYS,
  browserStorage,
  forgetToken,
  readDataRepo,
  readGrantedPermissions,
  readToken,
  saveDataRepo,
  saveGrantedPermissions,
  saveToken,
} from "./settings.js";

const fakeStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

const refusingStorage = {
  getItem() {
    throw new Error("storage is off");
  },
  setItem() {
    throw new Error("storage is off");
  },
  removeItem() {
    throw new Error("storage is off");
  },
};

let storage;
beforeEach(() => {
  storage = fakeStorage();
});

describe("the token", () => {
  test("comes back exactly as it was saved", () => {
    saveToken(storage, "github_pat_11ABCDEF");
    expect(readToken(storage)).toBe("github_pat_11ABCDEF");
  });

  test("is trimmed, because a pasted token carries spaces and newlines", () => {
    saveToken(storage, "  github_pat_11ABCDEF\n");
    expect(readToken(storage)).toBe("github_pat_11ABCDEF");
  });

  test("an empty value is not stored", () => {
    saveToken(storage, "   ");
    expect(readToken(storage)).toBeNull();
    expect(storage.data.has(STORAGE_KEYS.token)).toBe(false);
  });

  // The reader asked the board to forget. Nothing may survive that, or the
  // promise the button makes is false.
  test("forgetToken removes it from storage", () => {
    saveToken(storage, "github_pat_11ABCDEF");
    forgetToken(storage);
    expect(readToken(storage)).toBeNull();
    expect(storage.data.has(STORAGE_KEYS.token)).toBe(false);
  });

  test("a browser that refuses to store never breaks the page", () => {
    expect(() => saveToken(refusingStorage, "x")).not.toThrow();
    expect(() => forgetToken(refusingStorage)).not.toThrow();
    expect(readToken(refusingStorage)).toBeNull();
    expect(readToken(undefined)).toBeNull();
  });
});

describe("the data repository", () => {
  test("round-trips owner and name", () => {
    saveDataRepo(storage, { owner: "guplem", repo: "work-board-data" });
    expect(readDataRepo(storage)).toEqual({ owner: "guplem", repo: "work-board-data" });
  });

  test("reads as null when what is stored is not a repository", () => {
    for (const junk of ["{}", "null", "[]", "not json", '{"owner":"guplem"}', '{"owner":"","repo":"x"}']) {
      storage.setItem(STORAGE_KEYS.dataRepo, junk);
      expect(readDataRepo(storage)).toBeNull();
    }
  });

  test("refuses to store an incomplete repository", () => {
    saveDataRepo(storage, { owner: "guplem" });
    expect(readDataRepo(storage)).toBeNull();
  });

  test("suggests a name when the reader has not chosen one", () => {
    expect(DEFAULT_DATA_REPO_NAME).toBe("work-board-data");
  });
});

describe("the permissions a token was approved against", () => {
  test("round-trips the fingerprint", () => {
    saveGrantedPermissions(storage, "contents:read and write|issues:read and write");
    expect(readGrantedPermissions(storage)).toBe("contents:read and write|issues:read and write");
  });

  test("reads as null when nothing was ever stored", () => {
    expect(readGrantedPermissions(storage)).toBeNull();
  });

  test("an empty fingerprint is not stored, so it cannot read as 'approved against nothing'", () => {
    saveGrantedPermissions(storage, "  ");
    expect(readGrantedPermissions(storage)).toBeNull();
  });

  // Signing out throws the token away, so what that token could do is gone too.
  // Leaving it behind would tell the next token it is already up to date.
  test("forgetToken clears it as well", () => {
    saveToken(storage, "github_pat_11ABCDEF");
    saveGrantedPermissions(storage, "issues:read-only");
    forgetToken(storage);
    expect(readGrantedPermissions(storage)).toBeNull();
  });

  test("a browser that refuses to store never breaks the page", () => {
    expect(() => saveGrantedPermissions(refusingStorage, "x")).not.toThrow();
    expect(readGrantedPermissions(refusingStorage)).toBeNull();
  });
});

describe("browserStorage", () => {
  // It is the one place that names `localStorage`, so it is also the one place
  // that can throw when a browser has storage switched off.
  test("answers with a storage or with null, and never throws", () => {
    expect(() => browserStorage()).not.toThrow();
    const storage = browserStorage();
    expect(storage === null || typeof storage === "object").toBe(true);
  });
});
