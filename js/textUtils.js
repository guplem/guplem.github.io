// Import necessary modules for markdown processing
// @ts-ignore
import { unified } from "https://esm.sh/unified@10";
// @ts-ignore
import remarkParse from "https://esm.sh/remark-parse@10";
// @ts-ignore
import remarkBreaks from "https://esm.sh/remark-breaks@4";
// @ts-ignore
import remarkRehype from "https://esm.sh/remark-rehype@8";
// @ts-ignore
import rehypeStringify from "https://esm.sh/rehype-stringify@7";

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
 */
export async function markdownToHtml(markdown) {
  if (!markdown) {
    throw new Error("Markdown input is empty or undefined");
  }

  if (_markdownFormattedAsHtmlCache.has(markdown)) {
    return _markdownFormattedAsHtmlCache.get(markdown);
  }

  // Process markdown to HTML
  const processedHtml = await unified().use(remarkParse).use(remarkBreaks).use(remarkRehype).use(rehypeStringify).process(markdown);

  // Cache the processed HTML
  _markdownFormattedAsHtmlCache.set(markdown, processedHtml);
  return processedHtml;
}
