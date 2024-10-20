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

// Initialize arrays to store selected work types and skills
const selectedWorkTypes = [];
const selectedWorkSkills = [];

// Fill page elements with content from JSON files
fillWithText("page-title", "../data/info.json", "web-title", false);
fillWithText("page-description", "../data/info.json", "web-description", false, "content");
fillWithText("introduction", "../data/info.json", "introduction");
fillWithText("aboutMe", "../data/info.json", "aboutMe");
fillWithGroupedButtons("myWorkTypes", `../data/myWork.json`, "works", "types", onClickWorkType);
fillWithGroupedButtons("myWorkSkills", `../data/myWork.json`, "works", "skills", onClickWorkSkill);
displayFilteredWorks();
// displayAdditionalSections();
displayContactInfo();

/**
 * Capitalize the first letter of a string
 * @param {string} string
 * @param {boolean} lowerRest
 * @param {boolean} firstLetterOfEveryWord
 * @returns {string}
 */
function capitalizeFirstLetter(string, lowerRest = true, firstLetterOfEveryWord = false) {
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
function allToLower(array) {
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
function turnTextArrayIntoDistinctPragraphs(textArray) {
  if (Array.isArray(textArray)) {
    return textArray.join("\n\n");
  }
  return textArray;
}

// Cache to store processed HTML of markdown for faster subsequent access
const markdownToHtmlCache = new Map();

/**
 * Convert markdown to HTML
 * @param {string} markdown
 * @returns {Promise<string>}
 */
async function markdownToHtml(markdown) {
  if (!markdown) {
    throw new Error("Markdown input is empty or undefined");
  }

  if (markdownToHtmlCache.has(markdown)) {
    return markdownToHtmlCache.get(markdown);
  }

  // Process markdown to HTML
  const processedHtml = await unified().use(remarkParse).use(remarkBreaks).use(remarkRehype).use(rehypeStringify).process(markdown);

  // Cache the processed HTML
  markdownToHtmlCache.set(markdown, processedHtml);
  return processedHtml;
}

/**
 * Convert markdown to HTML and set it to an element
 * @param {string | string[]} markdown
 * @param {HTMLElement} element
 * @param {boolean} parseMarkdown
 * @param {string} atttribute
 */
async function markdownToHtmlElement(markdown, element, parseMarkdown = true, atttribute = "") {
  if (!element) {
    throw new Error("Element is null or undefined");
  }

  // Process the markdown or text array
  const data = turnTextArrayIntoDistinctPragraphs(markdown);
  const dataFormatted = parseMarkdown ? await markdownToHtml(data) : data;

  // Add the formatted data to the element
  if (atttribute.length > 0) {
    element.setAttribute(atttribute, String(dataFormatted));
  } else {
    element.innerHTML = String(dataFormatted);
  }
}

/**
 * Fill an element with text from a JSON file
 * @param {string} elementId
 * @param {RequestInfo | URL} dataUrl
 * @param {string} dataKey
 * @param {boolean} parseMarkdown
 * @param {string} atttribute
 */
async function fillWithText(elementId, dataUrl, dataKey, parseMarkdown = true, atttribute = "") {
  try {
    // Find the target element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Could not find element with id ${elementId}`);
    }

    // Load the data
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch data from " + dataUrl);
    }
    const data = await response.json();

    // Extract the relevant data
    const rawData = data[dataKey];
    if (!rawData) {
      throw new Error("Could not find data with key " + dataKey + " in " + dataUrl);
    }

    // Add the data to the element
    await markdownToHtmlElement(rawData, element, parseMarkdown, atttribute);
  } catch (error) {
    console.error("Error filling data in element with id " + elementId, error);
  }
}

/**
 * Fill an element with grouped buttons from a JSON file
 * @param {string} elementId
 * @param {RequestInfo | URL} dataUrl
 * @param {string} dataKeyToGroup
 * @param {string} dataKeyInGroup
 * @param {(arg0: string, arg1: HTMLButtonElement) => void} onClick
 */
