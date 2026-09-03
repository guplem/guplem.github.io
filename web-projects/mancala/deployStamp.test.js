// Tests for the "deployed at" line.
//
// The line is read from the page's own `<head>`, so there is no network, no
// cache and nothing to stub but a `querySelector`. That is the point of the
// design: the two bugs this replaced both came from an answer that could
// describe a different version of the site than the one being read.

import { describe, expect, test } from "bun:test";
import { DEPLOY_MESSAGES, escapeHtml, say } from "./deployText.js";
import {
  DATE_META,
  PULL_META,
  buildHistoryUrl,
  buildPullUrl,
  formatDeployDate,
  parseStamp,
  readStamp,
  renderDeployLine,
} from "./deployStamp.js";

const PATH = "web-projects/mancala";

/** The real catalogue and the real escaper, so a renamed key fails here too. */
const escape = escapeHtml;
const stubElement = () => ({ innerHTML: "" });

/** Just enough of a document for `readStamp` to work against. */
const stubDocument = (tags) => ({
  querySelector: (selector) => {
    const name = selector.match(/name="([^"]+)"/)?.[1];
    return name in tags ? { getAttribute: () => tags[name] } : null;
  },
});

describe("parseStamp", () => {
  test("accepts a whole positive number and a readable date", () => {
    expect(parseStamp("82", "2026-08-29T12:05:00Z")).toEqual({ pr: 82, date: "2026-08-29T12:05:00Z" });
  });

  test("rejects the placeholder a never-stamped page carries", () => {
    // index.html holds `0` until a pull request stamps it, so this is the state
    // of the file in the repository between deploys.
    expect(parseStamp("0", "1970-01-01T00:00:00.000Z")).toBeNull();
  });

  test("rejects anything that is not a stamp", () => {
    for (const [pull, date] of [
      [null, "2026-08-29T12:05:00Z"],
      ["82", null],
      ["", ""],
      ["not a number", "2026-08-29T12:05:00Z"],
      ["-4", "2026-08-29T12:05:00Z"],
      ["8.5", "2026-08-29T12:05:00Z"],
      ["82", "not a date"],
    ]) {
      expect(`${pull}/${date}: ${JSON.stringify(parseStamp(pull, date))}`).toBe(`${pull}/${date}: null`);
    }
  });
});

describe("readStamp", () => {
  test("reads the two meta tags the generator writes", () => {
    const stamp = readStamp(stubDocument({ [PULL_META]: "82", [DATE_META]: "2026-08-29T12:05:00Z" }));
    expect(stamp).toEqual({ pr: 82, date: "2026-08-29T12:05:00Z" });
  });

  test("returns nothing when the page carries no stamp", () => {
    expect(readStamp(stubDocument({}))).toBeNull();
    expect(readStamp(stubDocument({ [PULL_META]: "82" }))).toBeNull();
  });
});

describe("urls", () => {
  test("points at the pull request and at the folder's history", () => {
    expect(buildPullUrl({ pr: 82 })).toBe("https://github.com/guplem/guplem.github.io/pull/82");
    expect(buildHistoryUrl({ path: PATH })).toBe(`https://github.com/guplem/guplem.github.io/commits/main/${PATH}`);
  });
});

describe("formatDeployDate", () => {
  test("writes the moment for a reader of that language", () => {
    expect(formatDeployDate("2026-08-29T12:05:00Z", "en")).toContain("2026");
    expect(formatDeployDate("2026-08-29T12:05:00Z", "es")).toContain("2026");
    expect(formatDeployDate("2026-08-29T12:05:00Z", "es")).not.toBe(formatDeployDate("2026-08-29T12:05:00Z", "en"));
  });

  test("gives nothing back for a moment it cannot read", () => {
    expect(formatDeployDate("not a date")).toBe("");
  });
});

describe("renderDeployLine", () => {
  const STAMP = { pr: 82, date: "2026-08-29T12:05:00Z" };

  test("names the pull request and links it", () => {
    const element = stubElement();
    renderDeployLine(element, STAMP, "en", say, escape, PATH);
    expect(element.innerHTML).toContain(">#82<");
    expect(element.innerHTML).toContain("https://github.com/guplem/guplem.github.io/pull/82");
    expect(element.innerHTML).toContain("2026");
  });

  test("names every message the line can show", () => {
    for (const key of ["ui.deployed", "ui.deployedUnknown", "ui.deployHistory"]) {
      expect(DEPLOY_MESSAGES[key]).toBeString();
    }
  });

  // A player once reported the line as missing when it was merely empty. An
  // unstamped page must still say something and still lead somewhere.
  test("still says something when the page carries no stamp", () => {
    const element = stubElement();
    renderDeployLine(element, null, "en", say, escape, PATH);
    expect(element.innerHTML.length).toBeGreaterThan(0);
    expect(element.innerHTML).toContain(`/commits/main/${PATH}`);
  });

  test("does nothing without an element, rather than throwing", () => {
    expect(() => renderDeployLine(null, null, "en", say, escape, PATH)).not.toThrow();
  });

  test("leaves no raw message key and no unfilled slot on the page", () => {
    for (const stamp of [STAMP, null]) {
      const element = stubElement();
      renderDeployLine(element, stamp, "en", say, escape, PATH);
      expect(element.innerHTML).not.toContain("ui.");
      expect(element.innerHTML).not.toContain("{");
    }
  });
});
