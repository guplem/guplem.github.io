import * as textUtils from "../utils/textUtils.js";
import * as uiUtils from "../utils/uiUtils.js";

/** @typedef {"none" | "include" | "exclude"} TagFilterState */
/** @typedef {"types" | "skills"} FilterGroup */

// Selected filter state. Every chip (one type or one skill) holds one of three
// states: "none", "include" or "exclude". One tag id sits in at most one of
// these lists. The lists are exported as constants and are mutated in place,
// so every importer reads the live state.
/** @type {string[]} */
export const includedWorkTypes = [];
/** @type {string[]} */
export const excludedWorkTypes = [];
/** @type {string[]} */
export const includedWorkSkills = [];
/** @type {string[]} */
export const excludedWorkSkills = [];

// The two chip groups. Each key is the field name that a project file uses
// ("types" or "skills") and is also the group name that the functions here
// take.
const filterGroups = {
  types: { containerId: "myWorkTypes", included: includedWorkTypes, excluded: excludedWorkTypes },
  skills: { containerId: "myWorkSkills", included: includedWorkSkills, excluded: excludedWorkSkills },
};

// The controls that index.html declares. Both stay hidden until their setup
// function finds them, so a page without them still works.
/** @type {HTMLElement | null} */
let tagExclusionToggle = null;
/** @type {HTMLElement | null} */
let clearFiltersButton = null;

// Free-text search query for the works list.
let workSearchQuery = "";
let searchRerenderTimeout = 0;

/**
 * @returns {string} the current free-text search query
 */
export function getWorkSearchQuery() {
  return workSearchQuery;
}

/**
 * Update the free-text search query and re-render the filtered works. The
 * re-render is debounced because typing fires many events and the masonry
 * layout must be rebuilt from scratch on each change (ADR 0004).
 * @param {string} query
 */
export function setWorkSearchQuery(query) {
  workSearchQuery = query;
  updateClearFiltersButton();
  clearTimeout(searchRerenderTimeout);
  searchRerenderTimeout = setTimeout(renderFilteredWorks, 120);
}

/**
 * Re-render the works grid. The masonry layout is rebuilt from scratch on
 * every filter change (ADR 0004). The lazy import breaks the circular
 * dependency between this module and workCards.js.
 */
function renderFilteredWorks() {
  import("./workCards.js")
    .then((module) => {
      module.displayFilteredWorks();
    })
    .catch((error) => {
      console.error("Failed to re-render the works grid after a filter change", error);
    });
}

/**
 * The state that one tag holds in its group.
 * @param {FilterGroup} group
 * @param {string} tagId
 * @returns {TagFilterState}
 */
export function getTagFilterState(group, tagId) {
  const { included, excluded } = filterGroups[group];
  if (included.includes(tagId)) return "include";
  if (excluded.includes(tagId)) return "exclude";
  return "none";
}

/**
 * Move one tag into the given state, then repaint every control and rebuild
 * the works grid.
 * @param {FilterGroup} group
 * @param {string} tagId
 * @param {TagFilterState} state
 */
export function setTagFilterState(group, tagId, state) {
  const { included, excluded } = filterGroups[group];

  for (const list of [included, excluded]) {
    const position = list.indexOf(tagId);
    if (position !== -1) {
      list.splice(position, 1);
    }
  }
  if (state === "include") included.push(tagId);
  if (state === "exclude") excluded.push(tagId);

  syncFilterControls();
  renderFilteredWorks();
}

/**
 * Show one tag chip's filter state. The state is an attribute, never text,
 * because the chip's text is also its label. `data-tag-filter` carries the
 * state as a value (like `data-collapsed` on the grid wrapper) and is absent
 * while the chip filters nothing.
 * @param {HTMLElement} button
 * @param {FilterGroup} group
 * @param {string} tagId
 * @param {string} label - the tag's human-readable name
 */
export function paintTagFilterButton(button, group, tagId, label) {
  const state = getTagFilterState(group, tagId);

  button.dataset.tagId = tagId;
  button.dataset.tagLabel = label;
  if (state === "none") {
    delete button.dataset.tagFilter;
  } else {
    button.dataset.tagFilter = state;
  }

  // Each description names the current state first, then what one more click
  // does, because the third state is not a common one.
  const description = {
    none: `Show only ${label} projects`,
    include: `Showing only ${label} projects. Click to hide them instead.`,
    exclude: `Hiding ${label} projects. Click to clear this filter.`,
  }[state];
  button.setAttribute("aria-label", description);
  button.title = description;
}

/**
 * Repaint every filter control from the current state. It runs after each
 * change, so a chip, the exclusion toggle and the card chips can never
 * disagree about one tag.
 */
