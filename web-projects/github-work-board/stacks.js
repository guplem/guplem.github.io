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
 * The same flat row, with every stack read bottom first.
 *
 * The board draws groups and orders those (`orderStacksForMerging`). The row of
 * pull requests waiting on the reader is flat, and it holds stacks too. It
 * showed them in whatever order they were last touched, so a card badged
 * "1 of 3" could sit last, and the row told the reader one thing with the badge
 * and the opposite with the order (ADR 0016).
 *
 * A flat item is a group with nothing nested in it, so this is the same pass.
 *
 * @param items work items, not groups
 * @returns a new array holding exactly the same items
 */
export function orderItemsForMerging(items) {
  const list = (Array.isArray(items) ? items : []).filter((one) => one && typeof one === "object");
  const groups = list.map((item) => ({ item, children: [] }));
  return orderStacksForMerging(groups).map((group) => group.item);
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
 * Each answer also carries the bottom's `key` and `title` (ADR 0027). The key
 * is what tells two stacks apart, because two repositories can both hold a
 * pull request numbered 7 and the number cannot. The title is what the number
 * on the badge means, which a number alone never says.
 *
 * **A stack that branches gives each pull request on a shared level a letter.**
 * Eight pull requests that all target one branch used to read "2 of 9" eight
 * times over. The letters count across the whole level, not per parent, so no
 * two badges in one stack ever match.
 *
 * @param items work items, not groups
 * @returns `{[key]: {stack, root, title, position, size, levels, sharing,
 *   label, under}}` for anything in a stack of two or more. `position` counts
 *   levels from the bottom, `size` counts pull requests, `levels` is the
 *   deepest position, `sharing` is how many sit on this level, `label` is the
 *   position plus a letter when `sharing` is above one, and `under` is the
 *   number of the pull request this one targets (null for the bottom).
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

  // Each level of each stack, in merge order, so the letters run the way the
  // smart order reads the cards: a parent's pull requests side by side.
  const levelOf = (group) => `${rootOf.get(group).item.key}|${depthOf.get(group)}`;
  const onLevel = new Map();
  const letterOf = new Map();
  for (const group of orderStacksForMerging(groups)) {
    const level = levelOf(group);
    const index = onLevel.get(level) ?? 0;
    letterOf.set(group, index);
    onLevel.set(level, index + 1);
  }
  const levelsOf = new Map();
  for (const group of groups) {
    const root = rootOf.get(group);
    levelsOf.set(root, Math.max(levelsOf.get(root) ?? 0, depthOf.get(group) + 1));
  }

  const where = {};
  for (const group of groups) {
    const root = rootOf.get(group);
    const size = sizeOf.get(root) ?? 1;
    if (size < 2) continue;
    const position = depthOf.get(group) + 1;
    const sharing = onLevel.get(levelOf(group)) ?? 1;
    const below = group === root ? null : parentOf.get(group);
    where[group.item.key] = {
      stack: root.item.number,
      root: root.item.key,
      title: typeof root.item.title === "string" ? root.item.title : "",
      position,
      size,
      levels: levelsOf.get(root) ?? position,
      sharing,
      label: sharing > 1 ? `${position}${letterFor(letterOf.get(group) ?? 0)}` : `${position}`,
      under: below ? below.item.number : null,
    };
  }
  return where;
}

/** 0 → "a", 25 → "z", 26 → "aa": the letters a spreadsheet gives its columns. */
function letterFor(index) {
  let rest = index;
  let letters = "";
  do {
    letters = String.fromCharCode(97 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return letters;
}

/**
 * The words on a stack badge, and the tooltip that explains them.
 *
 * The count after "of" is the levels, not the pull requests: "2a of 9" would
 * say there are nine levels. In a straight stack the two are the same, so a
 * straight stack reads exactly as it always did. The tooltip carries the rest.
 *
 * @param at one answer from `stackPositions`
 * @returns `{text, tip}`
 */
export function describeStackPosition(at) {
  const text = `${at.label} of ${at.levels}`;
  const many = (count) => `${count} pull request${count === 1 ? "" : "s"}`;
  if (at.position === 1) {
    return { text, tip: `The bottom of a stack of ${many(at.size)}. It merges first, and nothing is waiting on it.` };
  }
  const sits = at.under === null ? "" : ` It targets the branch of #${at.under}.`;
  const shared =
    at.sharing > 1
      ? ` Level ${at.position} of ${at.levels} holds ${many(at.sharing)}; the letter tells them apart.`
      : ` Level ${at.position} of ${at.levels}.`;
  return {
    text,
    tip: `In a stack of ${many(at.size)}.${shared}${sits} #${at.stack} merges first.`,
  };
}

/**
 * The stack each card lights up with, list by list.
 *
 * The light names the same stack as the badge on the card, and the badge counts
 * only the list its card is in (ADR 0020). So the light is worked out the same
 * way: each list on its own, and the answers put side by side.
 *
 * It was once worked out over the whole screen. Then one pull request on the
 * board that targeted a branch from the review row joined two stacks into one.
 * The badges still said "Stack #5843" and "Stack #6015", and pointing at either
 * lit every stacked card on the page (ADR 0027).
 *
 * @param lists the lists on screen, each an array of work items
 * @returns `{[key]: root}`, the key of the bottom of each card's stack
 */
export function stackLights(lists) {
  const lit = {};
  for (const list of Array.isArray(lists) ? lists : []) {
    for (const [key, at] of Object.entries(stackPositions(list))) lit[key] = at.root;
  }
  return lit;
}
