// Narrowing the list: by kind, by repository, by label, by milestone, by
// issue field (`fields.js`), and by person.
//
// Two rules, and they pull in opposite directions on purpose:
//
//   - **Within one kind of filter, the chosen values widen.** Two labels means
//     "either of these". Somebody who picks `bug` and then `urgent` is casting a
//     wider net, not asking for the items carrying both, which is usually none.
//   - **Across the kinds of filter, each one narrows.** A kind and a repository
//     chosen together means both must hold.
//
// The chosen values travel in the address bar (`urlState.js`), so a filtered
// board can be sent to yourself or bookmarked. See ADR 0009.

import { availableFieldFilters, filterByFields } from "./fields.js";

/** The kinds a person can ask for. Named in links, so an id is never changed. */
export const DEFAULT_KIND = "all";

export const KIND_FILTERS = [
  { id: "all", label: "All" },
  { id: "issue", label: "Issues" },
  { id: "pull-request", label: "Pull requests" },
];

const KNOWN_KINDS = new Set(KIND_FILTERS.map((one) => one.id));

/** One of the kinds above, whatever was asked for. */
export function readKind(value) {
  return typeof value === "string" && KNOWN_KINDS.has(value) ? value : DEFAULT_KIND;
}

function asList(value) {
  return Array.isArray(value) ? value.filter((one) => typeof one === "string" && one !== "") : [];
}

/** The items still worth showing. The list handed in is not changed or reordered. */
export function filterWorkItems(items, { kind, repositories, labels, milestones, fields } = {}) {
  const list = Array.isArray(items) ? items : [];
  const wantedKind = readKind(kind);
  const wantedRepositories = new Set(asList(repositories));
  const wantedLabels = new Set(asList(labels));
  // By name, across repositories, the way a label is chosen (ADR 0045).
  const wantedMilestones = new Set(asList(milestones));

  // Each field is a kind of its own: two values of one field widen, two
  // fields narrow (ADR 0047).
  return filterByFields(list, fields).filter((item) => {
    if (wantedKind !== DEFAULT_KIND && item?.kind !== wantedKind) return false;
    if (wantedRepositories.size > 0 && !wantedRepositories.has(item?.repository)) return false;
    if (wantedLabels.size > 0) {
      const carried = Array.isArray(item?.labels) ? item.labels : [];
      if (!carried.some((label) => wantedLabels.has(label?.name))) return false;
    }
    if (wantedMilestones.size > 0 && !wantedMilestones.has(item?.milestone?.title)) return false;
    return true;
  });
}

/**
 * The items where one of the chosen people appears, under the field named.
 *
 * Two lists ask two different questions of the same shape of answer. The review
 * row asks whose work this is, so it reads `assignees`. The board asks who is in
 * the review, so it reads `reviewers` (ADR 0028). Within the filter the chosen
 * people widen, exactly like labels: two people means either of them (ADR 0009).
 *
 * @param items the list to narrow
 * @param logins the people the reader chose
 * @param field `"assignees"` or `"reviewers"`
 */
export function filterByPerson(items, logins, field) {
  const list = Array.isArray(items) ? items : [];
  const wanted = new Set(asList(logins));
  if (wanted.size === 0) return [...list];
  return list.filter((item) => {
    const people = Array.isArray(item?.[field]) ? item[field] : [];
    return people.some((one) => wanted.has(one?.login));
  });
}

/** Everybody the list names under one field, each once, in the order they read. */
function availablePeople(items, field) {
  const byLogin = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    for (const one of Array.isArray(item?.[field]) ? item[field] : []) {
      if (one && typeof one.login === "string" && one.login !== "" && !byLogin.has(one.login)) {
        byLogin.set(one.login, one);
      }
    }
  }
  return [...byLogin.values()].sort((a, b) =>
    String(a.name ?? a.login).localeCompare(String(b.name ?? b.login), undefined, { sensitivity: "base" }),
  );
}

/** Everybody the review row's work is assigned to. */
export function availableAssignees(items) {
  return availablePeople(items, "assignees");
}

