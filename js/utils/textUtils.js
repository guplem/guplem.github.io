// @ts-ignore
import { marked } from "https://esm.sh/marked@14?standalone";

marked.setOptions({ breaks: true });

// Cache to store JSON data for faster subsequent access
const _jsonDataCached = new Map();

/**
 * Fetch JSON data from a URL
 * @param {RequestInfo | URL} url
 * @returns {Promise<any>}
 */
export async function fetchJsonData(url) {
  if (_jsonDataCached.has(url)) {
    return _jsonDataCached.get(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${url}`);
  }
  const data = await response.json();

  _jsonDataCached.set(url, data);
  return data;
}

// Cache for the assembled works data
/** @type {{ title: string, works: any[] } | null} */
let _worksDataCached = null;

/**
 * Load all works by reading the project manifest and fetching each project file.
 * Returns an object compatible with the old myWork.json format: { title, works }
 * @returns {Promise<{ title: string, works: any[] }>}
 */
export async function fetchAllWorks() {
  if (_worksDataCached) {
    return _worksDataCached;
  }

  const manifest = await fetchJsonData("../data/projects/index.json");
  const projectPromises = manifest.projects.map(
    /** @param {string} filename */ (filename) => fetchJsonData(`../data/projects/${filename}`)
  );
  const works = await Promise.all(projectPromises);

  _worksDataCached = { title: manifest.title, works };
  return _worksDataCached;
}

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

// Cache to store processed HTML of markdown for faster subsequent access
const _markdownFormattedAsHtmlCache = new Map();

/**
 * Convert markdown to HTML
 * @param {string} markdown
 * @returns {Promise<string>}
 * @param {Map<string,string>} tagsToSubstitute
 */
export async function markdownToHtml(markdown, tagsToSubstitute = new Map()) {
  if (!markdown) {
    throw new Error("Markdown input is empty or undefined");
  }

  const substitutedTagsIdentifier = Array.from(tagsToSubstitute)
    .map(([key, value]) => "Tag_" + key + "_to_" + value)
    .join("-");

  const cacheKey = `${markdown}-${substitutedTagsIdentifier}`;

  if (_markdownFormattedAsHtmlCache.has(cacheKey)) {
    return _markdownFormattedAsHtmlCache.get(cacheKey);
  }

  let htmlString = await marked.parse(markdown);

  // Replace tags using native DOMParser (e.g. <p> -> <h1>)
  for (const [tagToReplace, substituteTag] of tagsToSubstitute) {
    const doc = new DOMParser().parseFromString(htmlString, "text/html");
    doc.querySelectorAll(tagToReplace).forEach((el) => {
      const replacement = document.createElement(substituteTag);
      replacement.innerHTML = el.innerHTML;
      el.replaceWith(replacement);
    });
    htmlString = doc.body.innerHTML;
  }

  // Cache the processed HTML
  _markdownFormattedAsHtmlCache.set(cacheKey, htmlString);
  return htmlString;
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
