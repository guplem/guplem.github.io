import { describe, expect, test } from "bun:test";
import { emptyDocument, writeRecord } from "./envelope.js";
import { BUNDLE_FORMAT, BUNDLE_TOOL, bundleFileName, encodeBundle, readBundle } from "./exportBundle.js";

const T1 = "2026-09-22T10:00:00.000Z";
const doc = writeRecord(emptyDocument(["saves"], T1), "saves", "main", { hp: 3 }, T1);

describe("encodeBundle and readBundle", () => {
  test("round-trip every document of every project", () => {
    const text = encodeBundle({ exportedAt: T1, projects: { "rps-mind-reader": { "history.json": doc } } });
    const read = readBundle(text);
    expect(read.ok).toBe(true);
    expect(read.exportedAt).toBe(T1);
    expect(read.projects["rps-mind-reader"]["history.json"]).toEqual(doc);
  });

  test("names the tool and the format so another tool's file is refused", () => {
    const parsed = JSON.parse(encodeBundle({ exportedAt: T1, projects: {} }));
    expect(parsed.tool).toBe(BUNDLE_TOOL);
    expect(parsed.format).toBe(BUNDLE_FORMAT);
    expect(readBundle(JSON.stringify({ tool: "other", format: 1, projects: {} })).ok).toBe(false);
  });

  test("refuses text that is not a bundle, with a sentence", () => {
    expect(readBundle("{ nope")).toEqual({ ok: false, message: expect.stringMatching(/not an export file/) });
    expect(readBundle("[]").ok).toBe(false);
    expect(readBundle(null).ok).toBe(false);
  });

  test("drops a document that is not one, and keeps the rest", () => {
    const text = JSON.stringify({
      tool: BUNDLE_TOOL,
      format: 1,
      exportedAt: T1,
      projects: { good: { "a.json": doc }, bad: { "b.json": 4 }, worse: "text" },
    });
    const read = readBundle(text);
    expect(Object.keys(read.projects)).toEqual(["good"]);
  });

  test("a document inside goes through migrate, so a broken record is dropped", () => {
    const text = JSON.stringify({
      tool: BUNDLE_TOOL,
      format: 1,
      exportedAt: T1,
      projects: { p: { "a.json": { saves: { ok: { updatedAt: T1 }, bad: { x: 1 } } } } },
    });
    expect(Object.keys(readBundle(text).projects.p["a.json"].saves)).toEqual(["ok"]);
  });
});

describe("bundleFileName", () => {
  test("carries the folder name and the day", () => {
    expect(bundleFileName(new Date("2026-09-22T10:00:00.000Z"))).toBe("triunity-studios-data-2026-09-22.json");
  });
});
