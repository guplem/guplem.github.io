import { describe, expect, test } from "bun:test";
import { orderStacksForMerging, stackedUnder } from "./stacks.js";

/** A pull request as the board holds one, with the two branch names that make a stack. */
const pull = (number, head, base, over = {}) => ({
  key: `PR_${number}`,
  kind: "pull-request",
  number,
  repository: "Galtea-AI/monorepo",
  headRefName: head,
  baseRefName: base,
  ...over,
});

const issue = (number, over = {}) => ({
  key: `I_${number}`,
  kind: "issue",
  number,
  repository: "Galtea-AI/monorepo",
  ...over,
});

const alone = (item) => ({ item, children: [] });
const numbers = (groups) => groups.map((g) => g.item.number);

describe("stackedUnder", () => {
  // The real case this was built from: #5102 targets the branch #5098 adds, so
  // #5098 has to merge first. Read from the branches, never from a sentence in
  // the description (ADR 0010).
  test("a pull request is stacked under the one whose branch it targets", () => {
    const bottom = alone(pull(5098, "tech-debt-boy-scout-marker", "main"));
    const top = alone(pull(5102, "tech-debt-markers-bulk", "tech-debt-boy-scout-marker"));
    expect(stackedUnder(top, [bottom, top])).toBe(bottom);
    expect(stackedUnder(bottom, [bottom, top])).toBe(null);
  });

  // Branch names are only unique inside one repository. Two projects both
  // using `main` or `develop` would otherwise read as one tall stack.
  test("a branch in another repository is a different branch", () => {
    const here = alone(pull(1, "shared", "main"));
    const there = alone(pull(2, "other", "shared", { repository: "guplem/elsewhere" }));
    expect(stackedUnder(there, [here, there])).toBe(null);
  });

  test("a pull request whose base nobody owns is the bottom of its own stack", () => {
    const only = alone(pull(5102, "tech-debt-markers-bulk", "tech-debt-boy-scout-marker"));
    expect(stackedUnder(only, [only])).toBe(null);
  });

  // A pull request travels inside its issue's card, so the branches that count
  // are every pull request in the group, not only the one on top.
  test("a pull request nested under its issue still carries its branches", () => {
    const bottom = { item: issue(4693), children: [pull(5093, "dataset-column", "main")] };
    const top = alone(pull(5102, "bulk", "dataset-column"));
    expect(stackedUnder(top, [bottom, top])).toBe(bottom);
  });
});

describe("orderStacksForMerging", () => {
  test("a list with no stack in it comes back exactly as it was", () => {
    const groups = [alone(pull(3, "c", "main")), alone(issue(2)), alone(pull(1, "a", "main"))];
    expect(orderStacksForMerging(groups)).toEqual(groups);
  });

  // The point of the whole thing: the older pull request is the one on top of
  // the stack, so the base order puts it first and it cannot merge first.
  test("a stack reads bottom first, wherever the base order put its parts", () => {
    const top = alone(pull(5102, "bulk", "marker"));
    const bottom = alone(pull(5098, "marker", "main"));
    expect(numbers(orderStacksForMerging([top, bottom]))).toEqual([5098, 5102]);
  });

  test("a stack three deep reads in merge order", () => {
    const third = alone(pull(5173, "payment", "keep-card"));
    const second = alone(pull(5161, "keep-card", "checkout"));
    const first = alone(pull(5160, "checkout", "main"));
    expect(numbers(orderStacksForMerging([third, second, first]))).toEqual([5160, 5161, 5173]);
  });

  // A stack sits where its **bottom** sat, and the rest of the board does not
  // move. The top of a stack cannot be merged until the bottom is, so the top
  // waiting a long time is not work anybody can pick up: the stack is only as
  // old as the pull request that can merge next.
  //
  // The case that settled this, with the year standing for the last update:
  //   A 2015 · B 2016 (top of a stack) · C 2017 · D 2018 (its bottom)
  // Oldest first alone reads A, B, C, D. The answer is A, C, D, B.
  test("a stack sits where its bottom sat, and nothing else moves", () => {
    const a = alone(pull(2015, "a", "main"));
    const b = alone(pull(2016, "b-top", "d-bottom"));
    const c = alone(pull(2017, "c", "main"));
    const d = alone(pull(2018, "d-bottom", "main"));
    expect(numbers(orderStacksForMerging([a, b, c, d]))).toEqual([2015, 2017, 2018, 2016]);
  });

  // The same board with the bottom gone. B is then nobody's child, so it is
  // an ordinary card and does not move at all.
  test("without its bottom, the top of a stack is an ordinary card", () => {
    const a = alone(pull(2015, "a", "main"));
    const b = alone(pull(2016, "b-top", "d-bottom"));
    const c = alone(pull(2017, "c", "main"));
    expect(numbers(orderStacksForMerging([a, b, c]))).toEqual([2015, 2016, 2017]);
  });

  test("two stacks keep out of each other's way", () => {
    const groups = [
      alone(pull(20, "b-top", "b-bottom")),
      alone(pull(10, "a-top", "a-bottom")),
      alone(pull(11, "a-bottom", "main")),
      alone(pull(21, "b-bottom", "main")),
    ];
    expect(numbers(orderStacksForMerging(groups))).toEqual([11, 10, 21, 20]);
  });

  // The one thing this must never do. A reorder that drops a card loses work
  // silently, and nothing on the page would say so.
  test("every group comes back, exactly once", () => {
    const groups = [
      alone(pull(3, "c", "b")),
      alone(pull(1, "a", "main")),
      alone(issue(9)),
      alone(pull(2, "b", "a")),
    ];
    const out = orderStacksForMerging(groups);
    expect(out).toHaveLength(groups.length);
    expect(new Set(out).size).toBe(groups.length);
    for (const group of groups) expect(out).toContain(group);
  });

  // Branches can be retargeted into a ring. It should never happen and it must
  // never hang the page or lose a card.
  test("a ring of branches neither hangs nor loses anything", () => {
    const groups = [alone(pull(1, "a", "b")), alone(pull(2, "b", "a"))];
    const out = orderStacksForMerging(groups);
    expect(out).toHaveLength(2);
    expect(new Set(numbers(out))).toEqual(new Set([1, 2]));
  });

  test("never throws, whatever it is handed", () => {
    expect(orderStacksForMerging(null)).toEqual([]);
    expect(orderStacksForMerging([null, 7, {}, { item: null }])).toHaveLength(4);
    expect(() => orderStacksForMerging([alone(pull(1, "", "")), alone(pull(2, "", ""))])).not.toThrow();
  });

  // An empty branch name is not a branch. Two pull requests the board knows
  // nothing about must not read as a stack on each other.
  test("a missing branch name links nothing", () => {
    const groups = [alone(pull(2, "", "")), alone(pull(1, "", ""))];
    expect(numbers(orderStacksForMerging(groups))).toEqual([2, 1]);
  });
});
