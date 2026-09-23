import { describe, expect, test } from "bun:test";
import { CHECKS_READ, describeChecks, readCheckSummary } from "./checks.js";

const run = (status, conclusion) => ({ __typename: "CheckRun", status, conclusion });
const context = (state) => ({ __typename: "StatusContext", state });
const rollup = (state, nodes, totalCount = nodes.length) => ({
  state,
  contexts: { totalCount, nodes },
});

describe("readCheckSummary", () => {
  // The colour of the dot is GitHub's own verdict, never a sum the board does
  // itself: the board reads the first 50 checks and GitHub rolls up all of
  // them, so a sum could say green on a pull request GitHub calls red.
  test("the verdict is GitHub's rollup, in the board's own words", () => {
    expect(readCheckSummary(rollup("SUCCESS", [])).verdict).toBe("passed");
    expect(readCheckSummary(rollup("FAILURE", [])).verdict).toBe("failed");
    expect(readCheckSummary(rollup("ERROR", [])).verdict).toBe("failed");
    expect(readCheckSummary(rollup("PENDING", [])).verdict).toBe("ongoing");
    expect(readCheckSummary(rollup("EXPECTED", [])).verdict).toBe("ongoing");
  });

  // No rollup means no checks ran at all, which is not a pass. The card draws
  // nothing rather than a green dot nobody earned.
  test("a pull request with no checks has no verdict", () => {
    expect(readCheckSummary(null).verdict).toBe("");
    expect(readCheckSummary({}).verdict).toBe("");
    expect(readCheckSummary(rollup("SOMETHING_NEW", [])).verdict).toBe("");
  });

  test("a check that has not finished is still running, whatever it will conclude", () => {
    const summary = readCheckSummary(
      rollup("PENDING", [run("QUEUED", null), run("IN_PROGRESS", null), run("WAITING", "SUCCESS")]),
    );
    expect(summary.ongoing).toBe(3);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(0);
  });

  // GitHub's own rollup counts a skipped or neutral check as a pass, so the
  // breakdown must too, or the numbers argue with the colour beside them.
  test("skipped and neutral are passes, the way GitHub rolls them up", () => {
    const summary = readCheckSummary(
      rollup("SUCCESS", [
        run("COMPLETED", "SUCCESS"),
        run("COMPLETED", "NEUTRAL"),
        run("COMPLETED", "SKIPPED"),
      ]),
    );
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(0);
  });

  test("every way a check can end badly counts as failed", () => {
    for (const ending of ["FAILURE", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "CANCELLED", "STALE"]) {
      expect(readCheckSummary(rollup("FAILURE", [run("COMPLETED", ending)])).failed).toBe(1);
    }
  });

  test("an older status, which is not a check run, is counted the same way", () => {
    const summary = readCheckSummary(
      rollup("FAILURE", [context("SUCCESS"), context("FAILURE"), context("ERROR"), context("PENDING"), context("EXPECTED")]),
    );
    expect(summary).toMatchObject({ passed: 1, failed: 2, ongoing: 2, counted: 5 });
  });

  // The board asks for 50 checks and a pull request may have more. The numbers
  // then describe the 50 it read, and the card says so rather than claiming the
  // rest.
  test("it says how many it counted and how many there are", () => {
    const summary = readCheckSummary(rollup("FAILURE", [run("COMPLETED", "FAILURE")], 73));
    expect(summary.counted).toBe(1);
    expect(summary.total).toBe(73);
  });

  test("the board reads a fixed number of checks, and one place says which", () => {
    expect(CHECKS_READ).toBeGreaterThanOrEqual(20);
  });
});

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
