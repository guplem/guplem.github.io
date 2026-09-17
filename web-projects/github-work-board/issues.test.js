import { describe, expect, test } from "bun:test";
import { normalizeIssue, normalizeIssues, sortByRecentActivity } from "./issues.js";

const RAW = {
  id: 2312,
  node_id: "I_kwDOAbCdEf4AbCdE",
  number: 42,
  title: "The board forgets the note on reload",
  state: "open",
  html_url: "https://github.com/guplem/guplem.github.io/issues/42",
  updated_at: "2026-09-17T09:00:00Z",
  repository: { full_name: "guplem/guplem.github.io" },
  labels: [{ name: "bug", color: "d73a4a" }],
};

describe("normalizeIssue", () => {
  // The key is the node id, not "repo#number". An issue moved to another
  // repository keeps its node id, so the note written against it follows it.
  test("keys the issue by its permanent node id", () => {
    expect(normalizeIssue(RAW).key).toBe("I_kwDOAbCdEf4AbCdE");
  });

  test("reads the fields the board shows", () => {
    expect(normalizeIssue(RAW)).toMatchObject({
      number: 42,
      title: "The board forgets the note on reload",
      repository: "guplem/guplem.github.io",
      url: "https://github.com/guplem/guplem.github.io/issues/42",
      state: "open",
      updatedAt: "2026-09-17T09:00:00Z",
      labels: [{ name: "bug", color: "d73a4a" }],
    });
  });

  test("refuses anything without a node id, rather than inventing one", () => {
    expect(normalizeIssue({ ...RAW, node_id: undefined })).toBeNull();
    expect(normalizeIssue(null)).toBeNull();
    expect(normalizeIssue("issue")).toBeNull();
  });

  test("survives a missing label list and a missing repository", () => {
    const thin = normalizeIssue({ node_id: "I_x", number: 1, title: "t", html_url: "u" });
    expect(thin.labels).toEqual([]);
    expect(thin.repository).toBe("");
  });

  test("drops a label that is not a readable label", () => {
    expect(normalizeIssue({ ...RAW, labels: ["bug", null, { name: "ok", color: "fff" }] }).labels).toEqual([
      { name: "ok", color: "fff" },
    ]);
  });
});

describe("normalizeIssues", () => {
  // GET /issues answers with pull requests too. A board that shows them turns
  // every review into a card the person never asked for.
  test("drops pull requests, which the issues endpoint mixes in", () => {
    const list = normalizeIssues([RAW, { ...RAW, node_id: "PR_1", pull_request: { url: "..." } }]);
    expect(list.map((item) => item.key)).toEqual(["I_kwDOAbCdEf4AbCdE"]);
  });

  test("drops unreadable entries and always answers with an array", () => {
    expect(normalizeIssues([RAW, null, 7, {}]).length).toBe(1);
    expect(normalizeIssues(null)).toEqual([]);
    expect(normalizeIssues({ message: "Bad credentials" })).toEqual([]);
  });

  test("keeps only the first of a repeated node id", () => {
    expect(normalizeIssues([RAW, { ...RAW, title: "a second copy" }]).length).toBe(1);
  });
});

describe("sortByRecentActivity", () => {
  test("puts the most recently touched issue first", () => {
    const older = { key: "a", updatedAt: "2026-09-01T00:00:00Z" };
    const newer = { key: "b", updatedAt: "2026-09-16T00:00:00Z" };
    expect(sortByRecentActivity([older, newer]).map((item) => item.key)).toEqual(["b", "a"]);
  });

  test("does not reorder the list it was given", () => {
    const list = [
      { key: "a", updatedAt: "2026-09-01T00:00:00Z" },
      { key: "b", updatedAt: "2026-09-16T00:00:00Z" },
    ];
    sortByRecentActivity(list);
    expect(list.map((item) => item.key)).toEqual(["a", "b"]);
  });

  test("puts an issue with no date last instead of throwing", () => {
    const dated = { key: "a", updatedAt: "2026-09-01T00:00:00Z" };
    expect(sortByRecentActivity([{ key: "b" }, dated]).map((item) => item.key)).toEqual(["a", "b"]);
  });
});
