// Why a pull request wants the author, rather than anybody else.
//
// "Needs attention" is one column with three ways into it, and they are all the
// same sentence: the work cannot go forward until the person who wrote it does
// something. A reviewer asked for changes. The checks went red. The branch no
// longer merges cleanly. Each of those is the author's move, so they belong in
// one place, and the card has to say which one it is (ADR 0011).
//
// A reason id is drawn on a card and never written into `board.json`, so it is
// free to change. The order below is the order the pills read on a card, worst
// first: conflicts stop the merge outright, a red check stops it next, and a
// reviewer's changes are the one a person can answer with a commit.

/**
 * The three ways a pull request lands in "Needs attention".
 *
 * `label` is the pill on the card. `detail` is what hovering it says, written
 * as what to do about it rather than as a restatement of the label.
 */
export const ATTENTION_REASONS = [
  {
    id: "conflicts",
    label: "Conflicts",
    detail: "This branch and the branch it merges into changed the same lines. Merge or rebase to clear it.",
    // A warning triangle. The drawing lives here, beside the words, the way a
    // change type carries its own paths (ADR 0021).
    paths: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
  },
  {
    id: "checks-failed",
    label: "Checks failed",
    detail: "A check GitHub ran on the last commit came back red. Open the pull request to see which one.",
    // A cross in a circle, which is what GitHub itself draws on a red check.
    paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M15 9l-6 6", "M9 9l6 6"],
  },
  {
    id: "changes-requested",
    label: "Changes requested",
    detail: "A reviewer asked for changes and has not been asked to look again.",
    // A speech bubble: somebody said something about this work.
    paths: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  },
];

export const ATTENTION_IDS = ATTENTION_REASONS.map((one) => one.id);

const BY_ID = new Map(ATTENTION_REASONS.map((one) => [one.id, one]));

/** One reason, or null when the id is not one this board draws. */
export function attentionReason(id) {
  return BY_ID.get(id) ?? null;
}

/**
 * Whether GitHub says this branch no longer merges cleanly.
 *
 * GitHub works `mergeable` out only when somebody asks for it, so the first
 * answer for a pull request nobody has opened in a while is `UNKNOWN`. That is
 * "not worked out yet", not "fine", and the board claims nothing about it: the
 * next refresh answers properly (ADR 0011).
 */
export function hasConflicts(pull) {
  return pull?.mergeable === "CONFLICTING";
}

/**
 * Whether the checks on the last commit came back red.
 *
 * GitHub rolls every check on a commit into one verdict. `FAILURE` is a check
 * that failed and `ERROR` is one that could not run, and both mean the same
 * thing to the author. `PENDING` and `EXPECTED` are checks still running, so
 * they are not a reason to act, and a pull request with no checks at all
 * answers with nothing.
 */
export function checksFailed(pull) {
  return pull?.checksState === "FAILURE" || pull?.checksState === "ERROR";
}

/**
 * Whether a reviewer asked for changes and is still waiting for them.
 *
 * GitHub never clears `reviewDecision`, so the verdict outlives the work. Only
 * `askedAgain`, which says every reviewer who asked for changes has been asked
 * to look again, says the ball went back to them (ADR 0011).
 */
export function changesRequested(pull) {
  return pull?.reviewDecision === "CHANGES_REQUESTED" && pull?.askedAgain !== true;
}

/**
 * Every reason this pull request wants its author, in reading order.
 *
 * Empty means nothing is in the way, which is what puts the card in some other
 * column. A pull request that does not exist yet, or one that merged, never
 * reaches here.
 */
export function attentionReasons(pull) {
  const found = [];
  if (hasConflicts(pull)) found.push("conflicts");
  if (checksFailed(pull)) found.push("checks-failed");
  if (changesRequested(pull)) found.push("changes-requested");
  return found;
}

/** The reasons as the card draws them: `{id, label, detail}`, in reading order. */
export function attentionPills(pull) {
  return attentionReasons(pull).map((id) => BY_ID.get(id));
}
