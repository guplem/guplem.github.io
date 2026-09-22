import { beforeEach, describe, expect, test } from "bun:test";
import {
  DATA_FOLDER,
  DEFAULT_REPO_NAME,
  STORAGE_KEYS,
  browserStorage,
  documentPath,
  forgetToken,
  isReconciled,
  markReconciled,
  mirrorKey,
  readRepo,
  readToken,
  saveRepo,
  saveToken,
} from "./cloudSettings.js";

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
  test("is null until one is saved", () => {
    expect(readToken(storage)).toBeNull();
  });

  test("round-trips with what the reader gave and what the page learned", () => {
    saveToken(storage, { token: " github_pat_X ", name: "Laptop", login: "me", grantedPermissions: "a:b" });
    expect(readToken(storage)).toEqual({ token: "github_pat_X", name: "Laptop", login: "me", grantedPermissions: "a:b" });
  });

  test("an empty token is not stored", () => {
    saveToken(storage, { token: "  " });
    expect(readToken(storage)).toBeNull();
  });

  test("a broken stored value reads as null", () => {
    storage.setItem(STORAGE_KEYS.token, "{ not json");
    expect(readToken(storage)).toBeNull();
    storage.setItem(STORAGE_KEYS.token, JSON.stringify([1, 2]));
    expect(readToken(storage)).toBeNull();
  });

  test("a browser that refuses storage is not an error", () => {
    expect(readToken(refusingStorage)).toBeNull();
    expect(() => saveToken(refusingStorage, { token: "x" })).not.toThrow();
    expect(() => forgetToken(refusingStorage)).not.toThrow();
    expect(readToken(null)).toBeNull();
  });
});

describe("the repository", () => {
  test("is null until one is saved, and an incomplete one is not saved", () => {
    expect(readRepo(storage)).toBeNull();
    saveRepo(storage, { owner: "me", repo: "" });
    expect(readRepo(storage)).toBeNull();
  });

  test("round-trips trimmed", () => {
    saveRepo(storage, { owner: " me ", repo: " data " });
    expect(readRepo(storage)).toEqual({ owner: "me", repo: "data" });
  });

  test("the default name is the folder name, so one word names the whole thing", () => {
    expect(DEFAULT_REPO_NAME).toBe("triunity-studios-data");
    expect(DATA_FOLDER).toBe("triunity-studios-data");
  });
});

describe("paths and keys", () => {
  test("a document lives under the folder, then the project, then its file", () => {
    expect(documentPath("rps-mind-reader", "history.json")).toBe("triunity-studios-data/rps-mind-reader/history.json");
  });

  test("the mirror key names the folder, the project and the file", () => {
    expect(mirrorKey("rps-mind-reader", "history.json")).toBe("triunity-studios-data.rps-mind-reader.history.json");
  });
});

describe("reconciled flags", () => {
  test("a document is not reconciled until marked, and then stays so", () => {
    expect(isReconciled(storage, "p", "f.json")).toBe(false);
    markReconciled(storage, "p", "f.json", "2026-09-22T10:00:00.000Z");
    expect(isReconciled(storage, "p", "f.json")).toBe(true);
    expect(isReconciled(storage, "p", "other.json")).toBe(false);
  });

  // A new token or repository means a different cloud copy, so every earlier
  // answer is void and the question is right to come back.
  test("forgetting the token clears the repository and every flag", () => {
    saveToken(storage, { token: "x" });
    saveRepo(storage, { owner: "me", repo: "data" });
    markReconciled(storage, "p", "f.json", "2026-09-22T10:00:00.000Z");
    forgetToken(storage);
    expect(readToken(storage)).toBeNull();
    expect(readRepo(storage)).toBeNull();
    expect(isReconciled(storage, "p", "f.json")).toBe(false);
  });

  test("saving a different repository clears the flags too", () => {
    saveRepo(storage, { owner: "me", repo: "data" });
    markReconciled(storage, "p", "f.json", "2026-09-22T10:00:00.000Z");
    saveRepo(storage, { owner: "me", repo: "data" });
    expect(isReconciled(storage, "p", "f.json")).toBe(true);
    saveRepo(storage, { owner: "me", repo: "other" });
    expect(isReconciled(storage, "p", "f.json")).toBe(false);
  });
});

describe("browserStorage", () => {
  test("hands back whatever the runtime has, or null", () => {
    const value = browserStorage();
    expect(value === null || typeof value === "object").toBe(true);
  });
});

describe("listMirrors", () => {
  test("finds every local mirror by its key, and reads the document", () => {
    const { listMirrors } = require("./cloudSettings.js");
    const data = new Map([
      ["triunity-studios-data.rps-mind-reader.history.json", JSON.stringify({ schemaVersion: 1, updatedAt: "t", rounds: {} })],
      ["triunity-studios-data.mancala.record.json", JSON.stringify({ schemaVersion: 1, updatedAt: "t" })],
      ["mancala.speed", "2"],
      ["triunity-studios.cloud.token", "{}"],
    ]);
    const store = {
      get length() {
        return data.size;
      },
      key: (index) => [...data.keys()][index] ?? null,
      getItem: (key) => (data.has(key) ? data.get(key) : null),
    };
    const found = listMirrors(store);
    expect(found.map((one) => `${one.project}/${one.file}`).sort()).toEqual(["mancala/record.json", "rps-mind-reader/history.json"]);
    expect(found.find((one) => one.project === "rps-mind-reader").document.rounds).toEqual({});
  });

  test("a storage that refuses, or has nothing, lists nothing", () => {
    const { listMirrors } = require("./cloudSettings.js");
    expect(listMirrors(null)).toEqual([]);
    expect(listMirrors(refusingStorage)).toEqual([]);
  });
});

describe("links", () => {
  test("the page to create the repository names it and makes it private", () => {
    const { newRepoUrl, repoUrl } = require("./cloudSettings.js");
    expect(newRepoUrl("triunity-studios-data")).toBe("https://github.com/new?name=triunity-studios-data&visibility=private");
    expect(repoUrl({ owner: "me", repo: "data" })).toBe("https://github.com/me/data");
  });
});
