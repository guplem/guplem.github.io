import { describe, expect, test } from "bun:test";
import {
  groupByLinkedIssue,
  isBlocked,
  normalizeRelationships,
  openBlockers,
  readRelationship,
} from "./relationships.js";

/** The shape GitHub's GraphQL answer has, cut down to what the board reads. */
const ANSWER = [
  {
    __typename: "Issue",
    id: "I_child",
    parent: {
      id: "I_parent",
      number: 4508,
      title: "Start a test case from an uploaded conversation history",
      url: "https://github.com/Galtea-AI/monorepo/issues/4508",
    },
    blockedBy: {
      nodes: [
        { id: "I_done", number: 4692, title: "Already done", state: "CLOSED", url: "u1" },
        { id: "I_waiting", number: 4700, title: "Still open", state: "OPEN", url: "u2" },
      ],
    },
    subIssuesSummary: { total: 14, completed: 12 },
    closedByPullRequestsReferences: {
      nodes: [{ id: "PR_a", number: 5093, title: "feat(api): upload a dataset", state: "OPEN", url: "u3" }],
    },
  },
  {
    __typename: "PullRequest",
    id: "PR_a",
    closingIssuesReferences: {
      nodes: [{ id: "I_child", number: 4693, title: "Upload a dataset", state: "OPEN", url: "u4" }],
    },
  },
];

describe("normalizeRelationships", () => {
  const byId = normalizeRelationships(ANSWER);

  test("reads the parent issue", () => {
    expect(readRelationship(byId, "I_child").parent).toMatchObject({ id: "I_parent", number: 4508 });
  });

  test("reads every blocker, with whether it is still open", () => {
    expect(readRelationship(byId, "I_child").blockedBy.map((one) => [one.number, one.state])).toEqual([
      [4692, "closed"],
      [4700, "open"],
    ]);
  });

  test("reads the pull requests that would close an issue, and the issues a pull request closes", () => {
    expect(readRelationship(byId, "I_child").closedBy.map((one) => one.id)).toEqual(["PR_a"]);
    expect(readRelationship(byId, "PR_a").closes.map((one) => one.id)).toEqual(["I_child"]);
  });

  test("reads how far a parent's children have got", () => {
    expect(readRelationship(byId, "I_child").subIssues).toEqual({ total: 14, completed: 12 });
  });

  // One unreadable node must not cost the relationships of every other item.
  test("never throws, whatever GitHub sends", () => {
    for (const junk of [null, undefined, "answer", [null, 7, {}, { id: "" }]]) {
      expect(() => normalizeRelationships(junk)).not.toThrow();
    }
    const partial = normalizeRelationships([null, { __typename: "Issue", id: "I_x" }]);
    expect(readRelationship(partial, "I_x")).toMatchObject({ parent: null, blockedBy: [], closedBy: [], closes: [] });
  });

  test("an item nobody asked about reads as empty, not as missing", () => {
    expect(readRelationship(byId, "never-seen")).toMatchObject({ parent: null, blockedBy: [] });
    expect(readRelationship(null, "I_child")).toMatchObject({ blockedBy: [] });
  });
});

describe("openBlockers and isBlocked", () => {
  const byId = normalizeRelationships(ANSWER);

  // A closed blocker is history. Counting it would mark half the board blocked
  // for ever, and the word would stop meaning anything.
  test("only a blocker that is still open blocks anything", () => {
    expect(openBlockers(readRelationship(byId, "I_child")).map((one) => one.number)).toEqual([4700]);
    expect(isBlocked(readRelationship(byId, "I_child"))).toBe(true);
  });

  test("nothing open means nothing blocked", () => {
    const clear = normalizeRelationships([
      { __typename: "Issue", id: "I_y", blockedBy: { nodes: [{ id: "a", number: 1, state: "CLOSED" }] } },
    ]);
    expect(isBlocked(readRelationship(clear, "I_y"))).toBe(false);
    expect(isBlocked(null)).toBe(false);
  });
});

describe("groupByLinkedIssue", () => {
  const byId = normalizeRelationships(ANSWER);
  const issue = { key: "I_child", kind: "issue", number: 4693 };
  const pull = { key: "PR_a", kind: "pull-request", number: 5093 };
  const other = { key: "PR_b", kind: "pull-request", number: 6000 };

  // The pull request and the issue it closes are one piece of work. Two cards
  // for it is the board telling you to do the same thing twice.
  test("puts a pull request under the issue it closes", () => {
    const groups = groupByLinkedIssue([issue, pull], byId);
    expect(groups.map((one) => one.item.key)).toEqual(["I_child"]);
    expect(groups[0].children.map((one) => one.key)).toEqual(["PR_a"]);
  });

  test("keeps a pull request on its own when its issue is not on the board", () => {
    const groups = groupByLinkedIssue([pull], byId);
    expect(groups.map((one) => one.item.key)).toEqual(["PR_a"]);
    expect(groups[0].children).toEqual([]);
  });

  test("keeps a pull request that closes nothing on its own", () => {
    expect(groupByLinkedIssue([other], byId).map((one) => one.item.key)).toEqual(["PR_b"]);
  });

  // The order the caller chose is the order the reader asked for.
  test("keeps the order it was given for the top level", () => {
    const groups = groupByLinkedIssue([other, issue, pull], byId);
    expect(groups.map((one) => one.item.key)).toEqual(["PR_b", "I_child"]);
  });

  test("survives being handed something that is not a list", () => {
    expect(groupByLinkedIssue(null, byId)).toEqual([]);
    expect(groupByLinkedIssue([issue], null)).toEqual([{ item: issue, children: [] }]);
  });
});
