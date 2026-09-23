// Which column a piece of work belongs in.
//
// The columns are the ordinary life of a change: there is nothing yet, there is
// a branch, somebody was asked to look, they answered, it landed. Nothing here
// is a status a person has to keep up to date by hand, because a board that
// asks you to maintain it is a second job. The rules read what GitHub already
// knows, and the reader can override any single card when GitHub's answer is
// not the truth (ADR 0011).
//
// **A column id is written into `board.json`** the moment somebody moves a card
// by hand, so an id is permanent, exactly like a sort id or a storage key.

import { CHECKS_FAILED, attentionReasons } from "./attention.js";
import { pullRequestFor } from "./relationships.js";
import { finishedAt } from "./workItems.js";

/** What an item carries when its column is left to the rules. */
export const AUTOMATIC = "automatic";

/**
 * The order here is the order on screen, and nothing else depends on it: the
 * ids are what is written into `board.json`, and they never move.
 *
 * "Needs attention" sits beside "Ongoing" because it is the same activity: in
 * both the work is with the person who wrote it. So the two columns a person
 * moves between all day are next to each other, and the three that mean
 * "waiting on somebody else" run on from there.
 */
export const COLUMNS = [
  { id: "todo", label: "To do", hint: "Assigned to you, with no pull request yet" },
  { id: "ongoing", label: "Ongoing", hint: "A pull request exists, nobody has been asked to review it" },
  {
    // The id is `needs-changes` because it is written into `board.json`, and an
    // id is never renamed. The column grew from reviews to everything that
    // waits on the author, and the label says so.
    id: "needs-changes",
    label: "Needs attention",
    hint: "The branch conflicts, a check is red, or a reviewer asked for changes",
  },
  { id: "awaiting-review", label: "Awaiting review", hint: "A reviewer was asked, no verdict yet" },
  { id: "ready-to-merge", label: "Ready to merge", hint: "Approved" },
  { id: "done", label: "Done today", hint: "Merged or closed since midnight" },
];

export const COLUMN_IDS = COLUMNS.map((column) => column.id);

/**
 * What to call a column when the work is only mentioned on a card, rather than
 * sitting in that column itself.
 *
 * One label changes. The board's last column holds what finished today,
 * because that is all the board ever asks GitHub for (ADR 0017). A child
 * listed on its parent's card was never filtered that way, so "Done today"
 * would be a claim about a date nobody checked.
 */
export function stateLabel(columnId) {
  if (columnId === "done") return "Done";
  return COLUMNS.find((column) => column.id === columnId)?.label ?? "";
}

const KNOWN = new Set(COLUMN_IDS);

