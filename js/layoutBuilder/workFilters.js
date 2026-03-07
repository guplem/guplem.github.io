import * as textUtils from "../utils/textUtils.js";
import * as uiUtils from "../utils/uiUtils.js";

// Selected filter state
/** @type {string[]} */
export const selectedWorkTypes = [];
/** @type {string[]} */
export const selectedWorkSkills = [];

/**
 * Fill an element with grouped buttons from works data
 * @param {string} elementId
 * @param {string} dataKeyInGroup - "types" or "skills"
 * @param {(arg0: string, arg1: string, arg2: HTMLButtonElement) => void} onClick
 * @param {string} onClickNavigateTo
 * @param {boolean} sort
 * @param {boolean} showCount
 */
export async function fillWithGroupedButtons(elementId, dataKeyInGroup, onClick, onClickNavigateTo, sort, showCount = false) {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Could not find element with id ${elementId}`);
    }

    const data = await textUtils.fetchAllWorks();

    const allEntriesCount = new Map();
    const allEntries = new Map();
    for (const group of data.works) {
      if (!group[dataKeyInGroup]) {
        continue;
      }

      const allAsIds = group[dataKeyInGroup].map((/** @type {string} */ entry) => textUtils.idFromText(entry));
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

    // Sort the entries by count
    const sortedEntries = new Map();
    if (!sort) {
      for (const [entryId] of allEntries) {
        sortedEntries.set(entryId, allEntries.get(entryId) + (showCount ? ` (${allEntriesCount.get(entryId)})` : ""));
      }
    } else {
      for (const [entryId, entryCount] of [...allEntriesCount].sort((a, b) => b[1] - a[1])) {
        sortedEntries.set(entryId, allEntries.get(entryId) + (showCount ? ` (${entryCount})` : ""));
      }
    }

    const fragment = document.createDocumentFragment();
    for (const [entryId, entryValue] of sortedEntries) {
      const buttonText = textUtils.capitalizeFirstLetter(entryValue, false, true);
      const button = uiUtils.createButton(buttonText, () => onClick(entryId, onClickNavigateTo, button));
      button.setAttribute("aria-label", `Show ${textUtils.capitalizeFirstLetter(entryValue, false, true)} experiences`);
      fragment.appendChild(button);
    }

    element.appendChild(fragment);
  } catch (error) {
    console.error(`Error filling data in element with id ${elementId}`, error);
  }
}

/**
 * Handle click event for work type buttons
 * @param {string} workType
 * @param {string} navigateTo
 * @param {HTMLButtonElement} clickedElement
 */
export function onClickWorkType(workType, navigateTo, clickedElement) {
  if (selectedWorkTypes.includes(workType)) {
    selectedWorkTypes.splice(selectedWorkTypes.indexOf(workType), 1);
    clickedElement.removeAttribute("selected");
  } else {
    selectedWorkTypes.push(workType);
    clickedElement.setAttribute("selected", "");
  }

  // Lazy import to avoid circular dependency
  import("./workCards.js").then((module) => {
    module.displayFilteredWorks();
  });

  document?.getElementById(navigateTo)?.scrollIntoView({ behavior: "smooth" });
}

/**
 * Handle click event for work skill buttons
 * @param {string} workSkillId
 * @param {string} navigateTo
 * @param {HTMLElement | undefined} clickedElement
 */
export function onClickWorkSkill(workSkillId, navigateTo, clickedElement = undefined) {
  if (!clickedElement) {
    const elements = document.querySelectorAll("#myWorkSkills button");
    for (const element of elements) {
      const elementText = element.textContent ? textUtils.idFromText(element.textContent) : "";
      if (elementText === workSkillId) {
        /** @type {HTMLElement} */
        clickedElement = /** @type {HTMLElement} */ (element);
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

  // Lazy import to avoid circular dependency
  import("./workCards.js").then((module) => {
    module.displayFilteredWorks();
  });

  document?.getElementById(navigateTo)?.scrollIntoView({ behavior: "smooth" });
}

/**
 * Adds the ability to collapse/expand a section
 * @param {string} collapsableSectionId
 * @param {boolean} startCollapsed
 */
export function enableCollapsibleSections(collapsableSectionId, startCollapsed = true) {
  const collapsableSection = document.getElementById(collapsableSectionId);

  if (!collapsableSection) {
    console.error("Could not find element with id", collapsableSectionId);
    return;
  }

  collapsableSection.setAttribute("collapsed", startCollapsed.toString());

  const collapseButton = document.createElement("button");
  collapseButton.id = "collapseButton";
  collapseButton.textContent = startCollapsed ? "Show More" : "Show Less";
  collapseButton.onclick = toggleCollapse;
  collapseButton.style.position = startCollapsed ? "absolute" : "relative";
  collapsableSection.appendChild(collapseButton);

  function toggleCollapse() {
    const mainDiv = document.getElementById(collapsableSectionId);

    if (!mainDiv) {
      console.error("Could not find element with id", collapsableSectionId);
      return;
    }

    const isCollapsed = mainDiv.getAttribute("collapsed") === "true";

    if (isCollapsed) {
      mainDiv.setAttribute("collapsed", "false");
      const collapseButton = document.getElementById("collapseButton");
      if (!collapseButton) {
        console.error("Could not find element with id 'collapseButton'");
        return;
      }
      collapseButton.textContent = "Show Less";
      collapseButton.style.position = "relative";
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
