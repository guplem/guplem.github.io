import { describe, expect, test } from "bun:test";
import { automaticColumn } from "./columns.js";
import {
  applyPullRequestState,
  askedToLookAgain,
  childIssueIds,
  groupByLinkedIssue,
  isBlocked,
  knowsAbout,
  normalizeRelationships,
  openBlockers,
  readChildIssue,
  readRelationship,
} from "./relationships.js";

/** Reviews and review requests in the shape GraphQL answers with. */
const reviews = (...pairs) => pairs.map(([login, state]) => ({ state, author: { login } }));
const requested = (...logins) => logins.map((login) => ({ requestedReviewer: login ? { login } : {} }));

describe("askedToLookAgain", () => {
  // The case this exists for, taken from a real pull request: GitHub shows
  // "Changes requested" and "Awaiting requested review from sergiromero-galtea"
  // at the same time, because a re-request does not clear the old verdict.
  test("the one reviewer who asked for changes was asked to look again", () => {
    expect(askedToLookAgain(reviews(["sergiromero-galtea", "CHANGES_REQUESTED"]), requested("sergiromero-galtea"))).toBe(
      true,
    );
  });

  test("nobody asked for changes, so there is nothing to answer", () => {
    expect(askedToLookAgain(reviews(["ana", "APPROVED"]), requested("ana"))).toBe(false);
    expect(askedToLookAgain([], requested("ana"))).toBe(false);
  });

  test("a different reviewer was asked, so the changes are still outstanding", () => {
    expect(askedToLookAgain(reviews(["ana", "CHANGES_REQUESTED"]), requested("bruno"))).toBe(false);
    expect(askedToLookAgain(reviews(["ana", "CHANGES_REQUESTED"]), [])).toBe(false);
  });

  // Two reviewers asking for changes is two people to satisfy. Answering one
  // of them and calling the work reviewed would hide the other's changes,
  // which is exactly the mistake this rule is meant to stop.
  test("every reviewer who asked for changes must be asked again, not just one", () => {
    const both = reviews(["ana", "CHANGES_REQUESTED"], ["bruno", "CHANGES_REQUESTED"]);
    expect(askedToLookAgain(both, requested("ana"))).toBe(false);
    expect(askedToLookAgain(both, requested("ana", "bruno"))).toBe(true);
  });

  // A team has a name and no login, so it can never be the person who asked
  // for changes. A review whose author is gone cannot be matched either.
  test("a team asked to review answers nobody, and a review with no author counts for nothing", () => {
    expect(askedToLookAgain(reviews(["ana", "CHANGES_REQUESTED"]), requested(null))).toBe(false);
    expect(askedToLookAgain([{ state: "CHANGES_REQUESTED", author: null }], requested("ana"))).toBe(false);
  });

  test("never throws, whatever it is handed", () => {
    expect(askedToLookAgain(null, null)).toBe(false);
    expect(askedToLookAgain("reviews", 7)).toBe(false);
    expect(askedToLookAgain([null, 7], [null, 7])).toBe(false);
  });
});

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
      nodes: [
        {
          id: "PR_a",
          number: 5093,
          title: "feat(api): upload a dataset",
          state: "OPEN",
          url: "u3",
          reviewDecision: "CHANGES_REQUESTED",
          reviewRequests: { totalCount: 1, nodes: [{ requestedReviewer: { login: "sergiromero-galtea" } }] },
          latestOpinionatedReviews: {
            nodes: [{ state: "CHANGES_REQUESTED", author: { login: "sergiromero-galtea" } }],
          },
        },
      ],
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
    expect(readRelationship(byId, "I_child").subIssues).toMatchObject({ total: 14, completed: 12 });
  });

  // The whole column rule for a pull request rides on these four, so they are
  // read off the linked pull request as well as off the pull request itself.
  test("reads the review state of a linked pull request, re-request included", () => {
    expect(readRelationship(byId, "I_child").closedBy[0]).toMatchObject({
      reviewDecision: "CHANGES_REQUESTED",
      reviewRequestCount: 1,
      askedAgain: true,
    });
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

describe("the people in a pull request's review (ADR 0028)", () => {
  const graph = (over) => [
    {
      __typename: "PullRequest",
      id: "PR_1",
      number: 1,
      state: "OPEN",
      repository: { nameWithOwner: "me/repo" },
      reviewRequests: { totalCount: 0, nodes: [] },
      latestOpinionatedReviews: { nodes: [] },
      closingIssuesReferences: { nodes: [] },
      ...over,
    },
  ];

  test("the reviewers reach the card, with their state", () => {
    const links = normalizeRelationships(
      graph({
        reviewRequests: { totalCount: 1, nodes: [{ requestedReviewer: { login: "ana", avatarUrl: "a" } }] },
        latestOpinionatedReviews: { nodes: [{ state: "CHANGES_REQUESTED", author: { login: "ivan", avatarUrl: "i" } }] },
      }),
    );
    const [item] = applyPullRequestState([{ key: "PR_1", kind: "pull-request" }], links);
    expect(item.reviewers.map((one) => [one.login, one.state])).toEqual([
      ["ivan", "changes-requested"],
      ["ana", "asked"],
    ]);
  });

  test("nobody in the review is an empty list, never undefined", () => {
    const links = normalizeRelationships(graph());
    const [item] = applyPullRequestState([{ key: "PR_1", kind: "pull-request" }], links);
    expect(item.reviewers).toEqual([]);
  });

  // An issue has no review, and the board must not invent one for it.
  test("an issue is left alone", () => {
    const [item] = applyPullRequestState([{ key: "I_1", kind: "issue" }], {});
    expect(item.reviewers).toBe(undefined);
  });
});

// A card that has children lists them, and each one carries the column it
// would sit in. That column is worked out by the same rule every card uses, so
// a child has to arrive in the shape that rule reads (ADR 0010, ADR 0011).
describe("the children of an issue", () => {
  const WITH_CHILDREN = [
    {
      __typename: "Issue",
      id: "I_parent",
      subIssuesSummary: { total: 3, completed: 1 },
      subIssues: {
        totalCount: 3,
        nodes: [
          {
            id: "I_one",
            number: 11,
            title: "Read the file",
            url: "https://github.com/me/work/issues/11",
            state: "CLOSED",
            closedAt: "2026-09-22T08:00:00Z",
            repository: { nameWithOwner: "me/work" },
          },
          {
            id: "I_two",
            number: 12,
            title: "Write the file",
            url: "https://github.com/me/work/issues/12",
            state: "OPEN",
            closedAt: null,
            repository: { nameWithOwner: "me/work" },
          },
        ],
      },
    },
  ];

  const byId = normalizeRelationships(WITH_CHILDREN);

  test("every child GitHub answered with is on the parent", () => {
    expect(readRelationship(byId, "I_parent").subIssues.children.map((one) => one.number)).toEqual([11, 12]);
  });

  // The summary is the count of every child; the list is only the ones asked
  // for. A parent with more children than the query asks for still says how
  // many there are.
  test("the count comes from the summary, not from the length of the list", () => {
    expect(readRelationship(byId, "I_parent").subIssues).toMatchObject({ total: 3, completed: 1 });
    expect(readRelationship(byId, "I_parent").subIssues.children.length).toBe(2);
  });

  test("a card with no children says so, and never answers undefined", () => {
    expect(readRelationship(byId, "I_nobody").subIssues).toEqual({ total: 0, completed: 0, children: [] });
  });

  // The shape the column rule reads. A child arriving as a link, the shape the
  // parent and the blockers use, would have no `kind` and no `closedAt`, and
  // every closed child would read as unfinished.
  test("a child is a work item, so the column rule can read it", () => {
    const [closed, open] = readRelationship(byId, "I_parent").subIssues.children;
    expect(closed).toMatchObject({
      key: "I_one",
      kind: "issue",
      number: 11,
      title: "Read the file",
      url: "https://github.com/me/work/issues/11",
      repository: "me/work",
      state: "closed",
      closedAt: "2026-09-22T08:00:00Z",
    });
    expect(open).toMatchObject({ key: "I_two", state: "open", closedAt: "" });
  });

  test("the column rule answers for a child", () => {
    const [closed, open] = readRelationship(byId, "I_parent").subIssues.children;
    expect(automaticColumn(closed, null)).toBe("done");
    expect(automaticColumn(open, null)).toBe("todo");
  });

  test("never throws, whatever GitHub answers", () => {
    expect(readChildIssue(null)).toBe(null);
    expect(readChildIssue({ number: 7 })).toBe(null);
    expect(normalizeRelationships([{ __typename: "Issue", id: "I_x", subIssues: { nodes: [7, null] } }])).toMatchObject({
      I_x: { subIssues: { children: [] } },
    });
  });
});

// The board asks again about the children it has just heard of, so a child
// gets the same reading as any other card: the pull requests that would close
// it, and whether their reviewers have been asked to look again (ADR 0010).
describe("childIssueIds", () => {
  test("names every child in the answer, once each", () => {
    const nodes = [
      { __typename: "Issue", id: "I_a", subIssues: { nodes: [{ id: "I_one" }, { id: "I_two" }] } },
      { __typename: "Issue", id: "I_b", subIssues: { nodes: [{ id: "I_two" }] } },
      { __typename: "Issue", id: "I_c" },
    ];
    expect(childIssueIds(nodes)).toEqual(["I_one", "I_two"]);
  });

  test("never throws, whatever GitHub answers", () => {
    expect(childIssueIds(null)).toEqual([]);
    expect(childIssueIds([null, 7, { subIssues: { nodes: [{}, { id: "" }] } }])).toEqual([]);
  });
});

// "Nobody asked" and "nothing to say" are different answers, and only one of
// them may become a state on the screen (ADR 0010).
describe("knowsAbout", () => {
  const byId = normalizeRelationships([{ __typename: "Issue", id: "I_asked" }]);

  test("says whether GitHub was asked about this item", () => {
    expect(knowsAbout(byId, "I_asked")).toBe(true);
    expect(knowsAbout(byId, "I_never")).toBe(false);
  });

  test("never throws, whatever it is handed", () => {
    expect(knowsAbout(null, "I_asked")).toBe(false);
    expect(knowsAbout(byId, undefined)).toBe(false);
  });
});
