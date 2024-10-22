import * as textUtils from "./textUtils.js";
import * as uiUtils from "./uiUtils.js";

// Initialize arrays to store selected work types and skills
const selectedWorkTypes = [];
const selectedWorkSkills = [];

// Fill page elements with content from JSON files
fillWithText("page-title", "../data/info.json", "web-title", false);
fillWithText("page-description", "../data/info.json", "web-description", false, "content");
fillWithText("introduction", "../data/info.json", "introduction", true, "", new Map([["p", "h1"]]));
fillWithText("aboutMe", "../data/info.json", "aboutMe");
fillWithGroupedButtons("myWorkTypes", `../data/myWork.json`, "works", "types", onClickWorkType);
fillWithGroupedButtons("myWorkSkills", `../data/myWork.json`, "works", "skills", onClickWorkSkill);
displayFilteredWorks();
displayAdditionalSections();
displayContactInfo();

/**
 * Fill an element with text from a JSON file
 * @param {string} elementId
 * @param {RequestInfo | URL} dataUrl
 * @param {string} dataKey
 * @param {boolean} parseMarkdown
 * @param {string} attribute
 * @param {Map<string, string>} tagsToSubstitute
 */
async function fillWithText(elementId, dataUrl, dataKey, parseMarkdown = true, attribute = "", tagsToSubstitute = new Map()) {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Could not find element with id ${elementId}`);
    }

    const data = await textUtils.fetchJsonData(dataUrl);
    const rawData = data[dataKey];
    if (!rawData) {
      throw new Error("Could not find data with key " + dataKey + " in " + dataUrl);
    }

    if (parseMarkdown) {
      const fragment = document.createDocumentFragment();
      await uiUtils.setMarkdownInHtmlElement(rawData, fragment, parseMarkdown, attribute, tagsToSubstitute);
      element.appendChild(fragment);
    } else {
      await uiUtils.setMarkdownInHtmlElement(rawData, element, parseMarkdown, attribute, tagsToSubstitute);
    }
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
 * @param {boolean} addShowExperiencesAriaLabel
 */
async function fillWithGroupedButtons(elementId, dataUrl, dataKeyToGroup, dataKeyInGroup, onClick, addShowExperiencesAriaLabel = true) {
  try {
    // Find the target element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Could not find element with id ${elementId}`);
    }

    // Load the data
    const data = await textUtils.fetchJsonData(dataUrl);

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

    // Create a document fragment
    const fragment = document.createDocumentFragment();

    // Create and add buttons to the fragment
    for (const entry in entriesCount) {
      const textButton = textUtils.capitalizeFirstLetter(entry, true, true) + " (" + entriesCount[entry] + ")";
      const button = uiUtils.createButton(textButton, () => onClick(entry, button));
      if (addShowExperiencesAriaLabel) {
        button.setAttribute("aria-label", `Show ${textUtils.capitalizeFirstLetter(entry, true, true)} experiences`);
      }
      fragment.appendChild(button);
    }

    // Append the fragment to the element
    element.appendChild(fragment);
  } catch (error) {
    console.error(`Error filling data in element with id ${elementId}`, error);
  }
}

/**
 * Get filtered works based on selected types and skills
 * @returns {Promise<any[]>}
 */
