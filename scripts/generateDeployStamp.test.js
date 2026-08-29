// Tests for the deploy stamp generator.
//
// The generator is what keeps the footer honest, and the `--check` mode is what
// stops a pull request merging with somebody else's number in it. Both are
// tested here against real committed pages, so a renamed or deleted marker fails
// the suite rather than the deploy.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStamp } from "../web-projects/sudoku-screenshot-coach/deployStamp.js";
import { buildDeployBlock, findStampedPages, parseArguments, stampDocument } from "./generateDeployStamp.js";

const ROOT = join(import.meta.dir, "..");
const PAGE = join(ROOT, "web-projects/sudoku-screenshot-coach/index.html");

describe("parseArguments", () => {
  test("reads the number and normalises the date", () => {
    const parsed = parseArguments(["--pr", "82", "--date", "2026-08-29T12:05:00Z"]);
    expect(parsed).toEqual({ pr: 82, date: "2026-08-29T12:05:00.000Z", check: false });
  });

  test("notices --check", () => {
    expect(parseArguments(["--pr", "82", "--date", "2026-08-29T12:05:00Z", "--check"]).check).toBe(true);
  });

  // A bad value would otherwise be stamped into every page and merged.
  test("refuses a number or a date it cannot use", () => {
    for (const argv of [
      [],
      ["--pr", "0", "--date", "2026-08-29T12:05:00Z"],
      ["--pr", "-3", "--date", "2026-08-29T12:05:00Z"],
      ["--pr", "abc", "--date", "2026-08-29T12:05:00Z"],
      ["--pr", "82"],
      ["--pr", "82", "--date", "not a date"],
    ]) {
      expect(() => parseArguments(argv)).toThrow();
    }
  });
});

describe("stampDocument", () => {
  const html = readFileSync(PAGE, "utf8");

  test("writes both meta tags between the markers", () => {
    const stamped = stampDocument(html, 82, "2026-08-29T12:05:00.000Z");
    expect(stamped).toContain('<meta name="deploy-pull-request" content="82" />');
    expect(stamped).toContain('<meta name="deploy-date" content="2026-08-29T12:05:00.000Z" />');
    expect(stamped).toContain("<!-- BEGIN GENERATED:DEPLOY -->");
    expect(stamped).toContain("<!-- END GENERATED:DEPLOY -->");
  });

  test("running it twice changes nothing the second time", () => {
    const once = stampDocument(html, 82, "2026-08-29T12:05:00.000Z");
    expect(stampDocument(once, 82, "2026-08-29T12:05:00.000Z")).toBe(once);
  });

  test("replaces an older stamp instead of adding a second one", () => {
    const once = stampDocument(html, 82, "2026-08-29T12:05:00.000Z");
    const twice = stampDocument(once, 83, "2026-08-30T09:00:00.000Z");
    expect(twice.match(/name="deploy-pull-request"/g)).toHaveLength(1);
    expect(twice).toContain('content="83"');
    expect(twice).not.toContain('content="82"');
  });

  test("touches nothing outside the block", () => {
    const stamped = stampDocument(html, 82, "2026-08-29T12:05:00.000Z");
    const outside = (text) => text.replace(/<!-- BEGIN GENERATED:DEPLOY -->[\s\S]*?<!-- END GENERATED:DEPLOY -->/, "");
    expect(outside(stamped)).toBe(outside(html));
  });

  test("fails loudly when the markers are gone", () => {
    expect(() => stampDocument("<html><head></head></html>", 82, "2026-08-29T12:05:00.000Z")).toThrow();
  });

  test("the tags it writes are the ones the page knows how to read", () => {
    // The generator and `deployStamp.js` agree on the two names, or the footer
    // silently falls back to "published from the main branch" on every page.
    const block = buildDeployBlock(82, "2026-08-29T12:05:00.000Z");
    const value = (name) => block.match(new RegExp(`name="${name}" content="([^"]*)"`))?.[1] ?? null;
    expect(parseStamp(value("deploy-pull-request"), value("deploy-date"))).toEqual({
      pr: 82,
      date: "2026-08-29T12:05:00.000Z",
    });
  });
});

describe("findStampedPages", () => {
  test("finds the pages that carry the marker", () => {
    const pages = findStampedPages();
    expect(pages.length).toBeGreaterThan(0);
    expect(pages).toContain(PAGE);
    for (const page of pages) expect(readFileSync(page, "utf8")).toContain("<!-- BEGIN GENERATED:DEPLOY -->");
  });
});

describe("the committed page", () => {
  // The placeholder is what a page carries between deploys. It must parse as
  // "no stamp", so a developer opening the file locally sees the honest
  // fallback rather than a made-up pull request number.
  test("holds a stamp the reader either accepts or ignores, never a wrong one", () => {
    const html = readFileSync(PAGE, "utf8");
    const value = (name) => html.match(new RegExp(`name="${name}" content="([^"]*)"`))?.[1] ?? null;
    const stamp = parseStamp(value("deploy-pull-request"), value("deploy-date"));
    if (stamp !== null) {
      expect(stamp.pr).toBeGreaterThan(0);
      expect(Number.isNaN(new Date(stamp.date).getTime())).toBe(false);
    }
  });
});
