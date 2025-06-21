import * as textUtils from "../utils/textUtils.js";
import * as uiUtils from "../utils/uiUtils.js";

// Initialize arrays to store selected work types and skills
const selectedWorkTypes = [];
const selectedWorkSkills = [];

// Fill page elements with content from JSON files
// - Metadata
fillWithData("page-title", "../data/info.json", "web-title", new Map(), false);
fillWithData("page-description", "../data/info.json", "web-description", new Map(), false, "content");
// - Big title
fillWithData("introduction", "../data/info.json", "introduction", new Map([["p", "h1"]]));
// - About me
fillWithData("aboutMeTitle", "../data/info.json", "aboutMeTitle", new Map([["p", "h1"]]));
fillWithData("aboutMeImage", "../data/info.json", "aboutMeImage", new Map(), false, "src");
fillWithData("aboutMeContents", "../data/info.json", "aboutMe");
// - My work
fillWithGroupedButtons("myWorkTypes", `../data/myWork.json`, "works", "types", onClickWorkType, "myWork", false);
fillWithGroupedButtons("myWorkSkills", `../data/myWork.json`, "works", "skills", onClickWorkSkill, "myWork", true);
enableCollapsibleSections("myWorkSkills");
fillWithData("myWorkTitle", "../data/myWork.json", "title", new Map([["p", "h1"]]));
// displayFilteredWorks(); // Probably not needed here since it is called when DOM is fully loaded
// - Additional sections
displayAdditionalSections();
// - Contact info
displayContactInfo();

/**
 * Fill an element with text from a JSON file
 * @param {string} elementId
 * @param {RequestInfo | URL} dataRoute
 * @param {string} dataKey
 * @param {boolean} parseMarkdown
 * @param {string} targetAttribute
 * @param {Map<string, string>} tagsToSubstitute
 */
