import { describe, expect, test } from "bun:test";
import { countByKind, normalizeWorkItem, normalizeWorkItems, ownersOf } from "./workItems.js";

const RAW_ISSUE = {
  id: 2312,
  node_id: "I_kwDOAbCdEf4AbCdE",
  number: 42,
  title: "The board forgets the note on reload",
  state: "open",
  html_url: "https://github.com/guplem/guplem.github.io/issues/42",
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-17T09:00:00Z",
  repository: { full_name: "guplem/guplem.github.io" },
  labels: [{ name: "bug", color: "d73a4a" }],
};

const RAW_PULL = {
  ...RAW_ISSUE,
  node_id: "PR_kwDOAbCdEf4AbCdE",
  number: 43,
  title: "Sort the board",
  html_url: "https://github.com/guplem/guplem.github.io/pull/43",
  draft: true,
  pull_request: { url: "https://api.github.com/repos/guplem/guplem.github.io/pulls/43", merged_at: null },
};

describe("normalizeWorkItem", () => {
  // The key is the node id, not "repo#number". An item moved to another
  // repository keeps its node id, so the note written against it follows it.
  test("keys the item by its permanent node id", () => {
    expect(normalizeWorkItem(RAW_ISSUE).key).toBe("I_kwDOAbCdEf4AbCdE");
  });

  test("reads the fields the board shows", () => {
    expect(normalizeWorkItem(RAW_ISSUE)).toMatchObject({
      kind: "issue",
      number: 42,
      title: "The board forgets the note on reload",
      repository: "guplem/guplem.github.io",
      url: "https://github.com/guplem/guplem.github.io/issues/42",
      state: "open",
      createdAt: "2026-09-01T08:00:00Z",
      updatedAt: "2026-09-17T09:00:00Z",
      labels: [{ name: "bug", color: "d73a4a" }],
    });
  });

  // GitHub's issues endpoint answers with pull requests mixed in, marked only
  // by a `pull_request` field. The board shows both, and says which is which.
  test("tells a pull request from an issue by the field GitHub marks it with", () => {
    expect(normalizeWorkItem(RAW_PULL).kind).toBe("pull-request");
    expect(normalizeWorkItem(RAW_ISSUE).kind).toBe("issue");
  });

  test("reads whether a pull request is still a draft", () => {
    expect(normalizeWorkItem(RAW_PULL).isDraft).toBe(true);
    expect(normalizeWorkItem({ ...RAW_PULL, draft: false }).isDraft).toBe(false);
    expect(normalizeWorkItem(RAW_ISSUE).isDraft).toBe(false);
  });

  test("refuses anything without a node id, rather than inventing one", () => {
    expect(normalizeWorkItem({ ...RAW_ISSUE, node_id: undefined })).toBeNull();
    expect(normalizeWorkItem(null)).toBeNull();
    expect(normalizeWorkItem("issue")).toBeNull();
  });

  test("survives a missing label list, repository and dates", () => {
    const thin = normalizeWorkItem({ node_id: "I_x", number: 1, title: "t", html_url: "u" });
    expect(thin.labels).toEqual([]);
    expect(thin.repository).toBe("");
    expect(thin.createdAt).toBe("");
    expect(thin.updatedAt).toBe("");
  });

  test("drops a label that is not a readable label", () => {
    expect(normalizeWorkItem({ ...RAW_ISSUE, labels: ["bug", null, { name: "ok", color: "fff" }] }).labels).toEqual([
      { name: "ok", color: "fff" },
    ]);
  });
});

describe("normalizeWorkItems", () => {
  test("keeps both kinds", () => {
    const list = normalizeWorkItems([RAW_ISSUE, RAW_PULL]);
    expect(list.map((item) => item.kind)).toEqual(["issue", "pull-request"]);
  });

  test("drops unreadable entries and always answers with an array", () => {
    expect(normalizeWorkItems([RAW_ISSUE, null, 7, {}]).length).toBe(1);
    expect(normalizeWorkItems(null)).toEqual([]);
    expect(normalizeWorkItems({ message: "Bad credentials" })).toEqual([]);
  });

  test("keeps only the first of a repeated node id", () => {
    expect(normalizeWorkItems([RAW_ISSUE, { ...RAW_ISSUE, title: "a second copy" }]).length).toBe(1);
  });
});

describe("countByKind", () => {
  test("counts each kind, so the page can say what the list holds", () => {
    expect(countByKind(normalizeWorkItems([RAW_ISSUE, RAW_PULL, { ...RAW_PULL, node_id: "PR_2" }]))).toEqual({
      issues: 1,
      pullRequests: 2,
    });
  });

  test("counts nothing without throwing", () => {
    expect(countByKind([])).toEqual({ issues: 0, pullRequests: 0 });
    expect(countByKind(null)).toEqual({ issues: 0, pullRequests: 0 });
  });
});

describe("ownersOf", () => {
  // Where a token found work. It is the board's suggestion for that token's
  // name, which the reader can then change (ADR 0007).
  test("takes the owner out of each full name, once each, in a readable order", () => {
    expect(ownersOf(["guplem/site", "Galtea-AI/monorepo", "guplem/other"])).toEqual(["Galtea-AI", "guplem"]);
  });

  test("survives a name with no owner in it", () => {
    expect(ownersOf(["", "no-slash", "me/a"])).toEqual(["me"]);
    expect(ownersOf(null)).toEqual([]);
  });
});
