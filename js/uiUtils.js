import * as textUtils from "./textUtils.js";

/**
 * Convert markdown to HTML and set it to an element or fragment
 * @param {string | string[]} markdown
 * @param {HTMLElement | DocumentFragment} container
 * @param {boolean} parseMarkdown
 * @param {string} attribute
 * @param {Map<string, string>} tagsToSubstitute
 */
export async function setMarkdownInHtmlElement(markdown, container, parseMarkdown = true, attribute = "", tagsToSubstitute = new Map()) {
  if (!container) {
    throw new Error("Container is null or undefined");
  }

  // Process the markdown or text array
  const data = textUtils.turnTextArrayIntoDistinctPragraphs(markdown);
  const dataFormatted = parseMarkdown ? await textUtils.markdownToHtml(data, tagsToSubstitute) : data;

  if (container instanceof DocumentFragment) {
    // For DocumentFragment, create a temporary div to parse the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = String(dataFormatted);

    // Move all child nodes from the temporary div to the fragment
    while (tempDiv.firstChild) {
      container.appendChild(tempDiv.firstChild);
    }
  } else if (container instanceof HTMLElement) {
    // For HTMLElement, proceed as before
    if (attribute.length > 0) {
      container.setAttribute(attribute, String(dataFormatted));
    } else {
      container.innerHTML = String(dataFormatted);
    }
  } else {
    throw new Error("Container must be either an HTMLElement or a DocumentFragment");
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

/**
 * Get an element by its id
 * @param {string} elementId
 * @returns {HTMLElement}
 */
export function getElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Could not find element with id "${elementId}"`);
  }
  return element;
}