async function fillWithData(elementId, dataRoute, dataKey, tagsToSubstitute = new Map(), parseMarkdown = true, targetAttribute = "") {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Could not find element with id ${elementId}`);
    }

    const data = await textUtils.fetchJsonData(dataRoute);
    const rawData = data[dataKey];
    if (!rawData) {
      throw new Error("Could not find data with key " + dataKey + " in " + dataRoute);
    }

    if (parseMarkdown) {
      const fragment = document.createDocumentFragment();
      await uiUtils.setDataInHtmlElement(rawData, fragment, tagsToSubstitute, parseMarkdown, targetAttribute);
      element.appendChild(fragment);
    } else {
      await uiUtils.setDataInHtmlElement(rawData, element, tagsToSubstitute, parseMarkdown, targetAttribute);
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
 * @param {(arg0: string, arg1: string, arg2: HTMLButtonElement) => void} onClick
 * @param {string} onClickNavigateTo
 * @param {boolean} sort
 * @param {boolean} showCount
 */
async function fillWithGroupedButtons(elementId, dataUrl, dataKeyToGroup, dataKeyInGroup, onClick, onClickNavigateTo, sort, showCount = false) {
  try {
    // Find the target element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Could not find element with id ${elementId}`);
    }

    // Load the data
    const data = await textUtils.fetchJsonData(dataUrl);

    // Process the data
    const allEntriesCount = new Map();
    const allEntries = new Map();
    for (const group of data[dataKeyToGroup]) {
      if (!group[dataKeyInGroup]) {
        continue;
      }

      // console.warning if the group[dataKeyInGroup] has repeated entries
      const allAsIds = group[dataKeyInGroup].map((entry) => textUtils.idFromText(entry));
      const uniqueAsIds = new Set(allAsIds);
      if (allAsIds.length !== uniqueAsIds.size) {
        console.warn(`Repeated entries in ${dataKeyInGroup} for group`, group);
      }

      for (const rawData of group[dataKeyInGroup]) {
        const entry = textUtils.idFromText(rawData);
        if (!allEntries.has(entry)) {
          allEntries.set(entry, rawData);
        }
        allEntriesCount.set(entry, (allEntriesCount.get(entry) || 0) + 1);
      }
    }

    // Sort the entries by count in allEntriesCount
    const sortedEntries = new Map();
    if (!sort) {
      for (const [entryId, entryValue] of allEntries) {
        sortedEntries.set(entryId, allEntries.get(entryId) + (showCount ? ` (${allEntriesCount.get(entryId)})` : ""));
      }
    } else {
      for (const [entryId, entryCount] of [...allEntriesCount].sort((a, b) => b[1] - a[1])) {
        sortedEntries.set(entryId, allEntries.get(entryId) + (showCount ? ` (${entryCount})` : ""));
      }
    }

    // Create a document fragment
    const fragment = document.createDocumentFragment();

    // Create and add buttons to the fragment
    for (const [entryId, entryValue] of sortedEntries) {
      const buttonText = textUtils.capitalizeFirstLetter(entryValue, false, true);
      const button = uiUtils.createButton(buttonText, () => onClick(entryId, onClickNavigateTo, button));
      button.setAttribute("aria-label", `Show ${textUtils.capitalizeFirstLetter(entryValue, false, true)} experiences`);
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
async function getFilterWorks(includeSelected = true) {
  try {
    // Load the data
    const allWorks = (await textUtils.fetchJsonData(`../data/myWork.json`))["works"];

    // Ensure the data is an array
    if (!Array.isArray(allWorks)) {
      throw new Error("Invalid data format: 'works' should be an array");
    }

    const filteredWorks = allWorks.filter((work) => {
      // Check for selected type match if types are specified
      const hasSelectedType = selectedWorkTypes.length === 0 || (work.types && textUtils.allToId(work.types).some((type) => selectedWorkTypes.includes(type)));

      // Check for selected skill match if skills are specified
      const hasSelectedSkill = selectedWorkSkills.length === 0 || (work.skills && textUtils.allToId(work.skills).some((skill) => selectedWorkSkills.includes(skill)));

      return hasSelectedType && hasSelectedSkill;
    });

    if (includeSelected) {
      // Filter the works
      return filteredWorks;
    } else {
      // Return the non-selected works
      return allWorks.filter((work) => !filteredWorks.includes(work));
    }
  } catch (error) {
    console.error("Error fetching or filtering works:", error);
    return [];
  }
}

/**
 * Display filtered works in a masonry layout
 */
export async function displayFilteredWorks() {
  // Get filtered works
  const filteredWorks = await getFilterWorks();

  console.log("Displaying", filteredWorks.length, "filtered works: ", filteredWorks);

  // Find the target element
  const allWorksElement = uiUtils.getElement("myWorkFiltered");

  // Clear existing content
  uiUtils.clearElement(allWorksElement);

  // Calculate the maximum number of columns based on the screen width
  const screenWidth = window.innerWidth;
  const minColumnWidth = 350;
  const columnsNumber = Math.max(1, Math.floor(screenWidth / minColumnWidth));

  // Prepare the variables to store columns and heights
  const columns = [];
  const columnHeights = new Array(columnsNumber).fill(0); // Track the height of each column

  // Create columns and append them to the DOM in one operation
  const fragment = document.createDocumentFragment();
  for (let c = 0; c < columnsNumber; c++) {
    const columnElement = document.createElement("div");
    columnElement.classList.add("myWorkColumn");
    columns.push(columnElement);
    fragment.appendChild(columnElement);
  }
  allWorksElement.appendChild(fragment);

  // Sort works by date
  filteredWorks.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });

  // Create work elements and append them
  for (const work of filteredWorks) {
    const workElement = document.createElement("div");
    workElement.classList.add("work");
    workElement.tabIndex = 0; // Make it focusable with keyboard
    workElement.setAttribute("aria-label", work.title);

    // Add element number (uncomment for debugging purpuses, used to understand the order of addition)
    // const elementNumber = document.createElement("div");
    // elementNumber.textContent = "" + (filteredWorks.indexOf(work) + 1);
    // workElement.appendChild(elementNumber);

    // Add work details to the element

    if (work.image?.length) {
      const imageElement = document.createElement("img");
      imageElement.classList.add("workImage");
      imageElement.src = work.image;
      imageElement.alt = work.imageAlt || `Image for ${work.title}`;
      workElement.appendChild(imageElement);
      if (work.imageStretched == undefined || work.imageStretched === true) {
        imageElement.classList.add("stretched");
      }
    }

    if (work.title?.length) {
      const titleElement = document.createElement("div");
      titleElement.classList.add("workTitle");
      workElement.appendChild(titleElement);
      await uiUtils.setDataInHtmlElement(work.title, titleElement, new Map([["p", "h3"]]));

      // Make the title a link to the first link
      if (work.links?.length) {
        titleElement.onclick = () => {
          const firstLink = work.links[0];
          if (firstLink.url) {
            window.open(firstLink.url, "_blank");
          }
        };
        // Cursor style
        titleElement.classList.add("workTitleLink");
      }

      workElement.id = `work_${textUtils.idFromText(work.title)}`;
    }

    if (work.date?.length) {
      const dateElement = document.createElement("div");
      dateElement.classList.add("workDate");
      workElement.appendChild(dateElement);
      await uiUtils.setDataInHtmlElement(work.date, dateElement);
    }

    if (work.description?.length) {
      const descriptionElement = document.createElement("div");
      descriptionElement.classList.add("workDescription");
      workElement.appendChild(descriptionElement);
      await uiUtils.setDataInHtmlElement(work.description, descriptionElement);
    }

    if (work.skills?.length) {
      const skillsElement = document.createElement("div");
      skillsElement.classList.add("workSkills");
      // await uiUtils.setDataInHtmlElement("Skills: " + work.skills.join(", "), skillsElement);
      for (const skill of work.skills) {
        const skillId = textUtils.idFromText(skill);
        const skillButton = uiUtils.createButton(skill, () => onClickWorkSkill(skillId, "myWorkFiltered"));
        skillsElement.appendChild(skillButton);
        if (selectedWorkSkills.includes(skillId)) {
          skillButton.setAttribute("selected", "");
        }
      }
      workElement.appendChild(skillsElement);
    }

    // if (work.types?.length) {
    //   const typesElement = document.createElement("div");
    //   typesElement.classList.add("workTypes");
    //   workElement.appendChild(typesElement);
    //   await uiUtils.setDataInHtmlElement("Types: " + work.types.join(", "), typesElement);
    // }

    if (work.links?.length) {
      const skillsElement = document.createElement("div");
      skillsElement.classList.add("workLinks");
      for (const link of work.links) {
        const linkElement = document.createElement("a");
        linkElement.href = link.url;
        linkElement.target = "_blank";
        linkElement.rel = "external help";
        const linkImage = document.createElement("img");
        if (link.type) {
          linkImage.src = "resources/images/icons/" + link.type + ".webp";
          linkElement.title = textUtils.capitalizeFirstLetter(link.type, true, true);
        } else {
          linkImage.src = "resources/images/icons/link.webp";
          linkElement.title = "Web";
        }
        linkElement.appendChild(linkImage);
        skillsElement.appendChild(linkElement);
      }
      workElement.appendChild(skillsElement);
    }

    // Determine the index of the shortest column
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));

    // Add workElement to the shortest column
    columns[shortestColumnIndex].appendChild(workElement);

    // Update the height of the column after adding the work element
    columnHeights[shortestColumnIndex] += workElement.offsetHeight;
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

  let index = 0;
  // Create and add additional section elements to the fragment
  for (const section of data.additionalSections) {
    const sectionElement = document.createElement("div");
    sectionElement.classList.add("additionalSection");
    sectionElement.classList.add("section");

    if (section.title?.length) {
      const titleElement = document.createElement("div");
      // titleElement.classList.add("additionalSectionTitle");
      titleElement.classList.add("sectionTitle");
      sectionElement.appendChild(titleElement);
      await uiUtils.setDataInHtmlElement(section.title, titleElement, new Map([["p", "h2"]]));
      sectionElement.id = `additionalSection_${textUtils.idFromText(section.title)}`;
    }

    const sectionContainer = document.createElement("div");
    // sectionContainer.classList.add("additionalSectionContainer");
    sectionContainer.classList.add("sectionContainer");
    sectionElement.appendChild(sectionContainer);

    for (let i = 0; i < 2; i++) {
      // boolean pair to alternate between left and right
      const doContents = index % 2 === i;

      if (doContents) {
        if (section.content?.length) {
          const contentElement = document.createElement("div");
          // contentElement.classList.add("additionalSectionContent");
          contentElement.classList.add("sectionContents");
          sectionContainer.appendChild(contentElement);
          await uiUtils.setDataInHtmlElement(section.content, contentElement);
        }
      } else {
        if (section.image?.length) {
          const imageElement = document.createElement("img");
          // imageElement.classList.add("additionalSectionImage");
          imageElement.classList.add("sectionImage");
          imageElement.src = section.image;
          imageElement.alt = section.imageAlt || `Image of ${section.title}`;
          sectionContainer.appendChild(imageElement);
        }
      }
    }
    index++;

    fragment.appendChild(sectionElement);
  }

  // Append the fragment to the element
  element.appendChild(fragment);
}

