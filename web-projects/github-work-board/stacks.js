// Pull requests stacked on top of each other, and the order they must merge in.
//
// A stacked pull request targets another pull request's branch instead of the
// main one. The lower one has to merge first, or the higher one carries its
// commits and reads as a much bigger change than it is. That order is not a
// preference: it is the only order the work can land in.
//
// **The stack is read from the two branch names, never from the description.**
// "Depends on #4979" in a body is a guess: it misses the stacks nobody wrote a
// sentence about, and invents one from any sentence with a number in it
// (ADR 0010). A pull request is stacked under another when its `baseRefName`
// is that one's `headRefName`, in the same repository.
//
// Everything here works on the groups the board draws (`{item, children}`),
// not on single items, because a pull request travels inside the card of the
// issue it closes. A group publishes every branch its pull requests add, and
// wants every branch they target.

/** A branch, named so that the same branch in two repositories stays two branches. */
function branchKey(repository, branch) {
  const name = typeof branch === "string" ? branch.trim() : "";
  return name === "" ? null : `${typeof repository === "string" ? repository : ""}#${name}`;
}

/** Every pull request in one group: the card itself, and anything nested in it. */
function pullRequestsIn(group) {
  const all = [group?.item, ...(Array.isArray(group?.children) ? group.children : [])];
  return all.filter((one) => one && typeof one === "object" && one.kind === "pull-request");
}

/** The branches a group adds. Another group targeting one of these sits on top of it. */
function headsOf(group) {
  return pullRequestsIn(group)
    .map((one) => branchKey(one.repository, one.headRefName))
    .filter(Boolean);
}

/** The branches a group targets. */
function basesOf(group) {
  return pullRequestsIn(group)
    .map((one) => branchKey(one.repository, one.baseRefName))
    .filter(Boolean);
}

/**
 * The group this one is stacked on top of, or null when it stands on its own.
 *
 * A group whose base branch nobody on the board adds is the bottom of its own
 * stack, which is the ordinary case: almost every pull request targets the
 * main branch, and no pull request adds that.
 *
 * @param group the group to place
 * @param groups every group the board is showing
 */
export function stackedUnder(group, groups) {
  const wanted = new Set(basesOf(group));
  if (wanted.size === 0) return null;
  for (const other of Array.isArray(groups) ? groups : []) {
    if (other === group) continue;
    if (headsOf(other).some((head) => wanted.has(head))) return other;
  }
  return null;
}

/**
 * The same groups, with every stack read bottom first and kept together.
 *
 * **A stack sits where its bottom sat.** The top of a stack cannot merge until
 * the bottom does, so a top that has waited a long time is not work anybody
 * can pick up: the stack is only as old as the pull request that can merge
 * next. A group in no stack does not move at all.
 *
 * @param groups `{item, children}` pairs, already in the reader's chosen order
 * @returns a new array holding exactly the same groups
 */
export function orderStacksForMerging(groups) {
  const list = Array.isArray(groups) ? groups : [];
  const parentOf = new Map(list.map((group) => [group, stackedUnder(group, list)]));

  // Children in the order they were handed in, so a stack that branches keeps
  // the reader's order between its branches.
  const childrenOf = new Map(list.map((group) => [group, []]));
  for (const group of list) {
    const parent = parentOf.get(group);
    if (parent) childrenOf.get(parent).push(group);
  }

  const placed = new Set();
  const ordered = [];

  const emit = (group) => {
    if (placed.has(group)) return;
    placed.add(group);
    ordered.push(group);
    for (const child of childrenOf.get(group) ?? []) emit(child);
  };

  // Only a bottom opens a stack, so the stack lands on the bottom's own place
  // in the order the reader asked for. Anything sitting on top of something
  // else is skipped here and comes out behind the one it waits for.
  for (const group of list) {
    if (parentOf.get(group) === null) emit(group);
  }

  // A ring of retargeted branches has no bottom, so nothing above emitted its
  // members. They come last, in the order they were given. A reorder must
  // never drop a card: that loses work with nothing on screen to say so.
  for (const group of list) emit(group);

  return ordered;
}

/**
 * Where each pull request sits in its stack, for the ones handed in.
 *
 * The row of pull requests waiting on the reader's review is a flat row of
 * cards from other people, and three of them are often one stack. Nothing on
 * the card said so, or said which one to read first (ADR 0020).
 *
 * **Only what was handed in is counted.** Somebody who asked for a review on
 * two of their three gets a row holding two, and "1 of 2" is the truth about
 * the row in front of the reader.
 *
 * A stack is named by the number of its bottom, which is the one that merges
 * first. Anything standing on its own is left out: a badge reading "1 of 1" on
 * every card is noise on every card.
 *
 * @param items work items, not groups
 * @returns `{[key]: {stack, position, size}}` for anything in a stack of two
 *   or more, where `position` counts from the bottom
 */
export function stackPositions(items) {
  const list = (Array.isArray(items) ? items : []).filter((one) => one && typeof one === "object");
  const groups = list.map((item) => ({ item, children: [] }));
  const parentOf = new Map(groups.map((group) => [group, stackedUnder(group, groups)]));

  const rootOf = new Map();
  const depthOf = new Map();
  for (const group of groups) {
    let at = group;
    let depth = 0;
    const seen = new Set([group]);
    // Walk down to the bottom. The seen set breaks a ring of retargeted
    // branches, which must never hang the page.
    for (let below = parentOf.get(at); below && !seen.has(below); below = parentOf.get(at)) {
      at = below;
      seen.add(at);
      depth += 1;
    }
    rootOf.set(group, at);
    depthOf.set(group, depth);
  }

  const sizeOf = new Map();
  for (const group of groups) {
    const root = rootOf.get(group);
    sizeOf.set(root, (sizeOf.get(root) ?? 0) + 1);
  }

  const where = {};
  for (const group of groups) {
    const root = rootOf.get(group);
    const size = sizeOf.get(root) ?? 1;
    if (size < 2) continue;
    where[group.item.key] = { stack: root.item.number, position: depthOf.get(group) + 1, size };
  }
  return where;
}
