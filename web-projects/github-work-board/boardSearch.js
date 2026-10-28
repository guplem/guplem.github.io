// Finding one piece of work on the board by what the reader types.
//
// The question it answers is "where is #312, and what state is it in?". A
// number finds the issues and pull requests whose number contains it, so the
// board narrows as the reader types. Anything else is read as words that must
// all appear in the title or the repository.
//
// Two choices sit in the box, both off by default (ADR 0038):
// - **Match case**: a word counts only in the case it is typed in.
// - **Whole word**: a word must be a whole word, and a number the whole number,
//   so "31" no longer keeps #312.
// A pasted GitHub link names one piece of work, so it always finds its number
// exactly and its repository in any case, whatever the two choices say.
//
// The search only hides cards. It lives in memory, never in the address bar and
// never in `board.json`, and it counts for nothing (ADR 0038).

const GITHUB_LINK = /github\.com\/([^/\s]+\/[^/\s]+)\/(?:issues|pull)\/(\d+)/i;
const BARE_NUMBER = /^#?(\d+)$/;
// A letter, a digit or an underscore. Anything else ends a word.
const WORD_CHARACTER = "[\\p{L}\\p{N}_]";

/**
 * What the reader typed, read once.
 *
 * @param text the words in the search box
 * @param options `matchCase` and `wholeWord`, both off unless they are `true`
 * @returns `null` for an empty box, else the number as its digits (and the
 *   repository, when a link names one) or the words as typed, with the two
 *   choices
 */
export function readSearch(text, options = {}) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed === "") return null;
  const choices = { matchCase: options?.matchCase === true, wholeWord: options?.wholeWord === true };
  const link = GITHUB_LINK.exec(trimmed);
  if (link) return { number: link[2], repository: link[1].toLowerCase(), words: [], ...choices };
  const bare = BARE_NUMBER.exec(trimmed);
  if (bare) return { number: bare[1], repository: null, words: [], ...choices };
  return { number: null, repository: null, words: trimmed.split(/\s+/), ...choices };
}

function numberMatches(item, search) {
  const wanted = Number(search.number);
  if (search.repository !== null || search.wholeWord) return item?.number === wanted;
  return item?.number != null && String(item.number).includes(String(wanted));
}

function escapeForPattern(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordMatches(haystack, word, search) {
  if (search.wholeWord) {
    const pattern = `(?<!${WORD_CHARACTER})${escapeForPattern(word)}(?!${WORD_CHARACTER})`;
    return new RegExp(pattern, search.matchCase ? "u" : "iu").test(haystack);
  }
  return search.matchCase ? haystack.includes(word) : haystack.toLowerCase().includes(word.toLowerCase());
}

/** Whether one item answers the search. No search keeps everything. */
export function itemMatchesSearch(item, search) {
  if (!search) return true;
  const repository = String(item?.repository ?? "");
  if (search.number !== null) {
    if (!numberMatches(item, search)) return false;
    return search.repository === null || repository.toLowerCase() === search.repository;
  }
  const haystack = `${String(item?.title ?? "")} ${repository}`;
  return search.words.every((word) => wordMatches(haystack, word, search));
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
