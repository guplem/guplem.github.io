import { describe, expect, test } from "bun:test";
import {
  describeStackPosition,
  orderItemsForMerging,
  orderStacksForMerging,
  stackLights,
  stackPositions,
  stackedUnder,
} from "./stacks.js";

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

describe("stackPositions", () => {
  // The row of pull requests waiting on your review is a flat row of cards
  // from other people. Three of them are often one stack, and nothing on the
  // card said so or said which one to read first (ADR 0020).
  test("names the stack by its bottom, and says where each one sits", () => {
    const at = stackPositions([
      pull(5083, "deep-plan", "mockups"),
      pull(5073, "plan-first", "main"),
      pull(5082, "mockups", "plan-first"),
    ]);
    expect(at.PR_5073).toMatchObject({ stack: 5073, position: 1, size: 3 });
    expect(at.PR_5082).toMatchObject({ stack: 5073, position: 2, size: 3 });
    expect(at.PR_5083).toMatchObject({ stack: 5073, position: 3, size: 3 });
  });

  // A pull request standing on its own is not in a stack, and a badge saying
  // "1 of 1" on every card would be noise on every card.
  test("says nothing about a pull request that is in no stack", () => {
    const at = stackPositions([pull(1, "a", "main"), pull(2, "b", "main")]);
    expect(at).toEqual({});
  });

  // Only what the reader can see is counted. If somebody asked for a review on
  // two of their three, the row holds two, and "1 of 2" is the truth about the
  // row in front of them.
  test("counts only the pull requests it was given", () => {
    const at = stackPositions([pull(5082, "mockups", "plan-first"), pull(5083, "deep-plan", "mockups")]);
    expect(at.PR_5082).toMatchObject({ stack: 5082, position: 1, size: 2 });
    expect(at.PR_5083).toMatchObject({ stack: 5082, position: 2, size: 2 });
  });

  test("keeps two stacks apart", () => {
    const at = stackPositions([
      pull(10, "a-top", "a-bottom"),
      pull(11, "a-bottom", "main"),
      pull(20, "b-top", "b-bottom"),
      pull(21, "b-bottom", "main"),
    ]);
    expect(at.PR_10.stack).toBe(11);
    expect(at.PR_20.stack).toBe(21);
    expect(at.PR_10.size).toBe(2);
  });

  // Branches in a repository can be retargeted into a ring. It must not hang.
  test("a ring neither hangs nor answers nonsense", () => {
    const at = stackPositions([pull(1, "a", "b"), pull(2, "b", "a")]);
    expect(Object.keys(at).length).toBeLessThanOrEqual(2);
  });

  test("never throws, whatever it is handed", () => {
    expect(stackPositions(null)).toEqual({});
    expect(stackPositions([null, 7])).toEqual({});
    expect(stackPositions([pull(1, "", ""), pull(2, "", "")])).toEqual({});
  });
});

describe("stackPositions names the pull request the number belongs to (ADR 0027)", () => {
  // The badge shows the bottom's number. A number alone says nothing about
  // what that pull request is, and the reader would have to go and look.
  test("carries the bottom's title, so the number can be explained", () => {
    const at = stackPositions([
      pull(5073, "plan-first", "main", { title: "feat(api): plan the upload first" }),
      pull(5082, "mockups", "plan-first", { title: "feat(ui): the mockups" }),
    ]);
    expect(at.PR_5073.title).toBe("feat(api): plan the upload first");
    expect(at.PR_5082.title).toBe("feat(api): plan the upload first");
  });

  // Two repositories can both hold a pull request numbered 7, so the number
  // cannot say which cards belong together. The bottom's key can.
  test("carries the bottom's key, which is what tells two stacks apart", () => {
    const at = stackPositions([
      pull(5073, "plan-first", "main"),
      pull(5082, "mockups", "plan-first"),
      pull(7, "other", "main", { repository: "me/elsewhere" }),
      pull(8, "higher", "other", { repository: "me/elsewhere" }),
    ]);
    expect(at.PR_5073.root).toBe("PR_5073");
    expect(at.PR_5082.root).toBe("PR_5073");
    expect(at.PR_7.root).toBe("PR_7");
    expect(at.PR_8.root).toBe("PR_7");
    expect(at.PR_5082.root).not.toBe(at.PR_8.root);
  });

  test("a title nobody wrote is an empty one, never undefined", () => {
    const at = stackPositions([pull(1, "a", "main"), pull(2, "b", "a")]);
    expect(at.PR_2.title).toBe("");
  });
});