/**
 * Display contact information
 */
async function displayContactInfo() {
  fillWithData("contactTitle", "../data/info.json", "contactTitle", new Map([["p", "h1"]]));

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
    // const contactElement = document.createElement("div");
    // contactElement.classList.add("contactMethod");

    const contactElement = document.createElement("a");
    contactElement.classList.add("contactMethod");
    contactElement.href = contactInfo.link;
    contactElement.target = "_blank";
    contactElement.rel = "author external";
    const text = contactInfo.text ?? contactInfo.link;
    contactElement.title = `${contactInfo.name}: ${text}`;

    if (contactInfo.icon?.length) {
      const imageElement = document.createElement("img");
      imageElement.src = contactInfo.icon;
      imageElement.alt = text;
      contactElement.appendChild(imageElement);
    }

    const textElement = document.createElement("div");
    textElement.textContent = text;
    contactElement.appendChild(textElement);

    fragment.appendChild(contactElement);
  }

  // Append the fragment to the element
  element.appendChild(fragment);
}

/**
 * Handle click event for work type buttons
 * @param {string} workType
 * @param {string} navigateTo
 * @param {HTMLButtonElement} clickedElement
 */
function onClickWorkType(workType, navigateTo, clickedElement) {
  if (selectedWorkTypes.includes(workType)) {
    selectedWorkTypes.splice(selectedWorkTypes.indexOf(workType), 1);
    clickedElement.removeAttribute("selected");
  } else {
    selectedWorkTypes.push(workType);
    clickedElement.setAttribute("selected", "");
  }

  displayFilteredWorks();

  document?.getElementById(navigateTo)?.scrollIntoView({ behavior: "smooth" });
}