async function getFilterWorks() {
  // Load the data
  const allWorks = (await textUtils.fetchJsonData(`../data/myWork.json`))["works"];

  // Filter the works
  const filteredWorks = [];
  for (const work of allWorks) {
    let hasSelectedType = false;
    for (const selectedType of selectedWorkTypes) {
      if (work.types && textUtils.allToLower(work.types).includes(selectedType)) {
        hasSelectedType = true;
        break;
      }
    }

    if (selectedWorkTypes.length > 0 && !hasSelectedType) {
      continue;
    }

    let hasSelectedSkill = false;
    for (const selectedSkill of selectedWorkSkills) {
      if (work.skills && textUtils.allToLower(work.skills).includes(selectedSkill)) {
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
 * Debounce a function, making it callable only after a certain delay, and preventing multiple calls in the meantime
 * @param {(...args: any[]) => void} func
 * @param {number} delay
 */
// function debounce(func, delay) {
//   let timeoutId;
//   return function (...args) {
//     clearTimeout(timeoutId);
//     timeoutId = setTimeout(() => func.apply(this, args), delay);
//   };
// }

// // Debounce the display of filtered works
// const debouncedDisplayFilteredWorks = debounce(displayFilteredWorks, 150);

/**
 * Display filtered works
 */
async function displayFilteredWorks() {
  // Calculate the maximum number of columns based on the screen width
  const screenWidth = window.innerWidth;
  let maxColumns = 1;
  const minColumnWidth = 300;
  maxColumns = Math.floor(screenWidth / minColumnWidth);
  console.log("Max columns:", maxColumns);

  // Get filtered works
  const filteredWorks = await getFilterWorks();

  const elementId = "myWorkFiltered";

  // Find the target element
  const element = uiUtils.getElement(elementId);

  // Clear existing content
  uiUtils.clearElement(element);

  const columns = [];
  const columnFragments = [];

  // Create columns and fragments for batch appending
  for (let i = 1; i <= maxColumns; i++) {
    const columnElement = document.createElement("div");
    columnElement.classList.add("myWorkColumn");
    columns.push(columnElement);
    columnFragments.push(document.createDocumentFragment());
  }

  /** ADAPT FROM HERE **/

  // Sort works by date
  filteredWorks.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });

  // Add work elements to the corresponding column fragment
  let columnIndex = 0;

  for (const work of filteredWorks) {
    const workElement = document.createElement("div");
    workElement.classList.add("work");
    workElement.tabIndex = 0; // Make it focusable with keyboard

    // Add work details to the element
    if (work.title?.length) {
      const titleElement = document.createElement("h2");
      workElement.appendChild(titleElement);
      await uiUtils.setMarkdownInHtmlElement(work.title, titleElement);
    }

    if (work.image?.length) {
      const imageElement = document.createElement("img");
      imageElement.src = work.image;
      imageElement.alt = work.imageAlt || `Image for ${work.title}`;
      workElement.appendChild(imageElement);
    }

    if (work.description?.length) {
      const descriptionElement = document.createElement("div");
      workElement.appendChild(descriptionElement);
      await uiUtils.setMarkdownInHtmlElement(work.description, descriptionElement);
    }

    if (work.skills?.length) {
      const skillsElement = document.createElement("div");
      workElement.appendChild(skillsElement);
      await uiUtils.setMarkdownInHtmlElement("Skills: " + work.skills.join(", "), skillsElement);
    }

    if (work.types?.length) {
      const typesElement = document.createElement("div");
      workElement.appendChild(typesElement);
      await uiUtils.setMarkdownInHtmlElement("Types: " + work.types.join(", "), typesElement);
    }

    if (work.date?.length) {
      const dateElement = document.createElement("div");
      workElement.appendChild(dateElement);
      await uiUtils.setMarkdownInHtmlElement("Date: " + work.date, dateElement);
    }

    // Add workElement to the current column's fragment
    columnFragments[columnIndex].appendChild(workElement);

    // Update columnIndex to distribute works evenly
    columnIndex = (columnIndex + 1) % maxColumns;
  }

  // Append column fragments to their respective columns and then to the DOM
  for (let i = 0; i < maxColumns; i++) {
    columns[i].appendChild(columnFragments[i]);
    element.appendChild(columns[i]);
  }
}

/**
 * Display additional sections
 */
async function displayAdditionalSections() {
  const elementId = "additionalSections";

  // Find the target element
  const element = uiUtils.getElement(elementId);

  // Load the data
  const data = await textUtils.fetchJsonData(`../data/info.json`);

  if (!data["additionalSections"]) {
    // No additional sections found in data
    return;
  }

  // Create a document fragment
  const fragment = document.createDocumentFragment();

  // Create and add additional section elements to the fragment
  for (const section of data.additionalSections) {
    const sectionElement = document.createElement("div");
    sectionElement.classList.add("additionalSection");

    if (section.title?.length) {
      const titleElement = document.createElement("h1");
      sectionElement.appendChild(titleElement);
      await uiUtils.setMarkdownInHtmlElement(section.title, titleElement);
    }

    if (section.content?.length) {
      const contentElement = document.createElement("div");
      sectionElement.appendChild(contentElement);
      await uiUtils.setMarkdownInHtmlElement(section.content, contentElement);
    }

    if (section.image?.length) {
      const imageElement = document.createElement("img");
      imageElement.src = section.image;
      imageElement.alt = section.imageAlt || `Image of ${section.title}`;
      sectionElement.appendChild(imageElement);
    }

    fragment.appendChild(sectionElement);
  }

  // Append the fragment to the element
  element.appendChild(fragment);
}

/**
 * Display contact information
 */
async function displayContactInfo() {
  const elementId = "contactMethods";

  // Find the target element
  const element = uiUtils.getElement(elementId);

  // Load the data
  const data = await textUtils.fetchJsonData(`../data/info.json`);

  if (!data["contact"]) {
    console.warn("No contact info found in data");
    return;
  }

  // Create a document fragment
  const fragment = document.createDocumentFragment();

  // Create and add contact elements to the fragment
  for (const contactInfo of data.contact) {
    const contactElement = document.createElement("div");
    contactElement.classList.add("contactMethod");

    const linkElement = document.createElement("a");
    linkElement.href = contactInfo.link;
    linkElement.target = "_blank";
    linkElement.rel = "noopener noreferrer";
    const text = contactInfo.text ?? contactInfo.link;
    linkElement.title = `${contactInfo.name}: ${text}`;

    if (contactInfo.icon?.length) {
      const imageElement = document.createElement("img");
      imageElement.src = contactInfo.icon;
      imageElement.alt = text;
      linkElement.appendChild(imageElement);
    }

    linkElement.appendChild(document.createTextNode(text));
    contactElement.appendChild(linkElement);
    fragment.appendChild(contactElement);
  }

  // Append the fragment to the element
  element.appendChild(fragment);
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

  // debouncedDisplayFilteredWorks();
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

  // debouncedDisplayFilteredWorks();
  displayFilteredWorks();
}
