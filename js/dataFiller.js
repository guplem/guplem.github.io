import * as utils from "./utils.js";

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
    const data = await utils.fetchJsonData(dataUrl);

    // Extract the relevant data
    const rawData = data[dataKey];
    if (!rawData) {
      throw new Error("Could not find data with key " + dataKey + " in " + dataUrl);
    }

    // Add the data to the element
    await utils.markdownToHtmlElement(rawData, element, parseMarkdown, atttribute);
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
    const data = await utils.fetchJsonData(dataUrl);

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
      button.innerHTML = utils.capitalizeFirstLetter(entry, true, true) + " (" + entriesCount[entry] + ")";
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
  // Load the data
  const allWorks = (await utils.fetchJsonData(`../data/myWork.json`))["works"];

  // Filter the works
  const filteredWorks = [];
  for (const work of allWorks) {
    let hasSelectedType = false;
    for (const selectedType of selectedWorkTypes) {
      if (work.types && utils.allToLower(work.types).includes(selectedType)) {
        hasSelectedType = true;
        break;
      }
    }

    if (selectedWorkTypes.length > 0 && !hasSelectedType) {
      continue;
    }

    let hasSelectedSkill = false;
    for (const selectedSkill of selectedWorkSkills) {
      if (work.skills && utils.allToLower(work.skills).includes(selectedSkill)) {
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
      await utils.markdownToHtmlElement(work.title, titleElement);
    }

    if (work.image) {
      const imageElement = document.createElement("img");
      imageElement.src = work.image;
      workElement.appendChild(imageElement);
    }

    if (work.description) {
      const descriptionElement = document.createElement("div");
      workElement.appendChild(descriptionElement);
      await utils.markdownToHtmlElement(work.description, descriptionElement);
    }

    if (work.skills) {
      const skillsElement = document.createElement("div");
      workElement.appendChild(skillsElement);
      await utils.markdownToHtmlElement("Skills: " + work.skills.join(", "), skillsElement);
    }

    if (work.types) {
      const typesElement = document.createElement("div");
      workElement.appendChild(typesElement);
      await utils.markdownToHtmlElement("Types: " + work.types.join(", "), typesElement);
    }

    if (work.date) {
      const dateElement = document.createElement("div");
      workElement.appendChild(dateElement);
      await utils.markdownToHtmlElement("Date: " + work.date, dateElement);
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
  const data = await utils.fetchJsonData(`../data/info.json`);

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
