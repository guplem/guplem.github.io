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

const markdownToHtmlCache = new Map();

fillWithText("page-title", "../data/info.json", "web-title", false);
fillWithText("page-description", "../data/info.json", "web-description", false, "content");
fillWithText("introduction", "../data/info.json", "introduction");
fillWithText("aboutMe", "../data/info.json", "aboutMe");
// fillWithButtons("myWorkTypes", "../data/myWork.json", "works.types");
fillWithGroupedButtons("myWorkTypes", "../data/myWork.json", "works", "types", onClickWorkType);
fillWithGroupedButtons("myWorkSkills", "../data/myWork.json", "works", "skills", onClickWorkSkill);

async function markdownToHtml(markdown) {
  if (markdownToHtmlCache.has(markdown)) {
    return markdownToHtmlCache.get(markdown);
  }

  const processedHtml = await unified().use(remarkParse).use(remarkBreaks).use(remarkRehype).use(rehypeStringify).process(markdown);

  markdownToHtmlCache.set(markdown, processedHtml);
  return processedHtml;
}

function turnTextArrayIntoDistinctPragraphs(textArray) {
  if (Array.isArray(textArray)) {
    return textArray.join("\n\n");
  }
  return textArray;
}

function capitalizeFirstLetter(string, lowerRest = true, firstLetterOfEveryWord = false) {
  //   return string.charAt(0).toUpperCase() + string.toLowerCase().slice(1);

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

async function fillWithText(elementId, dataUrl, dataKey, parseMarkdown = true, atttribute = "") {
  console.log(elementId + " START) Filling data as text");

  try {
    // Find the element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error("Could not find element with id " + elementId);
    }

    // Load the data
    const response = await fetch("../data/info.json");
    if (!response.ok) {
      throw new Error("Failed to fetch data from " + dataUrl);
    }
    const data = await response.json();

    // Find the data
    let rawData = data[dataKey];
    if (!rawData) {
      throw new Error("Could not find data with key " + dataKey + " in " + dataUrl);
    }

    // Format the data
    rawData = turnTextArrayIntoDistinctPragraphs(rawData);
    const dataFormatted = parseMarkdown ? await markdownToHtml(rawData) : rawData;

    if (atttribute.length > 0) {
      element.setAttribute(atttribute, String(dataFormatted));
      return;
    } else {
      element.innerHTML = String(dataFormatted);
    }

    console.log(elementId + " END) Filling data as text");
  } catch (error) {
    console.error("Error filling data in element with id " + elementId, error);
  }
}

async function fillWithGroupedButtons(elementId, dataUrl, dataKeyToGroup, dataKeyInGroup, onClick) {
  console.log(elementId + " START) Filling data as buttons");

  try {
    // Find the element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error("Could not find element with id " + elementId);
    }

    // Load the data
    const response = await fetch("../data/myWork.json");
    if (!response.ok) {
      throw new Error("Failed to fetch data from " + dataUrl);
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
    console.log(entriesCount);

    // Create the buttons
    for (const entry in entriesCount) {
      const button = document.createElement("button");
      button.innerHTML = capitalizeFirstLetter(entry, true, true) + " (" + entriesCount[entry] + ")";
      button.onclick = () => {
        onClick(entry);
      };
      element.appendChild(button);
    }

    console.log(elementId + " END) Filling data as buttons");
  } catch (error) {
    console.error("Error filling data in element with id " + elementId, error);
  }
}

function onClickWorkType(wotkType) {
  console.log("Clicked on work type: " + wotkType);
}

function onClickWorkSkill(workSkill) {
  console.log("Clicked on work skill: " + workSkill);
}