/** A column the board knows, or `AUTOMATIC` for anything else. */
export function readColumnId(value) {
  return typeof value === "string" && KNOWN.has(value) ? value : AUTOMATIC;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The state of the pull request this item's column depends on. */
function pullRequestState(item, relationship) {
  const pull = pullRequestFor(item, relationship);
  if (!pull) return NONE;
  if (item?.kind === "pull-request") return readState(item, item.merged === true);
  if (pull.merged) return NONE_MERGED;
  return readState(pull, false);
}

const NONE = {
  merged: false,
  reviewDecision: "",
  reviewRequestCount: 0,
  askedAgain: false,
  mergeable: "",
  checks: null,
  exists: false,
};
const NONE_MERGED = { ...NONE, merged: true, exists: true };

/** The fields a column decision reads, taken off whichever pull request answers it. */
function readState(source, merged) {
  return {
    merged,
    reviewDecision: typeof source.reviewDecision === "string" ? source.reviewDecision : "",
    reviewRequestCount: Number.isFinite(source.reviewRequestCount) ? source.reviewRequestCount : 0,
    askedAgain: source.askedAgain === true,
    // What GitHub says about the merge, and what the board worked out about the
    // checks on the last commit. Both put a card in "Needs attention"
    // (ADR 0011, ADR 0037).
    mergeable: typeof source.mergeable === "string" ? source.mergeable : "",
    checks: source.checks ?? null,
    exists: true,
  };
}

/**
 * The column the rules put this item in.
 *
 * The order of the rules is the whole decision, because an item can answer
 * several of them at once.
 *
 * 1. **Merged beats everything**: it is over.
 * 2. **A conflict, or changes nobody has answered**, beats the rest. The merge
 *    itself cannot happen, or a reviewer has asked for work: no other person's
 *    move changes either, so the card is with its author. Changes requested
 *    that have been answered is not changes requested at all: the reviewer was
 *    asked again, so the wait is theirs.
 * 3. **A reviewer who has been asked beats a red check.** Both are real, and
 *    the column answers the more useful question: what is this waiting on? The
 *    card draws its "Checks failed" pill wherever it sits, so the red check is
 *    never hidden, and in the smart order it climbs to the top of the column
 *    (ADR 0011, ADR 0026).
 * 4. **A red check with nobody waited on** is the author's move, approval or
 *    no approval, so an approved pull request with a red check is not ready to
 *    merge.
 */
export function automaticColumn(item, relationship) {
  const self = isPlainObject(item) ? item : {};
  // Finished work is done, whatever else is true of it. A pull request closed
  // without merging is not finished: `finishedAt` answers "" for it (ADR 0017).
  if (finishedAt(self) !== "") return "done";
  const pull = pullRequestState(self, relationship);
  if (pull.merged) return "done";
  if (!pull.exists) return "todo";
  const reasons = attentionReasons(pull);
  // A conflict, or changes nobody has answered. Both want the person who wrote
  // the work, and no review moves either of them (ADR 0011).
  if (reasons.some((id) => id !== CHECKS_FAILED)) return "needs-changes";
  // Only somebody actually being asked counts. `REVIEW_REQUIRED` does not: it
  // is the branch rule saying the repository wants a review before a merge, so
  // every open pull request in such a repository carries it, including one
  // nobody has looked at (ADR 0011).
  if (pull.reviewRequestCount > 0) return "awaiting-review";
  // A red check, and nobody else to wait for. That is the author's move, and it
  // beats an approval: approved work with a red check cannot merge.
  if (reasons.length > 0) return "needs-changes";
  if (pull.reviewDecision === "APPROVED") return "ready-to-merge";
  return "ongoing";
}

/**
 * Why this item is in "Needs attention", as reason ids in reading order.
 *
 * Empty for work that is not held up, for work with no pull request, and for
 * work that merged. The card draws one pill per reason, because a column with
 * three ways into it has to say which one this card took (ADR 0011).
 */
export function attentionFor(item, relationship) {
  const self = isPlainObject(item) ? item : {};
  if (finishedAt(self) !== "") return [];
  const pull = pullRequestState(self, relationship);
  if (pull.merged || !pull.exists) return [];
  return attentionReasons(pull);
}

/**
 * The column this item is shown in: the reader's choice when they made one,
 * and the rule when they did not.
 *
 * GitHub can say approved while a comment on the pull request asks for one more
 * change. The reader knows which of those is true, so their hand wins.
 */
export function columnFor(item, relationship, overrideId) {
  const chosen = readColumnId(overrideId);
  return chosen === AUTOMATIC ? automaticColumn(item, relationship) : chosen;
}

/**
 * What the "move to" menu offers for one card.
 *
 * The first entry hands the card back to the rules and says which column they
 * would pick, so the reader can see what an override is overriding. Exactly one
 * entry is marked as current.
 */
export function moveOptions(item, relationship, overrideId) {
  const automatic = automaticColumn(item, relationship);
  const chosen = readColumnId(overrideId);
  const label = COLUMNS.find((column) => column.id === automatic)?.label ?? automatic;
  return [
    { id: AUTOMATIC, label: `Automatic (${label})`, current: chosen === AUTOMATIC },
    ...COLUMNS.map((column) => ({ id: column.id, label: column.label, current: chosen === column.id })),
  ];
}

/**
 * The whole board: every column, in order, with the groups that belong in it.
 *
 * Empty columns come back too. A column that disappears when nothing is in it
 * makes the board change shape as work moves, and the reader loses the place
 * they were looking at.
 *
 * @param groups `{item, children}` pairs from `relationships.groupByLinkedIssue`
 * @param relationships what GitHub links to each item, keyed by item key
 * @param overrides the column each item was moved to by hand, keyed by item key
 */
export function groupIntoColumns(groups, relationships, overrides) {
  const list = Array.isArray(groups) ? groups : [];
  const board = COLUMNS.map((column) => ({ column, groups: [] }));
  const byId = new Map(board.map((entry) => [entry.column.id, entry]));

  for (const group of list) {
    const key = group?.item?.key;
    const relationship = isPlainObject(relationships) ? relationships[key] : null;
    const chosen = isPlainObject(overrides) ? overrides[key] : null;
    byId.get(columnFor(group?.item, relationship, chosen))?.groups.push(group);
  }

  // "Done today" is the one column that is a log rather than a queue, so it
  // reads newest first whatever order the reader asked for: the useful end of
  // a log is the thing that just landed. A card moved there by hand carries no
  // moment, so it goes last rather than disappearing (ADR 0017).
  const done = byId.get("done");
  if (done) {
    done.groups = done.groups
      .map((group, index) => ({ group, index, when: Date.parse(finishedAt(group?.item)) }))
      .sort((a, b) => {
        const left = Number.isNaN(a.when) ? null : a.when;
        const right = Number.isNaN(b.when) ? null : b.when;
        if (left === right) return a.index - b.index;
        if (left === null) return 1;
        if (right === null) return -1;
        return right - left;
      })
      .map((one) => one.group);
  }
  return board;
}
