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
 * Strip inline markdown down to plain text: removes `**`/`*` emphasis markers
 * and leading `#` heading markers, and reduces `[text](url)` links to their
 * text. Used to build the crawler-facing static HTML fallback blocks (see
 * scripts/generateSeoBlocks.js), where the words matter but formatting does not.
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToPlainText(markdown) {
  if (typeof markdown !== "string") {
    throw new Error("Input markdown is not a string");
  }
  return (
    markdown
      // Heading markers at the start of any line ("#### Title" -> "Title")
      .replace(/^#+\s*/gm, "")
      // Links first, so emphasis inside link text is still cleaned afterwards
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .trim()
  );
}

/**
 * The three states one tag filter (a type or a skill chip) can hold.
 * @typedef {"none" | "include" | "exclude"} TagFilterState
 */

/**
 * The state a tag filter takes after one more click. The cycle is
 * none -> include -> exclude -> none, so the second click on a chip hides the
 * works that carry that tag. Any unknown state counts as "none".
 * @param {TagFilterState | undefined} current
 * @returns {TagFilterState}
 */
export function nextTagFilterState(current) {
  if (current === "include") return "exclude";
  if (current === "exclude") return "none";
  return "include";
}

/**
 * Whether a work passes the type and skill chip filters. Two rules:
 * a work must carry at least one tag of every non-empty include list (OR
 * inside a group, AND between the two groups), and a work must carry no
 * excluded tag. An exclusion always wins over an inclusion.
 *
 * The filter lists hold ids (`idFromText` output), so the work's own tags are
 * normalized here before the comparison.
 * @param {{ types?: string[], skills?: string[] }} work
 * @param {{ includedTypes?: string[], excludedTypes?: string[], includedSkills?: string[], excludedSkills?: string[] }} filters
 * @returns {boolean}
 */
export function workMatchesTagFilters(work, filters) {
  const groups = [
    { workTags: work.types, included: filters.includedTypes, excluded: filters.excludedTypes },
    { workTags: work.skills, included: filters.includedSkills, excluded: filters.excludedSkills },
  ];

  return groups.every(({ workTags, included, excluded }) => {
    const tagIds = allToId(Array.isArray(workTags) ? workTags : []);

    if (excluded?.length && tagIds.some((tagId) => excluded.includes(tagId))) {
      return false;
    }
    if (included?.length && !tagIds.some((tagId) => included.includes(tagId))) {
      return false;
    }
    return true;
  });
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
