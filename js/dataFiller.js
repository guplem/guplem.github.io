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
fillWorkTypes();

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

async function fillWorkTypes() {
  console.log("WorkTypes" + " START) Filling data as buttons");

  const elementId = "myWorkTypes";
  try {
    // Find the element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error("Could not find element with id " + elementId);
    }

    // Load the data
    const dataUrl = "../data/myWork.json";
    const response = await fetch("../data/myWork.json");
    if (!response.ok) {
      throw new Error("Failed to fetch data from " + dataUrl);
    }
    const data = await response.json();

    // Find the data
    const allTypes = [];
    for (const work of data.works) {
      for (const type of work.types) {
        allTypes.push(type.toLowerCase());
      }
    }

    // Count the types
    const typeCounts = {};
    for (const type of allTypes) {
      if (typeCounts[type]) {
        typeCounts[type]++;
      } else {
        typeCounts[type] = 1;
      }
    }
    console.log(typeCounts);

    // Create the buttons
    for (const type in typeCounts) {
      const button = document.createElement("button");
      button.innerHTML = capitalizeFirstLetter(type, true, true) + " (" + typeCounts[type] + ")";
      button.onclick = () => {
        console.log("Button clicked: " + type);
      };
      element.appendChild(button);
    }

    console.log("WorkTypes" + " END) Filling data as buttons");
  } catch (error) {
    console.error("Error filling data in element with id " + elementId, error);
  }
}
