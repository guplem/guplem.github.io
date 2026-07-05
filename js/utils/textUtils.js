// @ts-ignore
import { marked } from "https://esm.sh/marked@17.0.5/es2022/marked.bundle.mjs";

marked.setOptions({ breaks: true });

// Pure helpers live in textCore.js (CDN-free so Bun can test them); re-exported
// here so callers keep one import surface.
export { capitalizeFirstLetter, allToLower, turnTextArrayIntoDistinctPragraphs, idFromText, allToId, workMatchesText } from "./textCore.js";

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
 * Returns works data in the shape { title, works }.
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
