import { describe, expect, test } from "bun:test";
import {
  AUTOMATIC,
  COLUMNS,
  automaticColumn,
  columnFor,
  groupIntoColumns,
  moveOptions,
  readColumnId,
} from "./columns.js";

const issue = (over = {}) => ({ key: "I_1", kind: "issue", number: 1, ...over });
const pull = (over = {}) => ({ key: "PR_1", kind: "pull-request", number: 2, ...over });

/** A linked pull request as `relationships.js` reads it. */
const linkedPull = (over = {}) => ({
  id: "PR_1",
  number: 2,
  title: "the work",
  url: "u",
  state: "open",
  merged: false,
  reviewDecision: "",
  reviewRequestCount: 0,
  ...over,
});

const links = (closedBy = []) => ({ closedBy, closes: [], blockedBy: [], parent: null });

describe("COLUMNS", () => {
  // The order on screen. "Needs changes" sits beside "Ongoing" because it is
  // the same activity: a reviewer asking for changes sends the work back to
  // being written.
  test("they read left to right in the order work travels", () => {
    expect(COLUMNS.map((one) => one.id)).toEqual([
      "todo",
      "ongoing",
      "needs-changes",
      "awaiting-review",
      "ready-to-merge",
      "done",
    ]);
  });

  test("every column has something to put at the top of it", () => {
    for (const column of COLUMNS) expect(column.label.length).toBeGreaterThan(0);
  });
});

describe("readColumnId", () => {
  test("keeps a column the board knows", () => {
    expect(readColumnId("done")).toBe("done");
  });

  test("anything else means automatic", () => {
    expect(readColumnId("in-progress")).toBe(AUTOMATIC);
    expect(readColumnId("")).toBe(AUTOMATIC);
    expect(readColumnId(null)).toBe(AUTOMATIC);
    expect(readColumnId(7)).toBe(AUTOMATIC);
  });
});

describe("automaticColumn", () => {
  test("an issue with no pull request is still to do", () => {
    expect(automaticColumn(issue(), links())).toBe("todo");
  });

  test("a pull request with nobody asked to review it is ongoing", () => {
    expect(automaticColumn(issue(), links([linkedPull()]))).toBe("ongoing");
  });

  test("a reviewer asked and no verdict yet is awaiting review", () => {
    expect(automaticColumn(issue(), links([linkedPull({ reviewRequestCount: 1 })]))).toBe("awaiting-review");
    expect(automaticColumn(issue(), links([linkedPull({ reviewDecision: "REVIEW_REQUIRED" })]))).toBe(
      "awaiting-review",
    );
  });

  test("an approval is ready to merge", () => {
    expect(automaticColumn(issue(), links([linkedPull({ reviewDecision: "APPROVED" })]))).toBe("ready-to-merge");
  });

  test("changes requested needs changes", () => {
    expect(automaticColumn(issue(), links([linkedPull({ reviewDecision: "CHANGES_REQUESTED" })]))).toBe(
      "needs-changes",
    );
  });

  test("a merged pull request is done", () => {
    expect(automaticColumn(issue(), links([linkedPull({ merged: true, state: "closed" })]))).toBe("done");
  });

  // GitHub leaves the verdict at "changes requested" for ever: asking the same
  // reviewer to look again does not clear it. So the verdict alone parks
  // finished work in "Needs changes", which is the one place a person looks to
  // find work that is theirs. `askedAgain` is what says the ball moved back.
  test("changes requested, then the same reviewer asked again, is awaiting review", () => {
    const answered = linkedPull({ reviewDecision: "CHANGES_REQUESTED", reviewRequestCount: 1, askedAgain: true });
    expect(automaticColumn(issue(), links([answered]))).toBe("awaiting-review");
    expect(automaticColumn(pull({ ...answered, key: "PR_1" }), null)).toBe("awaiting-review");
  });

  test("changes requested with nobody asked again stays in needs changes", () => {
    const waiting = linkedPull({ reviewDecision: "CHANGES_REQUESTED", reviewRequestCount: 1, askedAgain: false });
    expect(automaticColumn(issue(), links([waiting]))).toBe("needs-changes");
  });

  // Somebody can approve and somebody else can ask for changes. The work to do
  // is the changes, so that is the column it belongs in.
  test("changes requested beats an approval, and merged beats everything", () => {
    const both = linkedPull({ reviewDecision: "CHANGES_REQUESTED", reviewRequestCount: 2 });
    expect(automaticColumn(issue(), links([both]))).toBe("needs-changes");
    expect(automaticColumn(issue(), links([both, linkedPull({ id: "PR_2", merged: true, state: "closed" })]))).toBe(
      "done",
    );
  });

  // A pull request somebody closed without merging is abandoned work. Reading
  // it as progress would park the issue in a column it is not in.
  test("a pull request closed without merging counts for nothing", () => {
    expect(automaticColumn(issue(), links([linkedPull({ state: "closed", merged: false })]))).toBe("todo");
  });

  test("a pull request on the board is judged by its own state", () => {
    expect(automaticColumn(pull({ reviewDecision: "APPROVED" }), links())).toBe("ready-to-merge");
    expect(automaticColumn(pull({ merged: true }), links())).toBe("done");
    expect(automaticColumn(pull({ reviewRequestCount: 1 }), links())).toBe("awaiting-review");
    expect(automaticColumn(pull(), links())).toBe("ongoing");
  });

  test("never throws, whatever it is handed", () => {
    for (const junk of [null, undefined, {}, "item"]) {
      expect(COLUMNS.map((one) => one.id)).toContain(automaticColumn(junk, junk));
    }
  });
});