export function syncFilterControls() {
  for (const [group, { containerId }] of Object.entries(filterGroups)) {
    const buttons = document.getElementById(containerId)?.querySelectorAll("button[data-tag-id]") ?? [];
    for (const button of buttons) {
      const element = /** @type {HTMLElement} */ (button);
      const tagId = element.dataset.tagId ?? "";
      paintTagFilterButton(element, /** @type {FilterGroup} */ (group), tagId, element.dataset.tagLabel ?? tagId);
    }
  }

  if (tagExclusionToggle) {
    const tagId = tagExclusionToggle.dataset.tagId ?? "";
    const label = tagExclusionToggle.dataset.tagLabel ?? tagId;
    const isExcluded = getTagFilterState("skills", tagId) === "exclude";
    tagExclusionToggle.setAttribute("aria-pressed", String(isExcluded));
    tagExclusionToggle.title = isExcluded ? `${label} projects are hidden. Click to show them again.` : `Hide every project tagged ${label}`;
  }

  updateClearFiltersButton();
}

/**
 * Show the "clear filters" button only while at least one filter is set.
 */
function updateClearFiltersButton() {
  if (!clearFiltersButton) return;
  const hasTagFilter = Object.values(filterGroups).some(({ included, excluded }) => included.length > 0 || excluded.length > 0);
  clearFiltersButton.hidden = !hasTagFilter && workSearchQuery.trim().length === 0;
}

/**
 * Fill an element with grouped buttons from works data
 * @param {string} elementId
 * @param {FilterGroup} dataKeyInGroup - "types" or "skills"
 * @param {(arg0: string, arg1: string) => void} onClick
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
      const button = uiUtils.createButton(buttonText, () => onClick(entryId, onClickNavigateTo));
      paintTagFilterButton(button, dataKeyInGroup, entryId, buttonText);
      fragment.appendChild(button);
    }

    element.appendChild(fragment);
  } catch (error) {
    console.error(`Error filling data in element with id ${elementId}`, error);
  }
}

/**
 * Move one tag to its next state, then scroll the works into view. The cycle
 * is none -> include -> exclude -> none (`nextTagFilterState`), so a second
 * click on a chip hides the works that carry that tag.
 * @param {FilterGroup} group
 * @param {string} tagId
 * @param {string} navigateTo
 */
function cycleTagFilter(group, tagId, navigateTo) {
  setTagFilterState(group, tagId, textUtils.nextTagFilterState(getTagFilterState(group, tagId)));
  document?.getElementById(navigateTo)?.scrollIntoView({ behavior: "smooth" });
}

/**
 * Handle click event for work type buttons
 * @param {string} workTypeId
 * @param {string} navigateTo
 */
export function onClickWorkType(workTypeId, navigateTo) {
  cycleTagFilter("types", workTypeId, navigateTo);
}

/**
 * Handle click event for work skill buttons
 * @param {string} workSkillId
 * @param {string} navigateTo
 */
export function onClickWorkSkill(workSkillId, navigateTo) {
  cycleTagFilter("skills", workSkillId, navigateTo);
}

/**
 * Wire the button that hides one skill's projects in a single click. It sets
 * that skill's chip to "exclude", which is how a visitor meets the third chip
 * state: the chip changes together with the button.
 *
 * The button names its target skill in `data-tag-id`, so index.html decides
 * which skill it hides. The button stays hidden while no project carries that
 * skill, so it can never be a control that does nothing.
 * @param {string} toggleId
 */
export async function enableTagExclusionToggle(toggleId) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) {
    console.warn("Could not find element with id", toggleId);
    return;
  }

  const tagId = toggle.dataset.tagId;
  if (!tagId) {
    console.warn(`The exclusion toggle #${toggleId} needs a data-tag-id with the skill it hides`);
    return;
  }

  try {
    const { works } = await textUtils.fetchAllWorks();
    const tagIsInUse = works.some((work) => Array.isArray(work.skills) && textUtils.allToId(work.skills).includes(tagId));
    if (!tagIsInUse) {
      return;
    }
  } catch (error) {
    console.error(`Failed to check whether any project carries the skill ${tagId}`, error);
    return;
  }

  tagExclusionToggle = toggle;
  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    const nextState = getTagFilterState("skills", tagId) === "exclude" ? "none" : "exclude";
    setTagFilterState("skills", tagId, nextState);
  });

  syncFilterControls();
}

/**
 * Wire the button that clears every filter at once. A chip needs three clicks
 * to return to "none", so one escape hatch keeps the chips quick to use.
 * @param {string} buttonId
 */
export function enableClearFiltersButton(buttonId) {
  const button = document.getElementById(buttonId);
  if (!button) {
    console.warn("Could not find element with id", buttonId);
    return;
  }

  clearFiltersButton = button;
  button.addEventListener("click", clearWorkFilters);
  updateClearFiltersButton();
}

/**
 * Clear every type filter, every skill filter and the search box.
 */
export function clearWorkFilters() {
  for (const { included, excluded } of Object.values(filterGroups)) {
    included.length = 0;
    excluded.length = 0;
  }

  workSearchQuery = "";
  const searchBox = /** @type {HTMLInputElement | null} */ (document.getElementById("myWorkSearch"));
  if (searchBox) {
    searchBox.value = "";
  }

  syncFilterControls();
  renderFilteredWorks();
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