async function fillWithGroupedButtons(elementId, dataUrl, dataKeyToGroup, dataKeyInGroup, onClick) {
  try {
    // Find the target element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Could not find element with id ${elementId}`);
    }

    // Load the data
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch data from ${dataUrl}`);
    }
    const data = await response.json();

    // Process the data
    const allEntries = [];
    for (const group of data[dataKeyToGroup]) {
      if (!group[dataKeyInGroup]) {
        continue;
      }
      for (const rawData of group[dataKeyInGroup]) {
        allEntries.push(rawData.toLowerCase());
      }
    }

    // Count entries
    const entriesCount = {};
    for (const entry of allEntries) {
      if (entriesCount[entry]) {
        entriesCount[entry]++;
      } else {
        entriesCount[entry] = 1;
      }
    }

    // Create and add buttons to the element
    for (const entry in entriesCount) {
      const button = document.createElement("button");
      button.innerHTML = capitalizeFirstLetter(entry, true, true) + " (" + entriesCount[entry] + ")";
      button.onclick = () => {
        onClick(entry, button);
      };
      element.appendChild(button);
    }
  } catch (error) {
    console.error(`Error filling data in element with id ${elementId}`, error);
  }
}

/**
 * Get filtered works based on selected types and skills
 * @returns {Promise<any[]>}
 */
async function getFilterWorks() {
  const dataUrl = `../data/myWork.json`;

  // Load the data
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${dataUrl}`);
  }
  const allWorks = (await response.json())["works"];

  // Filter the works
  const filteredWorks = [];
  for (const work of allWorks) {
    let hasSelectedType = false;
    for (const selectedType of selectedWorkTypes) {
      if (work.types && allToLower(work.types).includes(selectedType)) {
        hasSelectedType = true;
        break;
      }
    }

    if (selectedWorkTypes.length > 0 && !hasSelectedType) {
      continue;
    }

    let hasSelectedSkill = false;
    for (const selectedSkill of selectedWorkSkills) {
      if (work.skills && allToLower(work.skills).includes(selectedSkill)) {
        hasSelectedSkill = true;
        break;
      }
    }

    if (selectedWorkSkills.length > 0 && !hasSelectedSkill) {
      continue;
    }

    filteredWorks.push(work);
  }

  return filteredWorks;
}

/**
 * Display filtered works
 */
async function displayFilteredWorks() {
  // Get filtered works
  const filteredWorks = await getFilterWorks();

  const elementId = "myWorkFiltered";

  // Find the target element
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Could not find element with id ${elementId}`);
  }

  // Clear existing content
  element.innerHTML = "";

  // Sort works by date
  filteredWorks.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });

  // Create and add work elements
  for (const work of filteredWorks) {
    const workElement = document.createElement("div");
    workElement.classList.add("work");
    element.appendChild(workElement);

    // Add work details to the element
    if (work.title) {
      const titleElement = document.createElement("h2");
      workElement.appendChild(titleElement);
      await markdownToHtmlElement(work.title, titleElement);
    }

    if (work.image) {
      const imageElement = document.createElement("img");
      imageElement.src = work.image;
      workElement.appendChild(imageElement);
    }

    if (work.description) {
      const descriptionElement = document.createElement("div");
      workElement.appendChild(descriptionElement);
      await markdownToHtmlElement(work.description, descriptionElement);
    }

    if (work.skills) {
      const skillsElement = document.createElement("div");
      workElement.appendChild(skillsElement);
      await markdownToHtmlElement("Skills: " + work.skills.join(", "), skillsElement);
    }

    if (work.types) {
      const typesElement = document.createElement("div");
      workElement.appendChild(typesElement);
      await markdownToHtmlElement("Types: " + work.types.join(", "), typesElement);
    }

    if (work.date) {
      const dateElement = document.createElement("div");
      workElement.appendChild(dateElement);
      await markdownToHtmlElement("Date: " + work.date, dateElement);
    }

    element.appendChild(workElement);
  }
}

/**
 * Display contact information
 */
async function displayContactInfo() {
  const elementId = "contactMethods";

  // Find the target element
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Could not find element with id ${elementId}`);
  }

  // Load the data
  const dataUrl = `../data/info.json`;
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${dataUrl}`);
  }
  const data = await response.json();

  if (!data["contact"]) {
    console.warn("No contact info found in data");
    return;
  }

  // Create and add contact elements
  for (const contactInfo of data.contact) {
    const contactElement = document.createElement("div");
    contactElement.classList.add("contactMethod");
    element.appendChild(contactElement);

    const linkElement = document.createElement("a");
    linkElement.href = contactInfo.link;
    linkElement.target = "_blank";
    linkElement.rel = "noopener noreferrer";
    const text = contactInfo.text ? contactInfo.text : contactInfo.link;
    linkElement.title = contactInfo.name + ": " + text;
    contactElement.appendChild(linkElement);

    if (contactInfo.icon) {
      const imageElement = document.createElement("img");
      imageElement.src = contactInfo.icon;
      imageElement.alt = text;
      linkElement.appendChild(imageElement);
    }

    linkElement.appendChild(document.createTextNode(text));
  }
}

/**
 * Handle click event for work type buttons
 * @param {string} workType
 * @param {HTMLButtonElement} clickedElement
 */
function onClickWorkType(workType, clickedElement) {
  if (selectedWorkTypes.includes(workType)) {
    selectedWorkTypes.splice(selectedWorkTypes.indexOf(workType), 1);
    clickedElement.removeAttribute("selected");
  } else {
    selectedWorkTypes.push(workType);
    clickedElement.setAttribute("selected", "");
  }

  displayFilteredWorks();
}

/**
 * Handle click event for work skill buttons
 * @param {string} workSkill
 * @param {HTMLButtonElement} clickedElement
 */
function onClickWorkSkill(workSkill, clickedElement) {
  if (selectedWorkSkills.includes(workSkill)) {
    selectedWorkSkills.splice(selectedWorkSkills.indexOf(workSkill), 1);
    clickedElement.removeAttribute("selected");
  } else {
    selectedWorkSkills.push(workSkill);
    clickedElement.setAttribute("selected", "");
  }

  displayFilteredWorks();
}
