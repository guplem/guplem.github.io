// Pure text/string helpers with no browser or CDN dependencies, so they can
// run under `bun test`. Rendering/fetching helpers live in textUtils.js.

/**
 * Capitalize the first letter of a string
 * @param {string} string
 * @param {boolean} lowerRest
 * @param {boolean} firstLetterOfEveryWord
 * @returns {string}
 */
export function capitalizeFirstLetter(string, lowerRest = true, firstLetterOfEveryWord = false) {
  if (!string) {
    throw new Error("Input string is empty or undefined");
  }

  if (typeof string !== "string") {
    throw new Error("Input string is not a string");
  }

  if (firstLetterOfEveryWord) {
    return string
      .split(" ")
      .map((word) => capitalizeFirstLetter(word, lowerRest))
      .join(" ");
  }
  if (lowerRest) {
    return string.charAt(0).toUpperCase() + string.toLowerCase().slice(1);
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Convert all array elements to lowercase
 * @param {string[]} array
 * @returns {string[]}
 */
export function allToLower(array) {
  if (!Array.isArray(array)) {
    throw new Error("Input is not an array");
  }
  return array.map((item) => item.toLowerCase());
}

/**
 * Convert text array to distinct paragraphs
 * @param {string | string[]} textArray
 * @returns {string}
 */
export function turnTextArrayIntoDistinctPragraphs(textArray) {
  if (Array.isArray(textArray)) {
    return textArray.join("\n\n");
  }
  return textArray;
}

/**
 *
 * @param {string} text
 * @returns {string}
 */

export function idFromText(text) {
  if (!text) {
    throw new Error("Text input is empty or undefined");
  }

  if (typeof text !== "string") {
    throw new Error("Text input is not a string");
  }

  let sanitazed = capitalizeFirstLetter(text, true, true).replace(/ /g, "");
  // Remove special characters
  sanitazed = sanitazed.replace(/[^\w\s]/gi, "");
  // remove "'", "’", ":", "(", ")", "!", "?", ".", ","
  sanitazed = sanitazed.replace(/['’:\(\)!?,.]/gi, "");
  return sanitazed.trim();
}

/**
 *
 * @param {string[]} array
 * @returns {string[]}
 */
export function allToId(array) {
  if (!Array.isArray(array)) {
    throw new Error("Input is not an array");
  }
  return array.map((item) => idFromText(item));
}

/**
 * Whether a work matches a free-text search query. The query is split into
 * whitespace-separated tokens; every token must appear (case-insensitive) in
 * the work's title, description, or skills. An empty query matches everything.
 * Description markdown is matched raw (the rendered HTML is never stored).
 * @param {{ title?: string, description?: string[], skills?: string[] }} work
 * @param {string} query
 * @returns {boolean}
 */
export function workMatchesText(work, query) {
  const normalized = (query || "").trim().toLowerCase();
  if (!normalized) return true;

  const description = Array.isArray(work.description) ? work.description : [];
  const skills = Array.isArray(work.skills) ? work.skills : [];
  const haystack = [work.title, ...description, ...skills].filter(Boolean).join(" ").toLowerCase();

  return normalized.split(/\s+/).every((token) => haystack.includes(token));
}
