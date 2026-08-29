import { describe, test, expect } from "bun:test";
import {
  CACHE_TTL_MS,
  DEFAULT_REPO,
  buildCommitsUrl,
  buildPullsUrl,
  deployRecord,
  formatDeployDate,
  isFresh,
  parseLatestCommit,
  parseMergedPull,
} from "./deployInfo.js";

// Trimmed from real GitHub API responses for this repository, so the parsing is
// checked against the shape the service really sends.
const COMMITS_PAYLOAD = [
  {
    sha: "afa4c5c751fcbc6b4213402001d4319a581d7c13",
    html_url: "https://github.com/guplem/guplem.github.io/commit/afa4c5c751fcbc6b4213402001d4319a581d7c13",
    commit: {
      message: "fix: share one candidate state between the grid and the coach",
      author: { name: "Claude", date: "2026-08-29T09:39:34Z" },
      committer: { name: "Claude", date: "2026-08-29T09:39:34Z" },
    },
  },
];

const PULLS_PAYLOAD = [
  {
    number: 75,
    title: "fix: share one candidate state between the grid and the coach",
    html_url: "https://github.com/guplem/guplem.github.io/pull/75",
    state: "closed",
    merged_at: "2026-08-29T09:40:32Z",
  },
];

describe("buildCommitsUrl", () => {
  test("asks for the newest commit on the branch that touched the path", () => {
    const url = buildCommitsUrl({ path: "web-projects/sudoku-screenshot-coach" });
    expect(url.startsWith(`https://api.github.com/repos/${DEFAULT_REPO}/commits?`)).toBe(true);
    const query = new URLSearchParams(url.split("?")[1]);
    expect(query.get("path")).toBe("web-projects/sudoku-screenshot-coach");
    expect(query.get("sha")).toBe("main");
    expect(query.get("per_page")).toBe("1");
  });

  test("escapes a path that needs it", () => {
    const url = buildCommitsUrl({ path: "web-projects/a b" });
    expect(new URLSearchParams(url.split("?")[1]).get("path")).toBe("web-projects/a b");
  });
});

describe("buildPullsUrl", () => {
  test("asks for the pull requests that carried a commit", () => {
    expect(buildPullsUrl({ sha: "abc123" })).toBe(`https://api.github.com/repos/${DEFAULT_REPO}/commits/abc123/pulls`);
  });
});

describe("parseLatestCommit", () => {
  test("reads the commit out of a real response", () => {
    const commit = parseLatestCommit(COMMITS_PAYLOAD);
    expect(commit.sha).toBe("afa4c5c751fcbc6b4213402001d4319a581d7c13");
    expect(commit.shortSha).toBe("afa4c5c");
    expect(commit.date).toBe("2026-08-29T09:39:34Z");
    expect(commit.url).toContain("/commit/afa4c5c7");
  });

  test("falls back to the author date when there is no committer date", () => {
    const payload = [{ sha: "a".repeat(40), commit: { author: { date: "2026-01-02T03:04:05Z" } } }];
    expect(parseLatestCommit(payload).date).toBe("2026-01-02T03:04:05Z");
  });

  test("returns nothing for an empty or broken response", () => {
    expect(parseLatestCommit([])).toBeNull();
    expect(parseLatestCommit(null)).toBeNull();
    expect(parseLatestCommit({ message: "API rate limit exceeded" })).toBeNull();
    expect(parseLatestCommit([{ sha: "abc" }])).toBeNull(); // no date
  });
});

describe("parseMergedPull", () => {
  test("reads the pull request out of a real response", () => {
    const pull = parseMergedPull(PULLS_PAYLOAD);
    expect(pull.number).toBe(75);
    expect(pull.mergedAt).toBe("2026-08-29T09:40:32Z");
    expect(pull.url).toBe("https://github.com/guplem/guplem.github.io/pull/75");
    expect(pull.title).toContain("candidate state");
  });

  test("ignores a pull request that never merged", () => {
    expect(parseMergedPull([{ number: 9, merged_at: null, html_url: "x" }])).toBeNull();
  });

  test("takes the first one to merge when a commit rode in several", () => {
    const pull = parseMergedPull([
      { number: 20, merged_at: "2026-03-02T00:00:00Z", html_url: "b" },
      { number: 10, merged_at: "2026-03-01T00:00:00Z", html_url: "a" },
    ]);
    expect(pull.number).toBe(10);
  });

  test("returns nothing for an empty or broken response", () => {
    expect(parseMergedPull([])).toBeNull();
    expect(parseMergedPull(null)).toBeNull();
    expect(parseMergedPull({ message: "Not Found" })).toBeNull();
  });
});

describe("deployRecord", () => {
  test("uses the merge time, because merging is what publishes the site", () => {
    const record = deployRecord(parseLatestCommit(COMMITS_PAYLOAD), parseMergedPull(PULLS_PAYLOAD));
    expect(record.date).toBe("2026-08-29T09:40:32Z"); // the merge, not the commit
    expect(record.pull.number).toBe(75);
  });

  test("falls back to the commit date when no pull request carried it", () => {
    const record = deployRecord(parseLatestCommit(COMMITS_PAYLOAD), null);
    expect(record.date).toBe("2026-08-29T09:39:34Z");
    expect(record.pull).toBeNull();
  });

  test("returns nothing without a commit", () => {
    expect(deployRecord(null, parseMergedPull(PULLS_PAYLOAD))).toBeNull();
  });
});

describe("formatDeployDate", () => {
  test("writes the moment in the language asked for", () => {
    const english = formatDeployDate("2026-08-29T09:40:32Z", "en");
    const spanish = formatDeployDate("2026-08-29T09:40:32Z", "es");
    expect(english).toContain("2026");
    expect(spanish).toContain("2026");
    expect(english.length).toBeGreaterThan(8);
    // The two languages do not name a month the same way.
    expect(english).not.toBe(spanish);
  });

  test("returns nothing for a date it cannot read", () => {
    expect(formatDeployDate("not a date")).toBe("");
    expect(formatDeployDate(undefined)).toBe("");
  });

  test("survives a language tag the browser does not know", () => {
    expect(formatDeployDate("2026-08-29T09:40:32Z", "zz-ZZ-nonsense").length).toBeGreaterThan(0);
  });
});

describe("isFresh", () => {
  test("holds a lookup for the cache window and no longer", () => {
    const entry = { fetchedAt: 1_000_000 };
    expect(isFresh(entry, 1_000_000)).toBe(true);
    expect(isFresh(entry, 1_000_000 + CACHE_TTL_MS - 1)).toBe(true);
    expect(isFresh(entry, 1_000_000 + CACHE_TTL_MS)).toBe(false);
  });

  test("treats a missing or broken entry as stale", () => {
    expect(isFresh(null)).toBe(false);
    expect(isFresh({})).toBe(false);
    expect(isFresh({ fetchedAt: "yesterday" })).toBe(false);
  });
});
