import { beforeEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_DATA_REPO_NAME,
  LEGACY_KEYS,
  STORAGE_KEYS,
  addToken,
  boardWritingToken,
  browserStorage,
  forgetAllTokens,
  readAutoRefresh,
  readDataRepo,
  readLastCounts,
  readTokens,
  removeToken,
  renameToken,
  saveAutoRefresh,
  saveDataRepo,
  saveLastCounts,
  saveTokens,
  updateToken,
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

/** An entry in the shape `readTokens` and `addToken` always hand back. */
const entry = (over = {}) => ({
  id: "t1",
  token: "github_pat_11ABCDEF",
  grantedPermissions: null,
  name: "",
  owners: [],
  itemCount: 0,
  canWriteBoard: false,
  ...over,
});

let storage;
beforeEach(() => {
  storage = fakeStorage();
});

describe("the saved tokens", () => {
  test("round-trip", () => {
    saveTokens(storage, [entry(), entry({ id: "t2", token: "github_pat_22" })]);
    expect(readTokens(storage).map((one) => one.id)).toEqual(["t1", "t2"]);
    expect(readTokens(storage)[0].token).toBe("github_pat_11ABCDEF");
  });

  test("read as an empty list when nothing was ever saved", () => {
    expect(readTokens(storage)).toEqual([]);
    expect(readTokens(undefined)).toEqual([]);
    expect(readTokens(refusingStorage)).toEqual([]);
  });

  test("anything that is not a list of tokens reads as an empty list", () => {
    for (const junk of ["{}", "null", "not json", '"a string"', "[7]", '[{"id":"x"}]']) {
      storage.setItem(STORAGE_KEYS.tokens, junk);
      expect(readTokens(storage)).toEqual([]);
    }
  });

  test("an entry keeps what it was given, and fills in what it was not", () => {
    saveTokens(storage, [entry()]);
    expect(readTokens(storage)[0]).toEqual({
      id: "t1",
      token: "github_pat_11ABCDEF",
      grantedPermissions: null,
      name: "",
      owners: [],
      itemCount: 0,
      canWriteBoard: false,
    });
  });

  // Settings can show a token in full, on request, one token at a time
  // (ADR 0015). That request lasts as long as the reader is looking at it and
  // no longer: a board that opens with a credential already on screen is a
  // board nobody can share a screen with.
  test("a revealed token is never stored as revealed", () => {
    saveTokens(storage, [{ ...entry(), revealed: true }]);
    expect(readTokens(storage)[0]).not.toHaveProperty("revealed");
  });

  // The board used to hold exactly one token. Somebody who connected before
  // this change must not have to set the whole thing up again.
  test("a token saved by the one-token version becomes the first entry", () => {
    storage.setItem(LEGACY_KEYS.token, "github_pat_OLD");
    storage.setItem(LEGACY_KEYS.grantedPermissions, "issues:read and write");
    const tokens = readTokens(storage);
    expect(tokens.length).toBe(1);
    expect(tokens[0].token).toBe("github_pat_OLD");
    expect(tokens[0].grantedPermissions).toBe("issues:read and write");
    expect(tokens[0].id.length).toBeGreaterThan(0);
  });

  test("the saved list wins over a token left behind by the old version", () => {
    storage.setItem(LEGACY_KEYS.token, "github_pat_OLD");
    saveTokens(storage, [entry({ token: "github_pat_NEW" })]);
    expect(readTokens(storage).map((one) => one.token)).toEqual(["github_pat_NEW"]);
  });

  // Signing out throws every credential away. Anything left behind is a
  // credential the reader believes they deleted.
  test("forgetAllTokens clears the list and anything the old version left", () => {
    storage.setItem(LEGACY_KEYS.token, "github_pat_OLD");
    storage.setItem(LEGACY_KEYS.grantedPermissions, "x");
    saveTokens(storage, [entry()]);
    forgetAllTokens(storage);
    expect(readTokens(storage)).toEqual([]);
    expect(storage.data.size).toBe(0);
  });

  test("a browser that refuses to store never breaks the page", () => {
    expect(() => saveTokens(refusingStorage, [entry()])).not.toThrow();
    expect(() => forgetAllTokens(refusingStorage)).not.toThrow();
  });
});

describe("addToken", () => {
  test("adds one and leaves the list it was given alone", () => {
    const before = [entry()];
    const after = addToken(before, { id: "t2", token: "github_pat_22" });
    expect(before.length).toBe(1);
    expect(after.map((one) => one.id)).toEqual(["t1", "t2"]);
  });

  test("trims the pasted token, because a copied token carries spaces", () => {
    expect(addToken([], { id: "t1", token: "  github_pat_11\n" })[0].token).toBe("github_pat_11");
  });

  test("refuses an empty token", () => {
    expect(addToken([], { id: "t1", token: "   " })).toEqual([]);
    expect(addToken([], { id: "t1", token: null })).toEqual([]);
  });

  // Pasting the same token twice is a mistake that would double every item on
  // the board and look like a syncing bug.
  test("refuses a token the list already holds", () => {
    const list = addToken([], { id: "t1", token: "same" });
    expect(addToken(list, { id: "t2", token: "same" })).toEqual(list);
  });
});

describe("removeToken and updateToken", () => {
  test("removeToken drops one by its id and keeps the rest", () => {
    const list = [entry(), entry({ id: "t2", token: "b" })];
    expect(removeToken(list, "t1").map((one) => one.id)).toEqual(["t2"]);
    expect(removeToken(list, "nope").length).toBe(2);
  });

  test("updateToken changes one entry and leaves the others untouched", () => {
    const list = [entry(), entry({ id: "t2", token: "b" })];
    const after = updateToken(list, "t2", { owners: ["Galtea-AI"], canWriteBoard: true });
    expect(after[1].owners).toEqual(["Galtea-AI"]);
    expect(after[1].canWriteBoard).toBe(true);
    expect(after[0].owners).toEqual([]);
    expect(list[1].owners).toEqual([]);
  });

  test("updateToken cannot change the token itself or its id", () => {
    const after = updateToken([entry()], "t1", { token: "stolen", id: "other" });
    expect(after[0].token).toBe("github_pat_11ABCDEF");
    expect(after[0].id).toBe("t1");
  });
});

describe("renameToken", () => {
  test("renames one and leaves the list it was given alone", () => {
    const list = [entry(), entry({ id: "t2", token: "b" })];
    const after = renameToken(list, "t2", "  Work  ");
    expect(after[1].name).toBe("Work");
    expect(after[0].name).toBe("");
    expect(list[1].name).toBe("");
  });

  // The name is the reader's. Emptying it means "go back to the suggestion",
  // which is what a reader who clears the box expects.
  test("an empty name is stored as empty, not refused", () => {
    expect(renameToken([entry({ name: "Work" })], "t1", "   ")[0].name).toBe("");
  });
});

describe("boardWritingToken", () => {
  // The notes file lives in one repository, so exactly one token can write it.
  // Picking the wrong one means every save fails with a permission error.
  test("is the first token that reached the notes repository", () => {
    const list = [entry({ id: "a" }), entry({ id: "b", token: "b", canWriteBoard: true })];
    expect(boardWritingToken(list).id).toBe("b");
  });

  test("is null when no token can write the notes file", () => {
    expect(boardWritingToken([entry()])).toBeNull();
    expect(boardWritingToken([])).toBeNull();
    expect(boardWritingToken(null)).toBeNull();
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

describe("the remembered counts", () => {
  test("round-trip", () => {
    saveLastCounts(storage, { items: 11, repositories: 2, labels: 5, tokens: 2 });
    expect(readLastCounts(storage)).toEqual({ items: 11, repositories: 2, labels: 5, tokens: 2 });
  });

  test("read as nothing when there is nothing, or nonsense", () => {
    expect(readLastCounts(storage)).toEqual({});
    for (const junk of ["[]", "null", "not json", '"7"']) {
      storage.setItem(STORAGE_KEYS.lastCounts, junk);
      expect(readLastCounts(storage)).toEqual({});
    }
  });

  test("a count that is not a count is dropped, and its neighbours are kept", () => {
    storage.setItem(STORAGE_KEYS.lastCounts, JSON.stringify({ items: 4, labels: "many", tokens: -1 }));
    expect(readLastCounts(storage)).toEqual({ items: 4 });
  });

  // Signing out throws away what the board knew, and how big it was is part of
  // that: the next reader on this browser is not the same person.
  test("forgetAllTokens clears them", () => {
    saveLastCounts(storage, { items: 11 });
    forgetAllTokens(storage);
    expect(readLastCounts(storage)).toEqual({});
  });
});

describe("browserStorage", () => {
  test("answers with a storage or with null, and never throws", () => {
    expect(() => browserStorage()).not.toThrow();
    const found = browserStorage();
    expect(found === null || typeof found === "object").toBe(true);
  });
});

describe("the auto refresh schedule", () => {
  let storage;
  beforeEach(() => {
    storage = fakeStorage();
  });

  // How often this browser asks GitHub is about this device and the rate limit
  // it spends, so it stays here and does not travel in the board file
  // (ADR 0025).
  test("round-trips", () => {
    saveAutoRefresh(storage, "30s");
    expect(readAutoRefresh(storage)).toBe("30s");
  });

  test("a browser that was never told asks for nothing", () => {
    expect(readAutoRefresh(storage)).toBe("off");
  });

  // A schedule written by a newer build, or by hand, must never leave this
  // browser asking GitHub on a cadence nobody chose.
  test("a schedule this build does not know asks for nothing", () => {
    storage.setItem(STORAGE_KEYS.autoRefresh, "every-second");
    expect(readAutoRefresh(storage)).toBe("off");
  });

  test("signing out forgets it too", () => {
    saveAutoRefresh(storage, "1m");
    forgetAllTokens(storage);
    expect(readAutoRefresh(storage)).toBe("off");
    expect(storage.data.size).toBe(0);
  });

  test("a browser that refuses to store never breaks the page", () => {
    expect(() => saveAutoRefresh(refusingStorage, "30s")).not.toThrow();
    expect(readAutoRefresh(refusingStorage)).toBe("off");
  });
});
