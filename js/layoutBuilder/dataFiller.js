import * as textUtils from "../utils/textUtils.js";
import { fillWithData, displayAdditionalSections, displayContactInfo } from "./sectionFiller.js";
import { fillWithGroupedButtons, onClickWorkType, onClickWorkSkill, enableCollapsibleSections, setWorkSearchQuery } from "./workFilters.js";
export { displayFilteredWorks } from "./workCards.js";

// - Metadata
fillWithData("page-title", "../data/info.json", "web-title", new Map(), false);
fillWithData("page-description", "../data/info.json", "web-description", new Map(), false, "content");
// - Hero
// keepMatchingStaticFallback: the generated static hero mirrors this render;
// keeping it when the text matches avoids replaying the heroIn animation.
fillWithData("heroContent", "../data/info.json", "introduction", new Map([["p", "h1"]]), true, "", true);
// - About me
fillWithData("aboutMeTitle", "../data/info.json", "aboutMeTitle", new Map([["p", "h1"]]));
fillWithData("aboutMeImage", "../data/info.json", "aboutMeImage", new Map(), false, "src");
fillWithData("aboutMeContents", "../data/info.json", "aboutMe");
// - Work filters
fillWithGroupedButtons("myWorkTypes", "types", onClickWorkType, "myWork", false);
fillWithGroupedButtons("myWorkSkills", "skills", onClickWorkSkill, "myWork", true);
enableCollapsibleSections("myWorkSkills");
// - Work search (free-text filter, combined with the type/skill buttons)
document.getElementById("myWorkSearch")?.addEventListener("input", (event) => {
  setWorkSearchQuery(/** @type {HTMLInputElement} */ (event.target).value);
});

// Load the works title from the manifest
(async () => {
  const worksData = await textUtils.fetchAllWorks();
  const titleElement = document.getElementById("myWorkTitle");
  if (titleElement && worksData.title) {
    const { setDataInHtmlElement } = await import("../utils/uiUtils.js");
    const fragment = document.createDocumentFragment();
    await setDataInHtmlElement(worksData.title, fragment, new Map([["p", "h1"]]));
    titleElement.appendChild(fragment);
  }
})();

// - Additional sections
displayAdditionalSections();
// - Contact info
displayContactInfo();
