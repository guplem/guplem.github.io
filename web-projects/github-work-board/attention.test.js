import { describe, expect, test } from "bun:test";
import {
  ATTENTION_IDS,
  ATTENTION_REASONS,
  attentionPills,
  attentionReason,
  attentionReasons,
  changesRequested,
  checksFailed,
  hasConflicts,
} from "./attention.js";

const pull = (over = {}) => ({
  merged: false,
  mergeable: "MERGEABLE",
  checksState: "SUCCESS",
  reviewDecision: "",
  reviewRequestCount: 0,
  askedAgain: false,
  exists: true,
  ...over,
});

describe("the reasons themselves", () => {
  // Worst first: a conflict stops the merge outright, a red check stops it
  // next, and a reviewer's changes are the one a commit answers.
  test("read worst first, and each one says what to do about it", () => {
    expect(ATTENTION_IDS).toEqual(["conflicts", "checks-failed", "changes-requested"]);
    for (const reason of ATTENTION_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.detail.length).toBeGreaterThan(0);
      // Each pill draws its own icon, so a reason with no drawing would reach
      // the card as a shape-less word.
      expect(reason.paths.length).toBeGreaterThan(0);
    }
  });

  test("an id the board does not draw reads as nothing", () => {
    expect(attentionReason("conflicts")?.label).toBe("Conflicts");
    expect(attentionReason("on fire")).toBeNull();
  });
});

describe("hasConflicts", () => {
  test("GitHub saying the branch conflicts is the only yes", () => {
    expect(hasConflicts(pull({ mergeable: "CONFLICTING" }))).toBe(true);
    expect(hasConflicts(pull({ mergeable: "MERGEABLE" }))).toBe(false);
  });

  // GitHub works `mergeable` out only when asked, so the first answer for a
  // quiet pull request is UNKNOWN. That is "not worked out yet", and claiming
  // a conflict from it would put half the board in one column.
  test("UNKNOWN and a missing answer claim nothing", () => {
    expect(hasConflicts(pull({ mergeable: "UNKNOWN" }))).toBe(false);
    expect(hasConflicts(pull({ mergeable: "" }))).toBe(false);
    expect(hasConflicts(null)).toBe(false);
  });
});

describe("checksFailed", () => {
  test("a check that failed and one that could not run both count", () => {
    expect(checksFailed(pull({ checksState: "FAILURE" }))).toBe(true);
    expect(checksFailed(pull({ checksState: "ERROR" }))).toBe(true);
  });

  // A check still running is not a reason to act, and most pull requests are
  // pending for the first minutes of their life.
  test("running, passing and no checks at all are not a reason", () => {
    expect(checksFailed(pull({ checksState: "PENDING" }))).toBe(false);
    expect(checksFailed(pull({ checksState: "EXPECTED" }))).toBe(false);
    expect(checksFailed(pull({ checksState: "SUCCESS" }))).toBe(false);
    expect(checksFailed(pull({ checksState: "" }))).toBe(false);
    expect(checksFailed(null)).toBe(false);
  });
});

describe("changesRequested", () => {
  test("a verdict nobody has answered counts", () => {
    expect(changesRequested(pull({ reviewDecision: "CHANGES_REQUESTED" }))).toBe(true);
  });

  // GitHub never clears the verdict, so without `askedAgain` answered work
  // would sit in this column for ever (ADR 0011).
  test("the same verdict, once the reviewer was asked again, does not", () => {
    expect(changesRequested(pull({ reviewDecision: "CHANGES_REQUESTED", askedAgain: true }))).toBe(false);
    expect(changesRequested(pull({ reviewDecision: "APPROVED" }))).toBe(false);
  });
});

describe("attentionReasons", () => {
  test("nothing in the way reads as empty", () => {
    expect(attentionReasons(pull())).toEqual([]);
  });

  test("all three at once, in reading order", () => {
    const bad = pull({ mergeable: "CONFLICTING", checksState: "FAILURE", reviewDecision: "CHANGES_REQUESTED" });
    expect(attentionReasons(bad)).toEqual(["conflicts", "checks-failed", "changes-requested"]);
  });

  // The card draws a pill per reason, so it has to carry the words with it.
  test("the pills carry the label and the detail", () => {
    const pills = attentionPills(pull({ checksState: "FAILURE" }));
    expect(pills.map((one) => one.id)).toEqual(["checks-failed"]);
    expect(pills[0].label).toBe("Checks failed");
  });
});
