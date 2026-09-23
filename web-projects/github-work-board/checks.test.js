import { describe, expect, test } from "bun:test";
import { MOST_ASKS, describeChecks, needsAsking, readWorkflowRuns } from "./checks.js";

describe("describeChecks", () => {
  // Worst first, which is the order every other list of reasons on a card
  // reads in.
  test("the breakdown reads worst first, and leaves out what is zero", () => {
    expect(describeChecks({ verdict: "failed", failed: 2, passed: 5, ongoing: 1, counted: 8, total: 8 })).toBe(
      "Checks: 2 failed, 1 still running, 5 passed.",
    );
    expect(describeChecks({ verdict: "passed", failed: 0, passed: 5, ongoing: 0, counted: 5, total: 5 })).toBe(
      "Checks: 5 passed.",
    );
  });

  test("one of anything is not plural", () => {
    expect(describeChecks({ verdict: "failed", failed: 1, passed: 1, ongoing: 1, counted: 3, total: 3 })).toBe(
      "Checks: 1 failed, 1 still running, 1 passed.",
    );
  });

  // A breakdown the board could not read must not leave the dot unexplained:
  // the verdict is always there, so it answers on its own.
  test("with no numbers, the verdict answers by itself", () => {
    expect(describeChecks({ verdict: "failed", failed: 0, passed: 0, ongoing: 0, counted: 0, total: 0 })).toBe(
      "A check on the last commit came back red.",
    );
    expect(describeChecks({ verdict: "ongoing", failed: 0, passed: 0, ongoing: 0, counted: 0, total: 0 })).toBe(
      "The checks on the last commit are still running.",
    );
    expect(describeChecks({ verdict: "passed", failed: 0, passed: 0, ongoing: 0, counted: 0, total: 0 })).toBe(
      "Every check on the last commit passed.",
    );
  });

  test("it says when it read only part of the checks", () => {
    expect(describeChecks({ verdict: "failed", failed: 1, passed: 49, ongoing: 0, counted: 50, total: 73 })).toBe(
      "Checks: 1 failed, 49 passed. Read from the first 50 of 73.",
    );
  });

  test("a card with no checks says nothing", () => {
    expect(describeChecks({ verdict: "", failed: 0, passed: 0, ongoing: 0, counted: 0, total: 0 })).toBe("");
  });
});

describe("readWorkflowRuns", () => {
  const started = (status) => ({ status, conclusion: null });
  const ended = (conclusion) => ({ status: "completed", conclusion });

  // A fine-grained token cannot read GitHub's own rollup at all, so the board
  // asks the Actions API instead and works the verdict out itself. It sees
  // every run on the commit, so the sum is the whole answer here (ADR 0037).
  test("one red run makes the verdict red, however many passed", () => {
    const summary = readWorkflowRuns([ended("success"), ended("failure"), started("in_progress")]);
    expect(summary).toMatchObject({ verdict: "failed", passed: 1, failed: 1, ongoing: 1, counted: 3, total: 3 });
  });

  test("nothing red and something running is still running", () => {
    expect(readWorkflowRuns([ended("success"), started("queued")]).verdict).toBe("ongoing");
  });

  test("everything finished and nothing red has passed", () => {
    expect(readWorkflowRuns([ended("success"), ended("skipped")]).verdict).toBe("passed");
  });

  // Nothing ran is not a pass, and the card draws no dot for it.
  test("a commit nothing ran on has no verdict", () => {
    expect(readWorkflowRuns([]).verdict).toBe("");
    expect(readWorkflowRuns(null).verdict).toBe("");
  });

  // The REST answer spells the same words in lower case, and carries a run
  // that was asked for but has not started.
  test("it reads the words the Actions API uses", () => {
    expect(readWorkflowRuns([started("waiting"), started("requested"), started("pending")]).ongoing).toBe(3);
    expect(readWorkflowRuns([ended("timed_out")]).failed).toBe(1);
    expect(readWorkflowRuns([ended("neutral")]).passed).toBe(1);
  });
});

describe("needsAsking", () => {
  // The board remembers a commit's checks and does not ask again, because a
  // commit that is finished stays finished. Asking again for every pull request
  // on every refresh is what this saves (ADR 0037).
  test("a commit the board has never asked about is asked about", () => {
    expect(needsAsking(undefined)).toBe(true);
    expect(needsAsking(null)).toBe(true);
  });

  test("a commit whose runs are still going is asked again", () => {
    expect(needsAsking({ verdict: "ongoing" })).toBe(true);
  });

  test("a commit that finished is never asked about again", () => {
    expect(needsAsking({ verdict: "passed" })).toBe(false);
    expect(needsAsking({ verdict: "failed" })).toBe(false);
  });

  // Nothing ran on it yet, and a workflow can still start: a pull request
  // opened a second ago has no runs, and it would keep "no dot" for ever.
  test("a commit nothing has run on yet is asked again", () => {
    expect(needsAsking({ verdict: "", asks: 1 })).toBe(true);
  });

  // But not for ever. A repository with no workflows at all answers "nothing
  // ran" every time, and that would be one call for each of its pull requests
  // on every single refresh, which is the cost this whole rule exists to avoid.
  test("a commit nothing has run on stops being asked about", () => {
    expect(needsAsking({ verdict: "", asks: MOST_ASKS - 1 })).toBe(true);
    expect(needsAsking({ verdict: "", asks: MOST_ASKS })).toBe(false);
    expect(needsAsking({ verdict: "", asks: MOST_ASKS + 1 })).toBe(false);
  });

  // Runs that are going will end, so that answer is asked about until it does.
  test("runs still going are asked about however long they take", () => {
    expect(needsAsking({ verdict: "ongoing", asks: 500 })).toBe(true);
  });
});
