// Choose a word, and build the links around it.
//
// The word on screen lives in the link (`?palabra=casa`), so a reader can share
// the word they got. See root ADR 0006.

/** The query parameter that holds the word. */
export const WORD_PARAM = "palabra";

/**
 * Pick a word at random, never the one already on screen.
 * @param {string[]} words the list to pick from
 * @param {() => number} random a number in [0, 1), like Math.random
 * @param {string} [current] the word on screen now
 */
export function pickWord(words, random = Math.random, current) {
  let index = Math.floor(random() * words.length);
  if (words[index] === current && words.length > 1) index = (index + 1) % words.length;
  return words[index];
}

/**
 * Read the word from a link's query string.
 * @returns {string|null} the word, or null when the link names no word from the list
 */
export function wordFromSearch(search, words) {
  const word = new URLSearchParams(search).get(WORD_PARAM)?.trim().toLowerCase();
  return word && words.includes(word) ? word : null;
}

/** The query string for a link to this word. */
export function searchForWord(word) {
  return `?${new URLSearchParams({ [WORD_PARAM]: word })}`;
}

/** The Wiktionary API call that returns the page source (wikitext) of one word. */
export function apiUrl(word) {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: word,
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  return `https://es.wiktionary.org/w/api.php?${params}`;
}

/** The word's page on Spanish Wiktionary. */
export function wiktionaryUrl(word) {
  return `https://es.wiktionary.org/wiki/${encodeURIComponent(word)}`;
}

/** The word's entry in the dictionary of the Real Academia Española. */
export function raeUrl(word) {
  return `https://dle.rae.es/${encodeURIComponent(word)}`;
}
