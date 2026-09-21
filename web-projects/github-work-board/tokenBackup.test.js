import { describe, expect, test } from "bun:test";
import { BACKUP_FORMAT, encodeTokenBackup, looksLikeBackup, readTokenBackup } from "./tokenBackup.js";

describe("encodeTokenBackup", () => {
  test("carries a token and the name the reader gave it", () => {
    const text = encodeTokenBackup([{ id: "a", token: "github_pat_one", name: "Galtea-AI" }]);
    const back = readTokenBackup(text);
    expect(back.ok).toBe(true);
    expect(back.tokens).toEqual([{ token: "github_pat_one", name: "Galtea-AI" }]);
  });

  // A backup holds what the reader gave, never what the board learned. Owners
  // and counts go stale the moment the backup is written, and a restored board
  // that shows last month's facts is worse than one that shows none.
  test("carries nothing the board discovered by itself", () => {
    const text = encodeTokenBackup([
      { id: "a", token: "github_pat_one", name: "mine", owners: ["guplem"], itemCount: 19, canWriteBoard: true },
    ]);
    expect(text).not.toContain("guplem");
    expect(text).not.toContain("19");
    expect(text).not.toContain("canWriteBoard");
  });

  test("says which format it is, so a later shape can be told apart", () => {
    expect(JSON.parse(encodeTokenBackup([])).backup).toBe(BACKUP_FORMAT);
  });

  test("never throws, whatever it is handed", () => {
    expect(typeof encodeTokenBackup(null)).toBe("string");
    expect(JSON.parse(encodeTokenBackup([null, 7, { id: "a" }])).tokens).toEqual([]);
  });
});

describe("readTokenBackup", () => {
  test("refuses text that is not a backup, and says so in a sentence", () => {
    const answer = readTokenBackup("github_pat_justatoken");
    expect(answer.ok).toBe(false);
    expect(answer.message.length).toBeGreaterThan(10);
  });

  test("refuses a backup written by something else", () => {
    expect(readTokenBackup(JSON.stringify({ tool: "other", backup: 1, tokens: [] })).ok).toBe(false);
  });

  // Half a blob pasted out of a chat window is the common accident. It must not
  // be read as "a backup with no tokens in it", which would look like success.
  test("refuses a backup holding no token at all", () => {
    const answer = readTokenBackup(JSON.stringify({ tool: "github-work-board", backup: 1, tokens: [] }));
    expect(answer.ok).toBe(false);
  });

  test("drops an entry with no token and keeps the rest", () => {
    const text = JSON.stringify({
      tool: "github-work-board",
      backup: 1,
      tokens: [{ name: "empty" }, { token: "github_pat_two", name: "kept" }],
    });
    expect(readTokenBackup(text).tokens).toEqual([{ token: "github_pat_two", name: "kept" }]);
  });

  test("accepts a backup from a later format, because the token part cannot change", () => {
    const text = JSON.stringify({
      tool: "github-work-board",
      backup: BACKUP_FORMAT + 5,
      tokens: [{ token: "github_pat_two", name: "kept", somethingNew: true }],
    });
    expect(readTokenBackup(text).ok).toBe(true);
  });

  test("never throws, whatever it is handed", () => {
    expect(readTokenBackup(null).ok).toBe(false);
    expect(readTokenBackup("{{{").ok).toBe(false);
    expect(readTokenBackup(JSON.stringify({ tool: "github-work-board", backup: 1 })).ok).toBe(false);
  });
});

describe("looksLikeBackup", () => {
  // The one box in Settings takes either a token or a backup. When somebody
  // pasted half a backup, the board must report the broken backup rather than
  // send the fragment to GitHub as a token and repeat GitHub's own error.
  test("tells a blob that was meant to be a backup from a token", () => {
    expect(looksLikeBackup('{"tool":"github-work-board"')).toBe(true);
    expect(looksLikeBackup("  {}  ")).toBe(true);
    expect(looksLikeBackup("github_pat_11ABCDE")).toBe(false);
    expect(looksLikeBackup("")).toBe(false);
    expect(looksLikeBackup(null)).toBe(false);
  });
});