describe("stackPositions in a stack that branches", () => {
  // The real case: #6021 was the base, and eight pull requests all targeted
  // its branch. Every one of the eight read "2 of 9", so the board showed eight
  // identical badges and no way to tell them apart.
  test("pull requests on one level get a letter each, so no two badges match", () => {
    const at = stackPositions([
      pull(6021, "base", "main"),
      pull(6022, "one", "base"),
      pull(6023, "two", "base"),
      pull(6024, "three", "base"),
    ]);
    expect(at.PR_6021).toMatchObject({ label: "1", position: 1, levels: 2, size: 4, under: null });
    expect(at.PR_6022).toMatchObject({ label: "2a", position: 2, levels: 2, sharing: 3, under: 6021 });
    expect(at.PR_6023).toMatchObject({ label: "2b", position: 2, levels: 2, sharing: 3, under: 6021 });
    expect(at.PR_6024).toMatchObject({ label: "2c", position: 2, levels: 2, sharing: 3, under: 6021 });
  });

  // A straight stack has one pull request per level. It reads as it always did.
  test("a straight stack has no letters, and its levels are its size", () => {
    const at = stackPositions([pull(1, "a", "main"), pull(2, "b", "a"), pull(3, "c", "b")]);
    expect(at.PR_2).toMatchObject({ label: "2", levels: 3, size: 3, sharing: 1, under: 1 });
    expect(at.PR_3).toMatchObject({ label: "3", levels: 3, under: 2 });
  });

  // Letters count across the whole level, not per parent. Per parent, two
  // branches would both hold a "3a", and the badges would match again.
  test("letters are unique on a level even under different parents", () => {
    const at = stackPositions([
      pull(1, "root", "main"),
      pull(2, "left", "root"),
      pull(3, "right", "root"),
      pull(4, "left-1", "left"),
      pull(5, "left-2", "left"),
      pull(6, "right-1", "right"),
    ]);
    const labels = Object.values(at).map((one) => one.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect([at.PR_4.label, at.PR_5.label, at.PR_6.label]).toEqual(["3a", "3b", "3c"]);
  });

  // A level that holds one pull request needs no letter, even when the level
  // below it branched.
  test("a level with one pull request has no letter", () => {
    const at = stackPositions([pull(1, "root", "main"), pull(2, "x", "root"), pull(3, "y", "root"), pull(4, "z", "x")]);
    expect(at.PR_4.label).toBe("3");
  });

  test("past z the letters carry on as aa, ab", () => {
    const tops = Array.from({ length: 28 }, (_, i) => pull(100 + i, `top-${i}`, "root"));
    const at = stackPositions([pull(1, "root", "main"), ...tops]);
    expect(at.PR_125.label).toBe("2z");
    expect(at.PR_126.label).toBe("2aa");
    expect(at.PR_127.label).toBe("2ab");
  });
});

describe("describeStackPosition", () => {
  test("a straight stack reads as it always did", () => {
    const [at] = Object.values(stackPositions([pull(1, "a", "main"), pull(2, "b", "a")])).slice(1);
    expect(describeStackPosition(at).text).toBe("2 of 2");
  });

  // "2a of 9" would say there are nine levels. The count after "of" is the
  // levels, and the tooltip carries the count of pull requests.
  test("a branched one names the level, the letter and how many levels there are", () => {
    const at = stackPositions([pull(6021, "base", "main"), pull(6022, "one", "base"), pull(6023, "two", "base")]);
    const words = describeStackPosition(at.PR_6023);
    expect(words.text).toBe("2b of 2");
    expect(words.tip).toContain("#6021");
    expect(words.tip).toContain("2 pull requests");
    expect(words.tip).toContain("3 pull requests");
  });

  test("the bottom says it merges first", () => {
    const at = stackPositions([pull(1, "a", "main"), pull(2, "b", "a")]);
    expect(describeStackPosition(at.PR_1).tip).toContain("merges first");
  });
});

describe("stackLights names the stack each card's badge names (ADR 0027)", () => {
  // The bug this exists for: the light was worked out over the whole screen,
  // and the badges list by list. One pull request in the board targeted a
  // branch from the review row, so the screen read as one stack. The badges
  // said "Stack #5843" and "Stack #6015", and a hover lit both stacks at once.
  test("two stacks the badges keep apart light apart", () => {
    const row = [pull(5843, "alerts-api", "main"), pull(5844, "alerts-ui", "alerts-api")];
    const board = [pull(6015, "write-less", "alerts-ui"), pull(6034, "write-less-fix", "write-less")];
    const lit = stackLights([row, board]);
    expect(lit.PR_5843).toBe("PR_5843");
    expect(lit.PR_5844).toBe("PR_5843");
    expect(lit.PR_6015).toBe("PR_6015");
    expect(lit.PR_6034).toBe("PR_6015");
  });

  // A card with no badge must light nothing, or the hover says it is in a
  // stack when the card itself says it is not.
  test("a pull request alone in its list lights nothing", () => {
    const row = [pull(1, "a", "main")];
    const board = [pull(2, "b", "a")];
    expect(stackLights([row, board])).toEqual({});
  });

  test("never throws, whatever it is handed", () => {
    expect(stackLights(null)).toEqual({});
    expect(stackLights([null, [7]])).toEqual({});
  });
});

describe("orderItemsForMerging", () => {
  const numbers = (items) => items.map((one) => one.number);

  // The row of pull requests waiting on the reader is a flat row, not the
  // grouped board. It still holds stacks, and it showed them in the wrong
  // order: the badge said "1 of 3" on a card sitting last (ADR 0016).
  test("a flat row reads its stack bottom first", () => {
    const row = [
      pull(5082, "mockups", "plan-first"),
      pull(5083, "deep-plan", "mockups"),
      pull(5073, "plan-first", "main"),
    ];
    expect(numbers(orderItemsForMerging(row))).toEqual([5073, 5082, 5083]);
  });

  // The same rule the board follows: a stack sits where its bottom sat, because
  // the stack is only as old as the pull request that can merge next.
  test("a stack sits where its bottom sat", () => {
    const row = [
      pull(5099, "extra", "skills"),
      pull(5086, "skills", "main"),
      pull(5082, "mockups", "plan-first"),
      pull(5083, "deep-plan", "mockups"),
      pull(5073, "plan-first", "main"),
    ];
    expect(numbers(orderItemsForMerging(row))).toEqual([5086, 5099, 5073, 5082, 5083]);
  });

  test("a pull request in no stack does not move", () => {
    const row = [pull(1, "a", "main"), pull(2, "b", "main"), pull(3, "c", "main")];
    expect(numbers(orderItemsForMerging(row))).toEqual([1, 2, 3]);
  });

  test("an issue in the row is left where it is", () => {
    const row = [issue(7), pull(1, "a", "main")];
    expect(numbers(orderItemsForMerging(row))).toEqual([7, 1]);
  });

  // A reorder that drops a card loses work with nothing on screen to say so.
  test("never drops one, even with a ring of retargeted branches", () => {
    const ring = [pull(1, "a", "b"), pull(2, "b", "a"), pull(3, "c", "main")];
    const out = orderItemsForMerging(ring);
    expect(out.length).toBe(3);
    expect(new Set(numbers(out))).toEqual(new Set([1, 2, 3]));
  });

  test("never throws, whatever it is handed", () => {
    expect(orderItemsForMerging(null)).toEqual([]);
    expect(orderItemsForMerging([])).toEqual([]);
  });

  test("the row handed in is never changed", () => {
    const row = [pull(2, "b", "a"), pull(1, "a", "main")];
    orderItemsForMerging(row);
    expect(numbers(row)).toEqual([2, 1]);
  });
});
