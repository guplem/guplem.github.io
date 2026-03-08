import * as textUtils from "../utils/textUtils.js";
import * as uiUtils from "../utils/uiUtils.js";
import { selectedWorkTypes, selectedWorkSkills, onClickWorkSkill } from "./workFilters.js";

/**
 * Display filtered works in a masonry layout
 */
export async function displayFilteredWorks() {
  const { filteredWorks } = await getFilteredWorks();

  const allWorksElement = uiUtils.getElement("myWorkFiltered");
  uiUtils.clearElement(allWorksElement);

  const containerWidth = allWorksElement.clientWidth;
  const minColumnWidth = 360;
  const columnsNumber = Math.max(1, Math.floor(containerWidth / minColumnWidth));

  const columns = [];
  const columnHeights = new Array(columnsNumber).fill(0);

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

  for (let i = 0; i < filteredWorks.length; i++) {
    const workElement = await createWorkCard(filteredWorks[i], i);
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    columns[shortestColumnIndex].appendChild(workElement);
    columnHeights[shortestColumnIndex] += workElement.offsetHeight;
  }
}

/**
 * Get filtered works based on selected types and skills
 * @param {boolean} includeSelected
 * @returns {Promise<{ filteredWorks: any[], allWorks: any[] }>}
 */
export async function getFilteredWorks(includeSelected = true) {
  const allWorks = (await textUtils.fetchAllWorks()).works;

  if (!Array.isArray(allWorks)) {
    throw new Error("Invalid data format: 'works' should be an array");
  }

  const filteredWorks = allWorks.filter((work) => {
    const hasSelectedType = selectedWorkTypes.length === 0 || (work.types && textUtils.allToId(work.types).some((type) => selectedWorkTypes.includes(type)));
    const hasSelectedSkill = selectedWorkSkills.length === 0 || (work.skills && textUtils.allToId(work.skills).some((skill) => selectedWorkSkills.includes(skill)));
    return hasSelectedType && hasSelectedSkill;
  });

  if (includeSelected) {
    return { filteredWorks, allWorks };
  } else {
    return { filteredWorks: allWorks.filter((work) => !filteredWorks.includes(work)), allWorks };
  }
}

/**
 * Create a single work card element
 * @param {any} work
 * @param {number} index - for staggered animation
 * @returns {Promise<HTMLDivElement>}
 */
async function createWorkCard(work, index) {
  const workElement = document.createElement("div");
  workElement.classList.add("work");
  workElement.tabIndex = 0;
  workElement.setAttribute("aria-label", work.title);
  // Stagger entrance animation
  workElement.style.animationDelay = `${index * 50}ms`;

  if (work.image?.length) {
    const imageElement = document.createElement("img");
    imageElement.classList.add("workImage");
    imageElement.src = work.image;
    imageElement.alt = work.imageAlt || `Image for ${work.title}`;
    imageElement.loading = "lazy";
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

    if (work.links?.length) {
      titleElement.onclick = () => {
        const firstLink = work.links[0];
        if (firstLink.url) {
          window.open(firstLink.url, "_blank");
        }
      };
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

  if (work.links?.length) {
    const linksElement = document.createElement("div");
    linksElement.classList.add("workLinks");
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
      linksElement.appendChild(linkElement);
    }
    workElement.appendChild(linksElement);
  }

  return workElement;
}
