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

const selectedWorkTypes = [];
const selectedWorkSkills = [];

fillWithText("page-title", "../data/info.json", "web-title", false);
fillWithText("page-description", "../data/info.json", "web-description", false, "content");
fillWithText("introduction", "../data/info.json", "introduction");
fillWithText("aboutMe", "../data/info.json", "aboutMe");
// fillWithButtons("myWorkTypes", "../data/myWork.json", "works.types");
fillWithGroupedButtons("myWorkTypes", `../data/myWork.json`, "works", "types", onClickWorkType);
fillWithGroupedButtons("myWorkSkills", "../data/myWork.json", "works", "skills", onClickWorkSkill);
displayFilteredWorks();

// This is a cache to store the processed HTML of the markdown so we don't have to process it again and everything is faster
const markdownToHtmlCache = new Map();
/**
 * @param {string} markdown
 */
async function markdownToHtml(markdown) {
  if (markdownToHtmlCache.has(markdown)) {
    return markdownToHtmlCache.get(markdown);
  }

  const processedHtml = await unified().use(remarkParse).use(remarkBreaks).use(remarkRehype).use(rehypeStringify).process(markdown);

  markdownToHtmlCache.set(markdown, processedHtml);
  return processedHtml;
}

/**
 * @param {string | string[]} textArray
 */
function turnTextArrayIntoDistinctPragraphs(textArray) {
  if (Array.isArray(textArray)) {
    return textArray.join("\n\n");
  }
  return textArray;
}

/**
 * @param {string} string
 */
