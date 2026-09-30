// Finding one piece of work on the board by what the reader types.
//
// The question it answers is "where is #312, and what state is it in?". So a
// number finds that number exactly, and never a number that merely contains
// it: typing "31" must not keep #312 on screen. Anything else is read as words
// that must all appear in the title or the repository.
//
// The search only hides cards. It lives in memory, never in the address bar and
// never in `board.json`, and it counts for nothing (ADR 0038).

const GITHUB_LINK = /github\.com\/([^/\s]+\/[^/\s]+)\/(?:issues|pull)\/(\d+)/i;
const BARE_NUMBER = /^#?(\d+)$/;

/**
 * What the reader typed, read once.
 *
 * @param text the words in the search box
 * @returns `null` for an empty box, else the number (and the repository, when a
 *   link names one) or the words, in lower case
 */
export function readSearch(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed === "") return null;
  const link = GITHUB_LINK.exec(trimmed);
  if (link) return { number: Number(link[2]), repository: link[1].toLowerCase(), words: [] };
  const bare = BARE_NUMBER.exec(trimmed);
  if (bare) return { number: Number(bare[1]), repository: null, words: [] };
  return { number: null, repository: null, words: trimmed.toLowerCase().split(/\s+/) };
}

/** Whether one item answers the search. No search keeps everything. */
export function itemMatchesSearch(item, search) {
  if (!search) return true;
  const repository = String(item?.repository ?? "").toLowerCase();
  if (search.number !== null) {
    if (item?.number !== search.number) return false;
    return search.repository === null || repository === search.repository;
  }
  const haystack = `${String(item?.title ?? "").toLowerCase()} ${repository}`;
  return search.words.every((word) => haystack.includes(word));
}

/**
 * The cards of a column that answer the search.
 *
 * A group is a card and the pull requests nested in it. The card stays when it
 * or anything nested in it matches, and it stays whole: a pull request is drawn
 * inside its issue, so that card is where the reader finds it.
 */
export function searchGroups(groups, search) {
  const list = Array.isArray(groups) ? groups : [];
  if (!search) return [...list];
  return list.filter(
    (group) =>
      itemMatchesSearch(group?.item, search) ||
      (Array.isArray(group?.children) && group.children.some((child) => itemMatchesSearch(child, search))),
  );
}

/** The items of a flat list that answer the search, in the order they came. */
export function searchItems(items, search) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => itemMatchesSearch(item, search));
}
