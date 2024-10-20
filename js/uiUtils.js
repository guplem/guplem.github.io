import * as textUtils from "./textUtils.js";

/**
 * Convert markdown to HTML and set it to an element
 * @param {string | string[]} markdown
 * @param {HTMLElement} element
 * @param {boolean} parseMarkdown
 * @param {string} atttribute
 */
export async function setMarkdownInHtmlElement(markdown, element, parseMarkdown = true, atttribute = "") {
  if (!element) {
    throw new Error("Element is null or undefined");
  }

  // Process the markdown or text array
  const data = textUtils.turnTextArrayIntoDistinctPragraphs(markdown);
  const dataFormatted = parseMarkdown ? await textUtils.markdownToHtml(data) : data;

  // Add the formatted data to the element
  if (atttribute.length > 0) {
    element.setAttribute(atttribute, String(dataFormatted));
  } else {
    element.innerHTML = String(dataFormatted);
  }
}

/**
 * Create a button element
 * @param {string} text
 * @param {((this: GlobalEventHandlers, ev: MouseEvent) => any) | null} onClick
 * @returns
 */
export function createButton(text, onClick) {
  const button = document.createElement("button");
  button.textContent = text;
  button.onclick = onClick;
  return button;
}

/**
 * Clear an element
 * @param {HTMLElement} element
 */
export function clearElement(element) {
  element.innerHTML = "";
}
