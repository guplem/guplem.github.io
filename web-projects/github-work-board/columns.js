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

/** What an item carries when its column is left to the rules. */
export const AUTOMATIC = "automatic";

/**
 * The order here is the order on screen, and nothing else depends on it: the
 * ids are what is written into `board.json`, and they never move.
 *
 * "Needs changes" sits beside "Ongoing" because it is the same activity. A
 * reviewer asking for changes sends the work back to being written, so the two
 * columns a person moves between all day are next to each other, and the three
 * that mean "waiting on somebody else" run on from there.
 */
export const COLUMNS = [
  { id: "todo", label: "To do", hint: "Assigned to you, with no pull request yet" },
  { id: "ongoing", label: "Ongoing", hint: "A pull request exists, nobody has been asked to review it" },
  {
    id: "needs-changes",
    label: "Needs changes",
    hint: "A reviewer asked for changes, and has not been asked to look again",
  },
  { id: "awaiting-review", label: "Awaiting review", hint: "A reviewer was asked, no verdict yet" },
  { id: "ready-to-merge", label: "Ready to merge", hint: "Approved" },
  { id: "done", label: "Done", hint: "The pull request is merged" },
];

export const COLUMN_IDS = COLUMNS.map((column) => column.id);

const KNOWN = new Set(COLUMN_IDS);

/** A column the board knows, or `AUTOMATIC` for anything else. */
export function readColumnId(value) {
  return typeof value === "string" && KNOWN.has(value) ? value : AUTOMATIC;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * The state of the pull request this item's column depends on.
 *
 * For a pull request, itself. For an issue, the pull requests GitHub says would
 * close it. A pull request that was closed without merging is abandoned work
 * and counts for nothing: reading it as progress would park the issue in a
 * column it is not in.
 */
function pullRequestState(item, relationship) {
  if (item?.kind === "pull-request") {
    return {
      merged: item.merged === true,
      reviewDecision: typeof item.reviewDecision === "string" ? item.reviewDecision : "",
      reviewRequestCount: Number.isFinite(item.reviewRequestCount) ? item.reviewRequestCount : 0,
      askedAgain: item.askedAgain === true,
      exists: true,
    };
  }

  const linked = Array.isArray(relationship?.closedBy) ? relationship.closedBy : [];
  const merged = linked.find((one) => one.merged);
  if (merged) return { merged: true, reviewDecision: "", reviewRequestCount: 0, askedAgain: false, exists: true };

  const open = linked.find((one) => one.state === "open");
  if (!open) return { merged: false, reviewDecision: "", reviewRequestCount: 0, askedAgain: false, exists: false };
  return {
    merged: false,
    reviewDecision: typeof open.reviewDecision === "string" ? open.reviewDecision : "",
    reviewRequestCount: Number.isFinite(open.reviewRequestCount) ? open.reviewRequestCount : 0,
    askedAgain: open.askedAgain === true,
    exists: true,
  };
}

/**
 * The column the rules put this item in.
 *
 * The order of the checks is the whole decision, because an item can answer
 * several of them at once. Merged beats everything: it is over. Changes
 * requested beats an approval, because one reviewer approving does not undo
 * another asking for work, and the work is what is left to do. Changes
 * requested that have been answered is not changes requested at all: the
 * reviewer was asked again, so the wait is theirs.
 */
export function automaticColumn(item, relationship) {
  const pull = pullRequestState(isPlainObject(item) ? item : {}, relationship);
  if (pull.merged) return "done";
  if (!pull.exists) return "todo";
  // GitHub never clears this verdict, so it survives the author doing the work
  // and asking the same reviewer to look again. `askedAgain` is the only thing
  // that says the ball is back with the reviewer (ADR 0011).
  if (pull.reviewDecision === "CHANGES_REQUESTED") return pull.askedAgain ? "awaiting-review" : "needs-changes";
  if (pull.reviewDecision === "APPROVED") return "ready-to-merge";
  if (pull.reviewRequestCount > 0 || pull.reviewDecision === "REVIEW_REQUIRED") return "awaiting-review";
  return "ongoing";
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
  return board;
}
