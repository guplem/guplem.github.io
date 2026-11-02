// The GitHub projects a piece of work is in, by name.
//
// A project (GitHub Projects) is a board that holds issues and pull requests
// from many repositories. The board shows which projects each card is in, and
// narrows the list to one project by its name, the way it does for a milestone
// (ADR 0045, ADR 0051).
//
// GitHub answers this only through GraphQL, and only to a token that carries
// the organisation permission "Projects: read". That permission is optional:
// a token without it reads everything else as before, and shows no projects.
// A fine-grained token can never read a project that a personal account owns,
// whatever it is granted, so such a project is simply absent (ADR 0051).
//
// Only the name and the link are read. A project's own fields (its Status, its
// iteration) are not: the reader asked to see which projects the work is in,
// and every field would add to what each refresh costs (ADR 0047).

/** The icon on the pill: a board with three columns, drawn from paths (ADR 0001). */
export const PROJECT_PATHS = ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 3v18", "M15 3v18"];

const GITHUB_PAGE = "https://github.com/";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * The open projects one GraphQL node is in, each once, in GitHub's order.
 *
 * A closed project is history, like a closed blocker, so it is left out. An
 * entry GitHub refused answers null and is skipped. The link goes straight
 * into `a.href`, so only a page on GitHub is kept.
 */
export function readProjects(node) {
  const entries = isRecord(node) && isRecord(node.projectItems) && Array.isArray(node.projectItems.nodes)
    ? node.projectItems.nodes
    : [];
  const seen = new Set();
  const found = [];
  for (const entry of entries) {
    const project = isRecord(entry) && isRecord(entry.project) ? entry.project : null;
    if (!project || project.closed === true) continue;
    if (typeof project.title !== "string" || project.title === "") continue;
    const url = typeof project.url === "string" && project.url.startsWith(GITHUB_PAGE) ? project.url : "";
    const identity = typeof project.id === "string" && project.id !== "" ? project.id : `${project.title}|${url}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    found.push({ title: project.title, url });
  }
  return found;
}

/** The projects of every node, keyed by its node id. A node with no id is skipped. */
export function normalizeProjects(nodes) {
  const byId = {};
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!isRecord(node) || typeof node.id !== "string" || node.id === "") continue;
    byId[node.id] = readProjects(node);
  }
  return byId;
}

function isRefusal(error) {
  if (!isRecord(error)) return false;
  if (error.type === "FORBIDDEN") return true;
  return typeof error.message === "string" && /not accessible/i.test(error.message);
}

/**
 * What one GraphQL answer about projects says: the nodes that came back, and
 * whether the token may read projects at all.
 *
 * GraphQL answers 200 with an `errors` array when part of a query fails. A
 * refusal with no project read anywhere means the token lacks "Projects: read".
 * A refusal beside a project that was read means the permission is there and
 * one project belongs to an owner the token does not reach, so the answer
 * still counts as granted.
 *
 * @param payload the body GitHub answered: `{ data: { nodes }, errors }`
 * @returns {{granted: boolean, nodes: object[]}}
 */
export function readProjectsAnswer(payload) {
  const body = isRecord(payload) ? payload : {};
  const nodes = isRecord(body.data) && Array.isArray(body.data.nodes) ? body.data.nodes : [];
  const refused = Array.isArray(body.errors) && body.errors.some(isRefusal);
  const readOne = nodes.some((node) => readProjects(node).length > 0);
  return { granted: !refused || readOne, nodes };
}

/**
 * Each item with the projects it is in. An item nobody asked about is in none.
 * The list handed in is not changed.
 */
export function applyProjects(items, byId) {
  const known = isRecord(byId) ? byId : {};
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    projects: Array.isArray(known[item?.key]) ? known[item.key] : [],
  }));
}

/** The tooltip on the link half of a project pill. */
export function projectLinkTip(project) {
  return `${project?.title ?? ""}. Open the project on GitHub`;
}

/** The tooltip on the name half, which is a filter. */
export function projectFilterTip(project, pressed) {
  const name = project?.title ?? "";
  return pressed ? `Show everything again, not only the project ${name}` : `Show only the work in the project ${name}`;
}
