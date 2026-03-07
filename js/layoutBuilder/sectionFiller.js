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
    const sectionElement = document.createElement("div");
    sectionElement.classList.add("additionalSection");
    sectionElement.classList.add("section");

    if (section.title?.length) {
      const titleElement = document.createElement("div");
      titleElement.classList.add("sectionTitle");
      sectionElement.appendChild(titleElement);
      await uiUtils.setDataInHtmlElement(section.title, titleElement, new Map([["p", "h2"]]));
      sectionElement.id = `additionalSection_${textUtils.idFromText(section.title)}`;
    }

    const sectionContainer = document.createElement("div");
    sectionContainer.classList.add("sectionContainer");
    sectionElement.appendChild(sectionContainer);

    for (let i = 0; i < 2; i++) {
      const doContents = index % 2 === i;

      if (doContents) {
        if (section.content?.length) {
          const contentElement = document.createElement("div");
          contentElement.classList.add("sectionContents");
          sectionContainer.appendChild(contentElement);
          await uiUtils.setDataInHtmlElement(section.content, contentElement);
        }
      } else {
        if (section.image?.length) {
          const imageElement = document.createElement("img");
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

  element.appendChild(fragment);
}