/** Everybody in a review on the board. */
export function availableReviewers(items) {
  return availablePeople(items, "reviewers");
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Every repository the list mentions, each once. */
export function availableRepositories(items) {
  const list = Array.isArray(items) ? items : [];
  return sortedUnique(list.map((item) => item?.repository).filter((name) => typeof name === "string" && name !== ""));
}

/** Every label the list carries, each once. */
export function availableLabels(items) {
  const list = Array.isArray(items) ? items : [];
  const names = list.flatMap((item) => (Array.isArray(item?.labels) ? item.labels.map((label) => label?.name) : []));
  return sortedUnique(names.filter((name) => typeof name === "string" && name !== ""));
}

/** Every milestone the list is in, each once, by name. */
export function availableMilestones(items) {
  const list = Array.isArray(items) ? items : [];
  const names = list.map((item) => item?.milestone?.title);
  return sortedUnique(names.filter((name) => typeof name === "string" && name !== ""));
}

/** A value added when it is missing, removed when it is there. The list is not changed. */
export function toggleInList(list, value) {
  const current = asList(list);
  return current.includes(value) ? current.filter((one) => one !== value) : [...current, value];
}

/**
 * How many narrowings are in force.
 *
 * The "clear" button appears only when this is more than zero, so it is what
 * gives the reader a way out of a list they have filtered down to nothing.
 */
export function activeFilterCount({ kind, repositories, labels, milestones, fields, assignees, reviewers } = {}) {
  return (
    (readKind(kind) === DEFAULT_KIND ? 0 : 1) +
    asList(repositories).length +
    asList(labels).length +
    asList(milestones).length +
    asList(fields).length +
    asList(assignees).length +
    asList(reviewers).length
  );
}

/**
 * How many of the board's own narrowings are in force.
 *
 * The assignee control narrows the review row, not the board, so the count
 * on the filter bar leaves it out (ADR 0049).
 */
export function boardFilterCount(chosen = {}) {
  return activeFilterCount({ ...chosen, assignees: [] });
}

/**
 * The menus the filter bar offers, one per kind of filter, built from what the
 * list actually holds (ADR 0009, ADR 0049).
 *
 * A repository or a reviewer is offered only when there are two to choose
 * between, because one can never narrow anything; a label, a milestone or an
 * issue field is offered from one, because it narrows the work that lacks it.
 * A menu the reader chose from always stays, so a choice can be seen and
 * undone. Each option says whether it is chosen, and `count` is how many are.
 *
 * @param items the board's work items
 * @param chosen the reader's filters: `repositories`, `reviewers`, `labels`,
 *   `milestones` and `fields`, each a list of keys
 */
export function filterMenus(items, chosen) {
  const list = Array.isArray(items) ? items : [];
  const picked = chosen && typeof chosen === "object" ? chosen : {};
  const menu = (id, label, values, chosenKeys, least) => {
    const wanted = new Set(asList(chosenKeys));
    const options = values.map(({ key, text }) => ({ key, text, chosen: wanted.has(key) }));
    const count = id.startsWith("field:") ? options.filter((one) => one.chosen).length : wanted.size;
    return options.length >= least || count > 0 ? [{ id, label, options, count }] : [];
  };
  const plain = (names) => names.map((name) => ({ key: name, text: name }));
  return [
    ...menu("repository", "Repository", plain(availableRepositories(list)), picked.repositories, 2),
    ...menu(
      "reviewer",
      "Reviewer",
      availableReviewers(list).map((person) => ({ key: person.login, text: person.name || person.login })),
      picked.reviewers,
      2,
    ),
    ...menu("label", "Label", plain(availableLabels(list)), picked.labels, 1),
    ...menu("milestone", "Milestone", plain(availableMilestones(list)), picked.milestones, 1),
    ...availableFieldFilters(list).flatMap((field) =>
      menu(`field:${field.name}`, field.name, field.values, picked.fields, 1),
    ),
  ];
}
