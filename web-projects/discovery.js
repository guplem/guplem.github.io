// Pure logic for the web-projects index page.
//
// No DOM and no network here: these functions take the already-loaded
// portfolio "works" data (the same JSON the main site reads from
// data/projects/*.json) and derive the list of web-projects that are hosted
// locally under web-projects/. Keeping this pure makes it unit-testable with
// Bun (see discovery.test.js).

const WEB_PROJECTS_PREFIX = "web-projects/";

// Matches an absolute URL that points at our own domain, so we can strip the
// origin and treat it like a relative path (e.g. the older project links use
// "https://triunitystudios.com/web-projects/..." while newer ones use the
// relative "web-projects/...").
const OWN_ORIGIN_PATTERN = /^https?:\/\/(?:www\.)?triunitystudios\.com\//i;

/**
 * Resolve, for a single portfolio project ("work"), the path to its locally
 * hosted web-project relative to the web-projects/ folder
 * (e.g. "rps-mind-reader/" or "ChatGPTPong/pong.html"), or null when the
 * project is not hosted under web-projects/.
 *
 * A project counts as a local web-project when it has a non-source link
 * (i.e. not type "github") whose URL points into web-projects/, either as a
 * relative path ("web-projects/foo/") or an absolute URL on our own domain
 * ("https://triunitystudios.com/web-projects/foo/"). The "github" links are
 * skipped on purpose: they also contain "web-projects/" but point at the
 * source code on GitHub, not the live demo.
 *
 * @param {{ links?: Array<{ url?: string, type?: string }> }} work
 * @returns {string | null}
 */
export function localWebProjectPath(work) {
  if (!work || !Array.isArray(work.links)) return null;

  for (const link of work.links) {
    if (!link || typeof link.url !== "string") continue;
    if (link.type === "github") continue; // source-code link, not the live demo

    const relative = link.url.replace(OWN_ORIGIN_PATTERN, "");
    if (relative.toLowerCase().startsWith(WEB_PROJECTS_PREFIX)) {
      return relative.slice(WEB_PROJECTS_PREFIX.length);
    }
  }

  return null;
}

/**
 * The first description paragraph (raw markdown) of a project, used as the
 * card teaser on the index page.
 *
 * @param {{ description?: string[] }} project
 * @returns {string}
 */
export function teaserMarkdown(project) {
  if (!project || !Array.isArray(project.description)) return "";
  return project.description[0] || "";
}

/**
 * Stable sort by date string, newest first. Entries whose date does not parse
 * keep their original relative order at the end of the list.
 *
 * @template {{ date?: string }} T
 * @param {T[]} items
 * @returns {T[]}
 */
export function sortByDateDescending(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const timeA = Date.parse(a.item.date ?? "");
      const timeB = Date.parse(b.item.date ?? "");
      const valueA = Number.isNaN(timeA) ? -Infinity : timeA;
      const valueB = Number.isNaN(timeB) ? -Infinity : timeB;
      if (valueB !== valueA) return valueB - valueA;
      return a.index - b.index; // keep manifest order for equal dates
    })
    .map(({ item }) => item);
}

/**
 * @typedef {Object} WebProjectCard
 * @property {string} title
 * @property {string} date
 * @property {string} teaser - First description paragraph (markdown).
 * @property {string | null} image - Site-root-relative image path, or null.
 * @property {string} imageAlt
 * @property {string[]} skills
 * @property {string} path - Path relative to web-projects/ (the card link).
 */

/**
 * Filter a list of portfolio works down to the ones hosted locally under
 * web-projects/, returning a small view-model per project, sorted newest-first.
 *
 * @param {Array<any>} works
 * @returns {WebProjectCard[]}
 */
export function selectWebProjects(works) {
  if (!Array.isArray(works)) return [];

  const cards = [];
  for (const work of works) {
    const path = localWebProjectPath(work);
    if (!path) continue;

    cards.push({
      title: typeof work.title === "string" ? work.title : "",
      date: typeof work.date === "string" ? work.date : "",
      teaser: teaserMarkdown(work),
      image: typeof work.image === "string" && work.image.length ? work.image : null,
      imageAlt: typeof work.imageAlt === "string" ? work.imageAlt : "",
      skills: Array.isArray(work.skills) ? work.skills : [],
      path,
    });
  }

  return sortByDateDescending(cards);
}

/**
 * The lowercased text a project is searched against: its title, teaser, and skills.
 * @param {WebProjectCard} project
 * @returns {string}
 */
function searchableText(project) {
  if (!project) return "";
  const skills = Array.isArray(project.skills) ? project.skills : [];
  return [project.title, project.teaser, ...skills].filter(Boolean).join(" ").toLowerCase();
}

/**
 * Whether a project matches a free-text query. The query is split into
 * whitespace-separated tokens and every token must appear (case-insensitive)
 * in the project's title, teaser, or skills. An empty query matches everything.
 *
 * @param {WebProjectCard} project
 * @param {string} query
 * @returns {boolean}
 */
export function projectMatchesQuery(project, query) {
  const normalized = (query || "").trim().toLowerCase();
  if (!normalized) return true;
  const haystack = searchableText(project);
  return normalized.split(/\s+/).every((token) => haystack.includes(token));
}

/**
 * Filter projects to the ones matching a free-text query (see projectMatchesQuery).
 *
 * @param {WebProjectCard[]} projects
 * @param {string} query
 * @returns {WebProjectCard[]}
 */
export function filterProjectsByText(projects, query) {
  if (!Array.isArray(projects)) return [];
  return projects.filter((project) => projectMatchesQuery(project, query));
}

/**
 * Whether the search box holds a real query. Spaces alone do not count,
 * because projectMatchesQuery() also trims them and then matches everything.
 *
 * @param {unknown} query
 * @returns {boolean}
 */
export function hasSearchText(query) {
  return typeof query === "string" && query.trim().length > 0;
}

/**
 * Whether the page must scroll the search box to the top of the screen, so the
 * box and the filtered results are the only things that the visitor sees.
 *
 * This is true only on the change from an empty box to a box that holds text.
 * The page must not scroll again on every later keystroke: the visitor can
 * scroll where they want while they refine the query, and a scroll on each
 * character would fight them.
 *
 * @param {unknown} previousQuery - The text in the box before the change.
 * @param {unknown} nextQuery - The text in the box after the change.
 * @returns {boolean}
 */
export function shouldPinSearchToTop(previousQuery, nextQuery) {
  return !hasSearchText(previousQuery) && hasSearchText(nextQuery);
}