/**
 * Handle click event for work skill buttons
 * @param {string} workSkillId
 * @param {string} navigateTo
 * @param {HTMLElement | undefined} clickedElement - If undefined, all the matching element will be searched for. Used as undefined for the moment the skill is selected from the "work/project card" so the buttons in the filter row are marked as selected
 */
function onClickWorkSkill(workSkillId, navigateTo, clickedElement = undefined) {
  if (!clickedElement) {
    // Look for the element, looking for buttons that contain the skill as text
    const elements = document.querySelectorAll("#myWorkSkills button");
    for (const element of elements) {
      const elementText = element.textContent ? textUtils.idFromText(element.textContent) : "";
      if (elementText === workSkillId) {
        // console.log("Found element for skill", workSkill);
        // @ts-ignore
        clickedElement = element;
        console.log("Element", clickedElement);
        break;
      }
    }
  }

  if (!clickedElement) {
    console.warn("Could not find element for skill", workSkillId);
  }

  console.log("Selecting or deselecting skill", workSkillId);

  if (selectedWorkSkills.includes(workSkillId)) {
    selectedWorkSkills.splice(selectedWorkSkills.indexOf(workSkillId), 1);
    clickedElement?.removeAttribute("selected");
  } else {
    selectedWorkSkills.push(workSkillId);
    clickedElement?.setAttribute("selected", "");
  }

  console.log("Selected skills", selectedWorkSkills);

  displayFilteredWorks();

  document?.getElementById(navigateTo)?.scrollIntoView({ behavior: "smooth" });
}

/**
 * Adds the ability to collapse/expand a section, still requires some styling
 * @param {string} collapsableSectionId
 * @param {boolean} startCollapsed
 */
function enableCollapsibleSections(collapsableSectionId, startCollapsed = true) {
  const collapsableSection = document.getElementById(collapsableSectionId);

  if (!collapsableSection) {
    console.error("Could not find element with id", collapsableSectionId);
    return;
  }

  // Add a 'collapsed' attribute to the collapsable section
  collapsableSection.setAttribute("collapsed", startCollapsed.toString());

  // Create a button to toggle the section
  const collapseButton = document.createElement("button");
  collapseButton.id = "collapseButton";
  collapseButton.textContent = startCollapsed ? "Show More" : "Show Less";
  collapseButton.onclick = toggleCollapse;
  collapseButton.style.position = startCollapsed ? "absolute" : "relative";
  collapsableSection.appendChild(collapseButton);

  function toggleCollapse() {
    // Get the div
    const mainDiv = document.getElementById(collapsableSectionId);

    if (!mainDiv) {
      console.error("Could not find element with id", collapsableSectionId);
      return;
    }

    // Check the current value of the 'collapsed' attribute
    const isCollapsed = mainDiv.getAttribute("collapsed") === "true";

    // Toggle the 'collapsed' attribute
    if (isCollapsed) {
      mainDiv.setAttribute("collapsed", "false");
      // Optionally, change button text or perform other actions
      const collapseButton = document.getElementById("collapseButton");
      if (!collapseButton) {
        console.error("Could not find element with id 'collapseButton'");
        return;
      }
      collapseButton.textContent = "Show Less";
      collapseButton.style.position = "relative";
      // Move the button to the end
      mainDiv.appendChild(collapseButton);
    } else {
      mainDiv.setAttribute("collapsed", "true");
      const collapseButton = document.getElementById("collapseButton");
      if (!collapseButton) {
        console.error("Could not find element with id 'collapseButton'");
        return;
      }
      collapseButton.textContent = "Show More";
      collapseButton.style.position = "absolute";
    }
  }
}
