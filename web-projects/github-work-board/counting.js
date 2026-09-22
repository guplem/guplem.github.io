// What the browser tab says, and what each count on the board leaves out.
//
// A board open in a tab behind three others is a board nobody looks at. The
// tab now carries the number, so the reader can see from anywhere that four
// things want them and come back on purpose rather than on a hunch (ADR 0030).
//
// **The reader chooses what the number means.** Each part of the board answers
// two questions of its own: does it add to the number in the tab, and does its
// own count include the cards pushed down (ADR 0026). The second question is
// not only about the tab: it is the same number the badge on that column shows.

/** The parts of the board that add up, until the reader says otherwise. */
export const DEFAULT_COUNTED = ["reviews", "ongoing", "needs-changes", "ready-to-merge"];

/**
 * Whether a count holds the work pushed down, until the reader says otherwise.
 *
 * True, because the badges counted everything before any of this existed.
 * Leaving that work out by default would change a number the reader already
 * reads, without asking them.
 */
export const DEFAULT_WITH_LOW_PRIORITY = true;

const COUNTED = new Set(DEFAULT_COUNTED);

/** What an area counts before the reader has said anything about it. */
export function defaultCounting(areaId) {
  return { counted: COUNTED.has(areaId), withLowPriority: DEFAULT_WITH_LOW_PRIORITY };
}

/**
 * Every area's count, and the number the tab carries.
 *
 * An area the reader left out of the tab still reports its own count, because
 * the badge on that column shows it either way.
 *
 * @param areas `[{id, label, keys}]`, one per part of the board, in reading order
 * @param lowKeys the keys the reader pushed down
 * @param settings `{[areaId]: {counted, withLowPriority}}`, the reader's choices
 * @returns `{total, parts}` where a part is `{id, label, count, excluded, counted}`
 */
export function countBoard(areas, lowKeys, settings) {
  const list = Array.isArray(areas) ? areas : [];
  const low = lowKeys instanceof Set ? lowKeys : new Set();
  const chosen = settings && typeof settings === "object" ? settings : {};

  const parts = list.map((area) => {
    const keys = Array.isArray(area?.keys) ? area.keys : [];
    const rule = { ...defaultCounting(area?.id), ...(chosen[area?.id] ?? {}) };
    const count = rule.withLowPriority ? keys.length : keys.filter((key) => !low.has(key)).length;
    return {
      id: area?.id,
      label: area?.label ?? "",
      count,
      excluded: keys.length - count,
      counted: rule.counted === true,
    };
  });

  const total = parts.reduce((sum, part) => (part.counted ? sum + part.count : sum), 0);
  return { total, parts };
}

/** The name in the tab. No number when there is nothing to come back for. */
export function tabTitle(total) {
  return Number.isFinite(total) && total > 0 ? `Work Board (${total})` : "Work Board";
}

/** Where the number comes from, one line per part the reader chose. */
export function describeBreakdown(parts) {
  const counted = (Array.isArray(parts) ? parts : []).filter((part) => part?.counted);
  if (counted.length === 0) return "No parts of the board are counted. Choose them in Settings.";
  return counted.map((part) => `${part.label}: ${part.count}`).join("\n");
}

/** What a count leaves out, or nothing at all when it leaves out nothing. */
export function describeExcluded(excluded) {
  if (!Number.isFinite(excluded) || excluded <= 0) return "";
  const one = excluded === 1;
  return `${excluded} card${one ? "" : "s"} marked "not a priority" ${one ? "is" : "are"} not counted`;
}
