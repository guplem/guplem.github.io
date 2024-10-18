import { unified } from "https://esm.sh/unified@10";
import remarkParse from "https://esm.sh/remark-parse@10";
import remarkBreaks from "https://esm.sh/remark-breaks@4";
import remarkRehype from "https://esm.sh/remark-rehype@8";
import rehypeStringify from "https://esm.sh/rehype-stringify@7";

fillIntroduction();

async function fillIntroduction() {
  console.log("👋🏽 Filling about me section");

  // Get the introduction element
  const introductionElement = document.getElementById("introduction");

  if (!introductionElement) {
    alert("Could not find introduction element");
    return;
  }

  // Get the data/info.json file
  const response = await fetch("../data/info.json");
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  const data = await response.json();

  // Get the "introduction" data from the data/info.json file
  const introductionData = data.introduction;

  // Turn the data from markdown to HTML
  //   const introductionHtml = micromark(introductionData);

  const introductionHtml = await unified().use(remarkParse).use(remarkBreaks).use(remarkRehype).use(rehypeStringify).process(introductionData);

  // Add a paragraph to the element
  introductionElement.innerHTML = introductionHtml;

  console.log("👋🏽 About me section filled");
}
