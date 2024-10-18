import { unified } from "https://esm.sh/unified@10";
import remarkParse from "https://esm.sh/remark-parse@10";
import remarkBreaks from "https://esm.sh/remark-breaks@4";
import remarkRehype from "https://esm.sh/remark-rehype@8";
import rehypeStringify from "https://esm.sh/rehype-stringify@7";

const markdownToHtmlCache = new Map();

fillData("introduction", "../data/info.json", "introduction");
fillData("aboutMe", "../data/info.json", "aboutMe");

async function markdownToHtml(markdown) {
  if (markdownToHtmlCache.has(markdown)) {
    return markdownToHtmlCache.get(markdown);
  }

  const processedHtml = await unified().use(remarkParse).use(remarkBreaks).use(remarkRehype).use(rehypeStringify).process(markdown);

  markdownToHtmlCache.set(markdown, processedHtml);
  return processedHtml;
}

async function fillData(elementId, dataUrl, dataKey) {
  console.log(elementId + " START) Filling data");

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error("Could not find element with id " + elementId);
  }

  try {
    const response = await fetch("../data/info.json");
    if (!response.ok) {
      throw new Error("Failed to fetch data from " + dataUrl);
    }
    const data = await response.json();

    var rawData = data[dataKey];
    if (!rawData) {
      throw new Error("Could not find data with key " + dataKey + " in " + dataUrl);
    }
    // if the rawData is an array, join it into a string with "\n\n" as separator
    if (Array.isArray(rawData)) {
      rawData = rawData.join("\n\n");
    }
    const dataFormatted = await markdownToHtml(rawData);
    element.innerHTML = String(dataFormatted);

    console.log(elementId + " END) Filling data");
  } catch (error) {
    console.error("Error filling data in element with id " + elementId, error);
  }
}