describe("columnFor", () => {
  // The reader's hand wins. GitHub says approved; a comment asked for one more
  // change; the reader knows which of those is true.
  test("a column chosen by hand beats the rule", () => {
    const relationship = links([linkedPull({ reviewDecision: "APPROVED" })]);
    expect(columnFor(issue(), relationship, "needs-changes")).toBe("needs-changes");
  });

  test("automatic falls back to the rule", () => {
    const relationship = links([linkedPull({ reviewDecision: "APPROVED" })]);
    expect(columnFor(issue(), relationship, AUTOMATIC)).toBe("ready-to-merge");
    expect(columnFor(issue(), relationship, "")).toBe("ready-to-merge");
    expect(columnFor(issue(), relationship, null)).toBe("ready-to-merge");
  });

  test("a column that no longer exists falls back to the rule, not to nothing", () => {
    expect(columnFor(issue(), links(), "a-column-we-removed")).toBe("todo");
  });
});

describe("moveOptions", () => {
  const relationship = links([linkedPull({ reviewDecision: "APPROVED" })]);

  test("offers automatic first, and says which column the rules would pick", () => {
    const [first] = moveOptions(issue(), relationship, "");
    expect(first.id).toBe(AUTOMATIC);
    expect(first.label).toBe("Automatic (Ready to merge)");
  });

  test("offers every column after it", () => {
    expect(moveOptions(issue(), relationship, "").slice(1).map((one) => one.id)).toEqual(
      COLUMNS.map((one) => one.id),
    );
  });

  // Exactly one entry is the current one, so a menu can show a mark beside it.
  test("marks the one in force, and only that one", () => {
    const onRules = moveOptions(issue(), relationship, "");
    expect(onRules.filter((one) => one.current).map((one) => one.id)).toEqual([AUTOMATIC]);

    const moved = moveOptions(issue(), relationship, "needs-changes");
    expect(moved.filter((one) => one.current).map((one) => one.id)).toEqual(["needs-changes"]);
  });

  test("never throws, whatever it is handed", () => {
    expect(moveOptions(null, null, null).length).toBe(COLUMNS.length + 1);
  });
});

describe("groupIntoColumns", () => {
  const groups = [
    { item: issue({ key: "a" }), children: [] },
    { item: issue({ key: "b" }), children: [] },
    { item: pull({ key: "c", merged: true }), children: [] },
  ];
  const relationships = { b: links([linkedPull({ reviewDecision: "APPROVED" })]) };

  test("every column comes back, in order, even when empty", () => {
    const board = groupIntoColumns(groups, relationships, {});
    expect(board.map((one) => one.column.id)).toEqual(COLUMNS.map((one) => one.id));
  });

  test("each group lands in its column", () => {
    const board = groupIntoColumns(groups, relationships, {});
    const keysIn = (id) => board.find((one) => one.column.id === id).groups.map((g) => g.item.key);
    expect(keysIn("todo")).toEqual(["a"]);
    expect(keysIn("ready-to-merge")).toEqual(["b"]);
    expect(keysIn("done")).toEqual(["c"]);
  });

  test("a hand-placed card moves column and keeps its order", () => {
    const board = groupIntoColumns(groups, relationships, { b: "todo" });
    const todo = board.find((one) => one.column.id === "todo");
    expect(todo.groups.map((g) => g.item.key)).toEqual(["a", "b"]);
  });

  test("survives being handed nothing", () => {
    expect(groupIntoColumns(null, null, null).map((one) => one.column.id)).toEqual(COLUMNS.map((one) => one.id));
  });
});