function capitalizeFirstLetter(string, lowerRest = true, firstLetterOfEveryWord = false) {
  //   return string.charAt(0).toUpperCase() + string.toLowerCase().slice(1);

  if (firstLetterOfEveryWord) {
    return string
      .split(" ")
      .map((/** @type {string} */ word) => capitalizeFirstLetter(word, lowerRest))
      .join(" ");
  }
  if (lowerRest) {
    return string.charAt(0).toUpperCase() + string.toLowerCase().slice(1);
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * @param {string[]} array
 */
function allToLower(array) {
  return array.map((/** @type {string} */ item) => item.toLowerCase());
}

/**
 * @param {string | string[]} markdown
 * @param {HTMLElement} element
 */
async function markdownToHtmlElement(markdown, element, parseMarkdown = true, atttribute = "") {
  const data = turnTextArrayIntoDistinctPragraphs(markdown);
  const dataFormatted = parseMarkdown ? await markdownToHtml(data) : data;

  if (atttribute.length > 0) {
    element.setAttribute(atttribute, String(dataFormatted));
    return;
  } else {
    element.innerHTML = String(dataFormatted);
  }
}

/**
 * @param {string} elementId
 * @param {RequestInfo | URL} dataUrl
 * @param {string} dataKey
 */
async function fillWithText(elementId, dataUrl, dataKey, parseMarkdown = true, atttribute = "") {
  console.log(`${elementId} START) Filling data as text`);

  try {
    // Find the element
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

    // Find the data
    let rawData = data[dataKey];
    if (!rawData) {
      throw new Error("Could not find data with key " + dataKey + " in " + dataUrl);
    }

    await markdownToHtmlElement(rawData, element, parseMarkdown, atttribute);

    console.log(elementId + " END) Filling data as text");
  } catch (error) {
    console.error("Error filling data in element with id " + elementId, error);
  }
}

/**
 * @param {string} elementId
 * @param {RequestInfo | URL} dataUrl
 * @param {string} dataKeyToGroup
 * @param {string} dataKeyInGroup
 * @param {{ (arg0: string, arg1: HTMLButtonElement): void; }} onClick
 */
async function fillWithGroupedButtons(elementId, dataUrl, dataKeyToGroup, dataKeyInGroup, onClick) {
  console.log(elementId + " START) Filling data as buttons");

  try {
    // Find the element
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

    // Find the data
    const allEntries = [];
    for (const group of data[dataKeyToGroup]) {
      if (!group[dataKeyInGroup]) {
        continue;
      }
      for (const rawData of group[dataKeyInGroup]) {
        allEntries.push(rawData.toLowerCase());
      }
    }

    // Count the entries
    const entriesCount = {};
    for (const entry of allEntries) {
      if (entriesCount[entry]) {
        entriesCount[entry]++;
      } else {
        entriesCount[entry] = 1;
      }
    }

    // Create the buttons
    for (const entry in entriesCount) {
      const button = document.createElement("button");
      button.innerHTML = capitalizeFirstLetter(entry, true, true) + " (" + entriesCount[entry] + ")";
      button.onclick = () => {
        onClick(entry, button);
      };
      element.appendChild(button);
    }

    console.log(`${elementId} END) Filling data as buttons`);
  } catch (error) {
    console.error(`Error filling data in element with id ${elementId}`, error);
  }
}

/**
 * @param {string} workType
 * @param {HTMLButtonElement} clickedElement
 */
function onClickWorkType(workType, clickedElement) {
  console.log(`Clicked on work type: ${workType}`);

  if (selectedWorkTypes.includes(workType)) {
    selectedWorkTypes.splice(selectedWorkTypes.indexOf(workType), 1);
  } else {
    selectedWorkTypes.push(workType);
  }

  if (selectedWorkTypes.includes(workType)) {
    clickedElement.classList.add("selected");
  }

  displayFilteredWorks();
}

/**
 * @param {string} workSkill
 * @param {HTMLButtonElement} clickedElement
 */
function onClickWorkSkill(workSkill, clickedElement) {
  console.log(`Clicked on work skill: ${workSkill}`);

  if (selectedWorkSkills.includes(workSkill)) {
    selectedWorkSkills.splice(selectedWorkSkills.indexOf(workSkill), 1);
  } else {
    selectedWorkSkills.push(workSkill);
  }

  if (selectedWorkSkills.includes(workSkill)) {
    clickedElement.classList.add("selected");
  }

  displayFilteredWorks();
}

async function getFilterWorks() {
  const dataUrl = "../data/myWork.json";

  // Load the data
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${dataUrl}`);
  }
  const allWorks = (await response.json())["works"];

  // Filter the works
  const filteredWorks = [];
  for (const work of allWorks) {
    // Check if the work has at least one of the selected types
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

    // Check if the work has at least one of the selected skills
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

    // console.log("Work Matches Filters:", work);
    filteredWorks.push(work);
  }

  return filteredWorks;
}

async function displayFilteredWorks() {
  console.log(`Displaying filtered works with types: "${selectedWorkTypes}" and skills: "${selectedWorkSkills}"`);

  const filteredWorks = await getFilterWorks();

  console.log("Filtered Works:", filteredWorks);

  const elementId = "myWorkFiltered";

  // Find the element
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Could not find element with id ${elementId}`);
  }

  // Clear the element
  element.innerHTML = "";

  // Sort the works by date
  filteredWorks.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });

  // Create the work elements
  for (const work of filteredWorks) {
    const workElement = document.createElement("div");
    workElement.classList.add("work");
    element.appendChild(workElement);

    // Title
    if (work.title) {
      const titleElement = document.createElement("h2");
      workElement.appendChild(titleElement);
      await markdownToHtmlElement(work.title, titleElement);
    }

    // Description
    if (work.description) {
      const descriptionElement = document.createElement("div");
      workElement.appendChild(descriptionElement);
      await markdownToHtmlElement(work.description, descriptionElement);
    }

    // Skills
    if (work.skills) {
      const skillsElement = document.createElement("div");
      workElement.appendChild(skillsElement);
      await markdownToHtmlElement("Skills: " + work.skills.join(", "), skillsElement);
    }

    // Types
    if (work.types) {
      const typesElement = document.createElement("div");
      workElement.appendChild(typesElement);
      await markdownToHtmlElement("Types: " + work.types.join(", "), typesElement);
    }

    // Date
    if (work.date) {
      const dateElement = document.createElement("div");
      workElement.appendChild(dateElement);
      await markdownToHtmlElement("Date: " + work.date, dateElement);
    }

    element.appendChild(workElement);
  }
}
