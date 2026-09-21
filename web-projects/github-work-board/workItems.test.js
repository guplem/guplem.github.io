import { describe, expect, test } from "bun:test";
import {
  countByKind,
  finishedAt,
  finishedSince,
  normalizeWorkItem,
  normalizeWorkItems,
  ownersOf,
  uniqueByKey,
  startOfToday,
  withoutItems,
} from "./workItems.js";

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

describe("the repository of a searched item", () => {
  // The search endpoint answers with an API address and no repository object.
  // Reading only `repository.full_name` leaves every review card unlabelled.
  test("is read from the API address when there is no repository object", () => {
    expect(
      normalizeWorkItem({ node_id: "PR_x", repository_url: "https://api.github.com/repos/Galtea-AI/monorepo" })
        .repository,
    ).toBe("Galtea-AI/monorepo");
  });

  test("prefers the repository object when both are there", () => {
    expect(
      normalizeWorkItem({
        node_id: "PR_x",
        repository: { full_name: "me/real" },
        repository_url: "https://api.github.com/repos/me/other",
      }).repository,
    ).toBe("me/real");
  });

  test("is empty rather than wrong when the address is not one", () => {
    expect(normalizeWorkItem({ node_id: "PR_x", repository_url: "nonsense" }).repository).toBe("");
    expect(normalizeWorkItem({ node_id: "PR_x", repository_url: 7 }).repository).toBe("");
  });
});

describe("uniqueByKey", () => {
  // Every token is asked on its own and the answers are merged. Two tokens
  // that both reach one repository answer with the same work, and the merge
  // is the only place that can notice.
  test("keeps the first of anything seen twice", () => {
    const one = { key: "PR_1", number: 1 };
    const again = { key: "PR_1", number: 1 };
    const other = { key: "PR_2", number: 2 };
    expect(uniqueByKey([one, again, other])).toEqual([one, other]);
  });

  test("never throws, whatever it is handed", () => {
    expect(uniqueByKey(null)).toEqual([]);
    expect(uniqueByKey([null, 7, { key: "a" }])).toEqual([{ key: "a" }]);
  });
});

describe("withoutItems", () => {
  const a = { key: "a" };
  const b = { key: "b" };

  // A pull request can be assigned to you and waiting for your review at once.
  // The board is the place that can move it, so the board keeps it.
  test("drops what the board already holds", () => {
    expect(withoutItems([a, b], [a]).map((one) => one.key)).toEqual(["b"]);
  });

  test("keeps everything when the board holds nothing", () => {
    expect(withoutItems([a, b], []).map((one) => one.key)).toEqual(["a", "b"]);
    expect(withoutItems([a, b], null).map((one) => one.key)).toEqual(["a", "b"]);
  });

  test("survives being handed nothing", () => {
    expect(withoutItems(null, [a])).toEqual([]);
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

describe("finishedAt", () => {
  // Work is finished when it landed, and only then. A pull request closed
  // without merging is abandoned, not done: putting it in "Done today" would
  // report work that never shipped (ADR 0011).
  test("a merged pull request is finished, the moment it merged", () => {
    const merged = normalizeWorkItem({
      node_id: "PR_1",
      number: 169,
      pull_request: { merged_at: "2026-09-21T12:34:59Z" },
      state: "closed",
      closed_at: "2026-09-21T12:34:59Z",
    });
    expect(finishedAt(merged)).toBe("2026-09-21T12:34:59Z");
  });

  test("a pull request closed without merging is not finished", () => {
    const abandoned = normalizeWorkItem({
      node_id: "PR_2",
      number: 170,
      pull_request: { merged_at: null },
      state: "closed",
      closed_at: "2026-09-21T12:00:00Z",
    });
    expect(finishedAt(abandoned)).toBe("");
  });

  test("a closed issue is finished, an open one is not", () => {
    const closed = normalizeWorkItem({ node_id: "I_1", number: 1, state: "closed", closed_at: "2026-09-21T08:00:00Z" });
    const open = normalizeWorkItem({ node_id: "I_2", number: 2, state: "open" });
    expect(finishedAt(closed)).toBe("2026-09-21T08:00:00Z");
    expect(finishedAt(open)).toBe("");
  });

  test("never throws, whatever it is handed", () => {
    expect(finishedAt(null)).toBe("");
    expect(finishedAt({ kind: "pull-request" })).toBe("");
    expect(finishedAt(7)).toBe("");
  });
});

describe("finishedSince", () => {
  const merged = (number, when) =>
    normalizeWorkItem({ node_id: `PR_${number}`, number, pull_request: { merged_at: when }, state: "closed" });

  // GitHub's `since` filters on when a thing was last touched, not on when it
  // was finished, so it answers with work closed months ago that somebody
  // commented on this morning. This is the filter that makes the answer true.
  test("keeps only what was finished at or after the moment asked for", () => {
    const list = [merged(1, "2026-09-21T09:00:00Z"), merged(2, "2026-08-01T09:00:00Z")];
    expect(finishedSince(list, "2026-09-21T00:00:00Z").map((one) => one.number)).toEqual([1]);
  });

  test("keeps something finished exactly on the boundary", () => {
    expect(finishedSince([merged(1, "2026-09-21T00:00:00Z")], "2026-09-21T00:00:00Z")).toHaveLength(1);
  });

  test("drops anything unfinished, whatever its dates say", () => {
    const abandoned = normalizeWorkItem({
      node_id: "PR_9",
      number: 9,
      pull_request: { merged_at: null },
      state: "closed",
      closed_at: "2026-09-21T09:00:00Z",
    });
    expect(finishedSince([abandoned], "2026-09-21T00:00:00Z")).toEqual([]);
  });

  test("never throws, whatever it is handed", () => {
    expect(finishedSince(null, "2026-09-21T00:00:00Z")).toEqual([]);
    expect(finishedSince([merged(1, "2026-09-21T09:00:00Z")], "not a date")).toEqual([]);
  });
});

describe("startOfToday", () => {
  // Today is the reader's today, in the clock on their wall, not UTC. A board
  // opened at 00:30 in Barcelona must not still be showing yesterday.
  test("is midnight of the day it is handed, in the reader's own clock", () => {
    const middleOfDay = new Date(2026, 8, 21, 14, 30, 0);
    const midnight = new Date(startOfToday(middleOfDay));
    expect(midnight.getFullYear()).toBe(2026);
    expect(midnight.getMonth()).toBe(8);
    expect(midnight.getDate()).toBe(21);
    expect(midnight.getHours()).toBe(0);
    expect(midnight.getMinutes()).toBe(0);
  });

  test("is never after the moment it was asked about", () => {
    const now = new Date(2026, 8, 21, 0, 0, 1);
    expect(Date.parse(startOfToday(now))).toBeLessThanOrEqual(now.getTime());
  });
});
