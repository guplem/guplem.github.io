// Entry point for the web-projects index page.
//
// Reads the same portfolio data the main site reads (data/projects/*.json),
// keeps only the projects hosted locally under web-projects/, and renders a
// simple card grid. The list stays in sync automatically: adding a project
// whose link points into web-projects/ makes it appear here with no edits.

import { marked } from "https://esm.sh/marked@17.0.5/es2022/marked.bundle.mjs";
import { selectWebProjects, projectMatchesQuery } from "./discovery.js";

marked.setOptions({ breaks: true });

// Relative to this page (web-projects/index.html), "../data/projects/" resolves
// to the data folder at the site root.
const DATA_BASE = "../data/projects/";

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

/**
 * Load every portfolio project by reading the manifest, then each project file.
 * @returns {Promise<any[]>}
 */
async function loadAllWorks() {
  const manifest = await fetchJson(`${DATA_BASE}index.json`);
  const files = Array.isArray(manifest.projects) ? manifest.projects : [];
  return Promise.all(files.map((file) => fetchJson(`${DATA_BASE}${file}`)));
}

/**
 * Build one project card element.
 *
 * KEEP IN SYNC with buildWebProjectsIndexHtml() in ../scripts/generateSeoBlocks.js:
 * the static SEO fallback mirrors this markup so render() can adopt it (root
 * ADR 0010). If a change here alters the card TEXT, the fallback is swapped in
 * and the load flicker returns until regenerated. If it alters only the
 * markup/classes (same text), the adopted fallback keeps showing the OLD
 * markup on load and the change silently never appears -- update the generator
 * and run `bun scripts/generateSeoBlocks.js` in the same change.
 * @param {import("./discovery.js").WebProjectCard} project
 * @param {number} index - for the staggered entrance animation
 * @returns {Promise<HTMLElement>}
 */
async function createProjectCard(project, index) {
  const card = document.createElement("article");
  card.className = "project-card";
  card.style.animationDelay = `${index * 50}ms`;

  if (project.image) {
    const image = document.createElement("img");
    image.className = "project-image";
    // Image paths in the data are relative to the site root; this page sits one
    // level deeper, so prefix with "../".
    image.src = project.image.startsWith("http") ? project.image : `../${project.image}`;
    image.alt = project.imageAlt || `Screenshot of ${project.title}`;
    image.loading = "lazy";
    card.appendChild(image);
  }

  const body = document.createElement("div");
  body.className = "project-body";
  card.appendChild(body);

  const title = document.createElement("h3");
  title.className = "project-title";
  const titleLink = document.createElement("a");
  titleLink.className = "project-title-link";
  titleLink.href = project.path; // relative to web-projects/, e.g. "rps-mind-reader/"
  titleLink.textContent = project.title;
  title.appendChild(titleLink);
  body.appendChild(title);

  if (project.date) {
    const date = document.createElement("div");
    date.className = "project-date";
    date.textContent = project.date;
    body.appendChild(date);
  }

  if (project.teaser) {
    const teaser = document.createElement("div");
    teaser.className = "project-teaser";
    teaser.innerHTML = await marked.parse(project.teaser);
    body.appendChild(teaser);
  }

  if (project.skills.length) {
    const skills = document.createElement("div");
    skills.className = "project-skills";
    for (const skill of project.skills) {
      const tag = document.createElement("span");
      tag.className = "project-skill";
      tag.textContent = skill;
      skills.appendChild(tag);
    }
    body.appendChild(skills);
  }

  return card;
}

async function render() {
  const grid = document.getElementById("projectsGrid");
  const status = document.getElementById("status");
  if (!grid || !status) return;

  try {
    const works = await loadAllWorks();
    const projects = selectWebProjects(works);

    if (projects.length === 0) {
      status.hidden = false;
      status.textContent = "No web projects found yet.";
      return;
    }

    const fragment = document.createDocumentFragment();
    const cards = await Promise.all(projects.map((project, index) => createProjectCard(project, index)));
    for (const card of cards) fragment.appendChild(card);

    // The static SEO fallback cards (see scripts/generateSeoBlocks.js) mirror
    // the cards built above. When they show the same content, adopt them
    // instead of swapping, so the entrance animation does not replay
    // (flicker). Otherwise replace them -- only once the dynamic cards are
    // ready, so a failed fetch leaves the fallback visible. The comparison
    // strips all whitespace: the generated markup has newlines between
    // elements, DOM-built fragments do not.
    const withoutWhitespace = (text) => (text || "").replace(/\s+/g, "");
    const staticCards = Array.from(grid.children);
    let entries;
    if (staticCards.length === projects.length && withoutWhitespace(grid.textContent) === withoutWhitespace(fragment.textContent)) {
      entries = projects.map((project, index) => ({ project, element: staticCards[index] }));
    } else {
      if (staticCards.length > 0) {
        console.warn("Static SEO fallback cards do not match the dynamic render; swapping (entrance animation replays). Run `bun scripts/generateSeoBlocks.js`, or sync buildWebProjectsIndexHtml() with createProjectCard().");
      }
      grid.innerHTML = "";
      grid.appendChild(fragment);
      entries = projects.map((project, index) => ({ project, element: cards[index] }));
    }
    status.hidden = true;

    setupSearch(entries);
  } catch (error) {
    console.error(error);
    status.hidden = false;
    status.textContent = "Could not load the project list. Please try again later.";
  }
}

/**
 * Wire the search box to show/hide cards as the user types.
 * @param {Array<{ project: import("./discovery.js").WebProjectCard, element: HTMLElement }>} entries
 */
function setupSearch(entries) {
  const input = document.getElementById("search");
  const noResults = document.getElementById("noResults");
  if (!input) return;

  input.addEventListener("input", () => {
    let visibleCount = 0;
    for (const { project, element } of entries) {
      const matches = projectMatchesQuery(project, input.value);
      element.hidden = !matches;
      if (matches) visibleCount += 1;
    }
    if (noResults) noResults.hidden = visibleCount > 0;
  });
}

render();
