import * as textUtils from "../utils/textUtils.js";
import * as uiUtils from "../utils/uiUtils.js";

/**
 * Fill an element with text from a JSON file
 * @param {string} elementId
 * @param {RequestInfo | URL} dataRoute
 * @param {string} dataKey
 * @param {Map<string, string>} tagsToSubstitute
 * @param {boolean} parseMarkdown
 * @param {string} targetAttribute
 */
export async function fillWithData(elementId, dataRoute, dataKey, tagsToSubstitute = new Map(), parseMarkdown = true, targetAttribute = "") {
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
 * Display additional sections from info.json
 */
export async function displayAdditionalSections() {
  const elementId = "additionalSections";
  const element = uiUtils.getElement(elementId);
  const data = await textUtils.fetchJsonData(`../data/info.json`);

  if (!data["additionalSections"]) {
    return;
  }

  const fragment = document.createDocumentFragment();

  let index = 0;
  for (const section of data.additionalSections) {
    const sectionElement = document.createElement("section");
    sectionElement.classList.add("section");

    const container = document.createElement("div");
    container.classList.add("container");
    sectionElement.appendChild(container);

    if (section.title?.length) {
      const titleWrap = document.createElement("div");
      titleWrap.classList.add("section-label");
      container.appendChild(titleWrap);
      await uiUtils.setDataInHtmlElement(section.title, titleWrap, new Map([["p", "h2"]]));
      sectionElement.id = `additionalSection_${textUtils.idFromText(section.title)}`;
    }

    const grid = document.createElement("div");
    grid.classList.add("additional-grid");
    container.appendChild(grid);

    // Alternate image/text order
    const imageFirst = index % 2 === 0;

    if (imageFirst && section.image?.length) {
      const imageElement = document.createElement("img");
      imageElement.src = section.image;
      imageElement.alt = section.imageAlt || `Image of ${section.title}`;
      grid.appendChild(imageElement);
    }

    if (section.content?.length) {
      const contentElement = document.createElement("div");
      contentElement.classList.add("additional-text");
      grid.appendChild(contentElement);
      await uiUtils.setDataInHtmlElement(section.content, contentElement);
    }

    if (!imageFirst && section.image?.length) {
      const imageElement = document.createElement("img");
      imageElement.src = section.image;
      imageElement.alt = section.imageAlt || `Image of ${section.title}`;
      grid.appendChild(imageElement);
    }

    index++;
    fragment.appendChild(sectionElement);
  }

  element.appendChild(fragment);
}

/**
 * Display contact information from info.json
 */
export async function displayContactInfo() {
  fillWithData("contactTitle", "../data/info.json", "contactTitle", new Map([["p", "h1"]]));

  const elementId = "contactMethods";
  const element = uiUtils.getElement(elementId);
  const data = await textUtils.fetchJsonData(`../data/info.json`);

  if (!data["contact"]) {
    console.warn("No contact info found in data");
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const contactInfo of data.contact) {
    const card = document.createElement("a");
    card.classList.add("contact-card");
    card.href = contactInfo.link;
    card.target = "_blank";
    card.rel = "author external";
    const text = contactInfo.text ?? contactInfo.link;
    card.title = `${contactInfo.name}: ${text}`;

    if (contactInfo.icon?.length) {
      const imageElement = document.createElement("img");
      imageElement.src = contactInfo.icon;
      imageElement.alt = contactInfo.name;
      card.appendChild(imageElement);
    }

    const textElement = document.createElement("span");
    textElement.textContent = text;
    card.appendChild(textElement);

    fragment.appendChild(card);
  }

  element.appendChild(fragment);
}
