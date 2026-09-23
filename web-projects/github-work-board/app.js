// The page. It listens, calls the modules, and builds elements. It holds no
// logic worth a test: anything that could be wrong belongs in a pure module.
//
// Two rules hold here and `invariants.test.js` guards both:
//   - Nothing reaches the screen through `innerHTML` except the deploy line,
//     which carries its own escaper. Titles come from other people.
//   - Storage is only ever touched through `settings.js`. The board file goes
//     through the shared cloud storage's store, which owns the local mirror,
//     the save schedule and the question when two copies meet (root ADR 0016).
//
// The board reads from every saved token and merges the answers, because a
// fine-grained token belongs to one owner and most people's work is spread
// across their own account and one or more organisations (ADR 0007).

import {
  DOCUMENT_PATH,
  PROJECT,
  RECORD_MAPS,
  readColumn,
  readColumnColour,
  readCopyActions,
  readCounting,
  readNote,
  readPriority,
  readTheme,
  removeCopyAction,
  writeColumn,
  writeColumnColour,
  writeCopyAction,
  writeCounting,
  writeNote,
  writePriority,
  writeTheme,
} from "./boardDocument.js";
import {
  COLUMN_COLOURS,
  DEFAULT_COLOUR,
  REVIEW_ROW_ID,
  THEMES,
  colourableAreas,
} from "./appearance.js";
import { attentionReason } from "./attention.js";
import {
  DEFAULT_RANGE,
  RANGE_PRESETS,
  rangeBounds,
  rangeDates,
  rangeFromDates,
  rangeHint,
  rangeLabel,
  readRange,
} from "./doneRange.js";
import {
  AUTOMATIC,
  COLUMNS,
  attentionFor,
  columnFor,
  groupIntoColumns,
  moveOptions,
  stateLabel,
} from "./columns.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import {
  fetchAssignedIssues,
  fetchFinishedWork,
  fetchRelationships,
  fetchReviewRequests,
  fetchViewer,
} from "./gateway.js";
import {
  DEFAULT_KIND,
  KIND_FILTERS,
  activeFilterCount,
  availableAssignees,
  availableLabels,
  availableRepositories,
  availableReviewers,
  filterByPerson,
  filterWorkItems,
  toggleInList,
} from "./filters.js";
import { describeFailure } from "./githubErrors.js";
import {
  describeLastRefresh,
  escapeHtml,
  noteMenuLabel,
  priorityMenuLabel,
  say,
  sayEmptyBoard,
  summariseChecks,
} from "./messages.js";
import {
  CONNECTION_CHECKS,
  REQUIRED_PERMISSIONS,
  newPermissionsSince,
  permissionsFingerprint,
  tokenNeedsUpdate,
} from "./permissions.js";
import { DEFAULT_REFRESH, OFF, REFRESH_CHOICES, refreshDue } from "./refresh.js";
import {
  addToken,
  browserStorage,
  forgetAllTokens,
  readAutoRefresh,
  readLastCounts,
  readTokens,
  removeToken,
  renameToken,
  saveAutoRefresh,
  saveLastCounts,
  saveTokens,
  updateToken,
} from "./settings.js";
import { adoptLegacyStorage } from "./legacyStorage.js";
import { openStore } from "../cloud-storage/cloudStore.js";
import { askCopyQuestion, mountCloudSettings } from "../cloud-storage/cloudSettingsPanel.js";
import {
  DEFAULT_REPO_NAME as CLOUD_REPO_NAME,
  readToken as readCloudToken,
  saveRepo as saveCloudRepo,
  saveToken as saveCloudToken,
} from "../cloud-storage/cloudSettings.js";
import { skeletonCount } from "./skeletons.js";
import { orderItemsForMerging, orderStacksForMerging, stackPositions } from "./stacks.js";
import { cardMenuRows } from "./cardMenu.js";
import { TOOLTIP_DELAY_MS, tipPlacement } from "./tooltip.js";
import { childSummary, childrenProgress, childrenToggleLabel, orderChildren } from "./children.js";
import { EXAMPLE_ACTIONS, PLACEHOLDERS, fillCopyTemplate } from "./copyActions.js";
import { readTitle } from "./titles.js";
import { initialsOf, personLabel } from "./people.js";
import { LOW, NORMAL, sinkLowPriority, sinkLowPriorityItems } from "./priority.js";
import { countBoard, describeBreakdown, describeExcluded, tabTitle } from "./counting.js";
import { DEFAULT_SORT_ID, SORT_OPTIONS, reviewSortId, sortWorkItems } from "./sorting.js";
import { DEFAULT_VIEW, buildSearch, readStateFromSearch } from "./urlState.js";
import {
  applyPullRequestState,
  groupByLinkedIssue,
  isBlocked,
  knowsAbout,
  normalizeRelationships,
  openBlockers,
  readRelationship,
} from "./relationships.js";
import { encodeTokenBackup, looksLikeBackup, readTokenBackup } from "./tokenBackup.js";
import { describeTokenReach, suggestedTokenName } from "./tokenIdentity.js";
import {
  countByKind,
  finishedBetween,
  normalizeWorkItems,
  ownersOf,
  uniqueByKey,
  withoutItems,
} from "./workItems.js";


/**
 * How often the board checks whether a refresh is due.
 *
 * It is not the refresh interval. The shortest schedule is 30 seconds, and a
 * tab that comes back into view should not wait most of that before it catches
 * up, so the board asks the question often and acts on it rarely (ADR 0025).
 */
const REFRESH_TICK_MS = 5000;

/**
 * How long the refresh button stays down after it is pressed.
 *
 * It is not a delay before asking: the asking starts at once. It is the
 * shortest time the button can come back up, so a press that GitHub answers in
 * 80 milliseconds still reads as something that happened, and so the button
 * cannot be pressed ten times in a second and spend the rate limit ten times
 * (ADR 0029).
 */
const MANUAL_REFRESH_REST_MS = 1000;
const PROJECT_PATH = "web-projects/github-work-board";

const storage = browserStorage();
const element = (id) => document.getElementById(id);
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `t${Date.now()}${Math.random()}`);

/**
 * The board's half of the data, opened in `start()`. It hands the document
 * over, keeps the local mirror, and saves to cloud storage a second after the
 * last change (root ADR 0016). `state.board` is always its current document.
 */
let store = null;

/** The cloud storage panel inside Settings, mounted in `start()`. */
let cloudPanel = null;

/** Everything the page holds between events. The board document is the only part written back. */
const state = {
  tokens: [],
  login: null,
  board: null,
  items: [],
  reviews: [],
  links: {},
  // Which stack each card on screen belongs to, keyed by item, valued by the
  // key of the stack's bottom. Read while a card is built (ADR 0027).
  stackRoots: {},
  // Where each card on the board sits in its stack, keyed by item. The review
  // row works this out for itself, over its own cards (ADR 0020, ADR 0027).
  stackBadges: {},
  menuItem: null,
  menuAnchor: null,
  // Cards whose note box is open although the note is still empty. Only for
  // this visit: a box somebody opened and left empty is not worth saving.
  notesOpen: new Set(),
  // Parents whose whole list of children is open. Only for this visit, and the
  // list is rebuilt on every refresh, so it has to outlive the elements it
  // belongs to (ADR 0032).
  childrenOpen: new Set(),
  // What the last connection proved about each token, keyed by its id. The
  // checks live inside the token they are about, folded (ADR 0018).
  checks: {},
  // Tokens the reader asked to see in full, and whether they have read the
  // warning. Both last for this visit only: a board that opens with a
  // credential on screen is a board nobody can share a screen with (ADR 0015).
  revealed: new Set(),
  warningRead: false,
  onWarningAccepted: null,
  sortId: DEFAULT_SORT_ID,
  // Which days the last column is about, and whether its picker is open. The
  // range travels in the link; the open picker lasts for this visit (ADR 0034).
  doneRange: DEFAULT_RANGE,
  donePickerOpen: false,
  // How often this browser asks GitHub again, the timer that asks, and when the
  // last answer arrived. The schedule stays in this browser, because it decides
  // what this device spends of the reader's rate limit (ADR 0025).
  refreshId: DEFAULT_REFRESH,
  refreshTimer: null,
  lastReadAt: null,
  view: DEFAULT_VIEW,
  kind: DEFAULT_KIND,
  repositories: [],
  labels: [],
  // Two filters over two lists: the row of reviews narrows by whose work each
  // pull request is, and the board narrows by who is in the review (ADR 0028).
  assignees: [],
  reviewers: [],
  loading: false,
};


/* -------------------------------------------------------------------------- */
/* Small builders                                                             */
/* -------------------------------------------------------------------------- */

function setStatus(text) {
  element("board-status").textContent = text;
}

/** One row of the setup guide's permission list, from `permissions.js`. */
function buildPermissionRow(permission) {
  const row = document.createElement("li");
  row.className = "permission";

  const name = document.createElement("code");
  name.className = "permission-name";
  name.textContent = permission.name;

  const level = document.createElement("span");
  level.className = "badge permission-level";
  level.textContent = permission.level;

  const why = document.createElement("span");
  why.className = "permission-why";
  why.textContent = permission.why;

  row.append(name, level, why);
  return row;
}

/**
 * Put the "how to make a token" guide into every slot that asks for it.
 *
 * It is written once, as a `<template>` in the page, and shown on the welcome
 * screen and on the add-token screen. Writing it twice is how the two copies
 * drift, which is the same failure ADR 0005 removed from the permission list
 * itself.
 */
function fillTokenGuides() {
  const guide = element("token-guide");
  for (const slot of document.querySelectorAll(".token-guide-slot")) {
    const copy = guide.content.cloneNode(true);
    copy.querySelector(".permissions").replaceChildren(...REQUIRED_PERMISSIONS.map(buildPermissionRow));
    slot.replaceChildren(copy);
  }
}

/**
 * Tell the reader a token is behind what the board now asks for, and name
 * exactly what to add (ADR 0005).
 */
function renderTokenNotice() {
  const behind = state.tokens.filter((entry) => tokenNeedsUpdate(entry.grantedPermissions));
  const notice = element("token-outdated");
  if (behind.length === 0) {
    notice.hidden = true;
    return;
  }
  const missing = newPermissionsSince(behind[0].grantedPermissions);
  element("token-outdated-list").replaceChildren(
    ...missing.map((permission) => {
      const row = document.createElement("li");
      row.textContent = `${permission.name} → ${permission.level}, for ${permission.why}`;
      return row;
    }),
  );
  notice.hidden = false;
}

function buildCheckRow({ label, ok, detail }) {
  const row = document.createElement("li");
  row.className = ok ? "check ok" : "check failed";
  const mark = document.createElement("span");
  mark.className = ok ? "badge badge-success" : "badge badge-destructive";
  mark.textContent = ok ? "Done" : "Fix";
  const body = document.createElement("div");
  const name = document.createElement("p");
  name.className = "check-label";
  name.textContent = label;
  body.append(name);
  if (detail) {
    const why = document.createElement("p");
    why.className = "check-detail";
    why.textContent = detail;
    body.append(why);
  }
  row.append(mark, body);
  return row;
}

/** The icon for one kind of change, drawn from its paths (ADR 0001). */
function buildChangeIcon(type, breaking) {
  const drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  drawing.setAttribute("viewBox", "0 0 24 24");
  drawing.setAttribute("aria-hidden", "true");
  drawing.setAttribute("focusable", "false");
  drawing.setAttribute("class", `icon change-icon change-${type.id}${breaking ? " is-breaking" : ""}`);
  for (const d of type.paths) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", d);
    drawing.append(line);
  }
  const name = document.createElementNS("http://www.w3.org/2000/svg", "title");
  name.textContent = breaking ? `${type.label}, and it breaks something` : type.label;
  drawing.append(name);
  return drawing;
}

/**
 * One pill saying why a card wants its author: a conflict, a red check, or
 * changes a reviewer asked for.
 *
 * "Needs attention" is one column with three ways into it, so the card has to
 * say which one it took. Hovering the pill says what to do about it (ADR 0011).
 */
function buildAttentionPill(reason) {
  const pill = document.createElement("span");
  pill.className = `badge badge-attention attention-${reason.id}`;

  const drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  drawing.setAttribute("viewBox", "0 0 24 24");
  drawing.setAttribute("aria-hidden", "true");
  drawing.setAttribute("focusable", "false");
  drawing.setAttribute("class", "icon");
  for (const d of reason.paths) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", d);
    drawing.append(line);
  }

  pill.append(drawing, document.createTextNode(reason.label));
  explain(pill, reason.detail);
  return pill;
}

/**
 * One card. A nested pull request keeps the menu but not the move: it travels
 * in its issue's column, because the pair is one piece of work (ADR 0010), so
 * moving it on its own would do nothing, but copying its branch still does
 * (ADR 0021).
 *
 * `people` says whose faces the card draws, which depends on the list the card
 * is in and not on whether it can be moved (ADR 0028):
 *
 *   - `reviewers`: everybody in the review, for a card on the board. "Who am I
 *     waiting for."
 *   - `assignees`: whose work this is, for a card in the review row. "Who is
 *     asking me."
 *   - `none`: for an issue whose pull request is nested under it, because that
 *     card draws the same faces one line below.
 */
function buildWorkItemCard(item, { withMenu = true, compact = false, stack = null, people = "reviewers" } = {}) {

  const card = document.createElement("li");
  card.className = "issue";
  // What GitHub links to this item. The card asks it three times over: what
  // blocks it, what holds it up, and who is in its review.
  const relationship = readRelationship(state.links, item.key);
  // Fainter wherever it is drawn, in every order. Only the smart order moves
  // it as well (ADR 0026).
  if (readPriority(state.board, item.key) === LOW) card.setAttribute("data-priority", LOW);
  // Which stack this card belongs to, out of everything drawn right now. The
  // hover lights up the rest of the stack by matching on it (ADR 0027).
  const inStack = state.stackRoots[item.key];
  if (inStack) card.setAttribute("data-stack", inStack);

  const heading = document.createElement("p");
  heading.className = "issue-where";

  const more = document.createElement("button");
  more.type = "button";
  more.className = "icon-button";
  more.setAttribute("aria-haspopup", "menu");
  more.setAttribute("aria-expanded", "false");
  more.setAttribute("aria-label", `Actions for ${item.repository} #${item.number}`);
  const dots = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  dots.setAttribute("viewBox", "0 0 24 24");
  dots.setAttribute("aria-hidden", "true");
  dots.setAttribute("class", "icon");
  for (const x of [5, 12, 19]) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", "12");
    dot.setAttribute("r", "1.6");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    dots.append(dot);
  }
  more.append(dots);
  // The browser opens the menu, through `popovertarget`. Calling `showPopover`
  // from a click handler instead means the same click reaches the page and the
  // browser light-dismisses the menu it has just opened: it flashes and closes.
  more.setAttribute("popovertarget", "card-menu");
  more.addEventListener("click", () => {
    state.menuItem = item;
    state.menuAnchor = more;
    // Only a card in a column can be moved between columns (ADR 0022).
    state.menuCanMove = withMenu;
  });
  card.append(more);

  const kind = document.createElement("span");
  kind.className = item.kind === "pull-request" ? "badge badge-pull" : "badge badge-issue";
  kind.textContent = item.kind === "pull-request" ? "PR" : "Issue";
  heading.append(kind);

  // Three cards from one person are often one stack, and the row of reviews
  // gives no other sign of it or of which to read first (ADR 0020).
  if (stack) {
    const inStack = document.createElement("span");
    inStack.className = "badge badge-stack";

    // The number is the bottom of the stack. On its own it says nothing about
    // what that pull request is, so hovering it answers that and nothing else
    // (ADR 0027).
    const which = document.createElement("span");
    which.className = "stack-number";
    which.textContent = `Stack #${stack.stack}`;
    explain(which, stack.title === "" ? `Pull request #${stack.stack}` : `#${stack.stack} ${stack.title}`);

    const where = document.createElement("span");
    where.className = "stack-position";
    where.textContent = `· ${stack.position} of ${stack.size}`;
    explain(
      where,
      stack.position === 1
        ? `The first of ${stack.size} stacked pull requests. Nothing is waiting on it.`
        : `Number ${stack.position} of ${stack.size} stacked pull requests. #${stack.stack} merges first.`,
    );

    inStack.append(which, where);
    heading.append(inStack);
  }

  if (item.isDraft) {
    const draft = document.createElement("span");
    draft.className = "badge badge-outline";
    draft.textContent = "Draft";
    heading.append(draft);
  }

  if (isBlocked(relationship)) {
    const blocked = document.createElement("span");
    blocked.className = "badge badge-blocked";
    blocked.textContent = "Blocked";
    heading.append(blocked);
  }

  // Why this work is with the person who wrote it. Drawn on every card that
  // has a reason, not only on the ones sitting in "Needs attention": a card
  // the reader moved somewhere by hand still conflicts (ADR 0011).
  for (const id of attentionFor(item, relationship)) {
    const reason = attentionReason(id);
    if (reason) heading.append(buildAttentionPill(reason));
  }

  // A nested pull request is almost always in its issue's own repository, so
  // the name is repetition taking the width the title needs. It stays one
  // hover away (ADR 0018).
  const where = document.createElement("span");
  where.textContent = compact ? `#${item.number}` : `${item.repository} #${item.number}`;
  if (compact) explain(where, item.repository);
  heading.append(where);
  card.append(heading);

  // `fix(api):` is the same on hundreds of cards and the rest is the only part
  // worth reading, so the prefix becomes an icon and a small word (ADR 0021).
  const read = readTitle(item.title);
  const link = document.createElement("a");
  link.className = "issue-title";
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener";
  // The whole title, for anybody who wants the words back.
  explain(link, item.title);
  if (read.type) {
    link.append(buildChangeIcon(read.type, read.breaking));
    if (read.scope !== "") {
      const scope = document.createElement("span");
      scope.className = "issue-scope";
      scope.textContent = read.scope;
      link.append(scope);
    }
  }
  link.append(document.createTextNode(read.description));
  card.append(link);

  // Who this is about. In the review row that is whose work it is; on the
  // board it is who is in the review, each face carrying what the board waits
  // on them for (ADR 0028). An issue carries the review of the pull request its
  // column is read from, put there by `applyPullRequestState`.
  const faces =
    people === "assignees"
      ? buildFaces(item.assignees, {
          chosen: state.assignees,
          onToggle: (login) => {
            state.assignees = toggleInList(state.assignees, login);
            afterFilterChange();
          },
        })
      : people === "reviewers"
        ? buildFaces(item.reviewers, {
            state: true,
            chosen: state.reviewers,
            onToggle: (login) => {
              state.reviewers = toggleInList(state.reviewers, login);
              afterFilterChange();
            },
          })
        : null;
  if (faces) card.append(faces);

  if (item.labels.length > 0) {
    const labels = document.createElement("p");
    labels.className = "issue-labels";
    for (const label of item.labels) {
      const chip = document.createElement("span");
      chip.className = "badge badge-outline";
      chip.textContent = label.name;
      labels.append(chip);
    }
    card.append(labels);
  }

  // "Sub-issue of", not "Part of": the card has to say what the relationship is
  // as well as which issue it is with, because the reader meets this card in a
  // column, away from its parent (ADR 0010).
  if (relationship.parent) {
    card.append(buildLinkLine("Sub-issue of", [relationship.parent]));
  }

  const blockers = openBlockers(relationship);
  if (blockers.length > 0) {
    card.append(buildLinkLine("Blocked by", blockers));
  }

  if (relationship.subIssues.total > 0) card.append(buildChildren(item, relationship.subIssues));

  // The box is not there until there is a note in it, or until the reader asks
  // for one from the menu. An empty box on every card is forty invitations to
  // write something nobody wanted to write (ADR 0014).
  const written = readNote(state.board, item.key);
  if (written !== "" || state.notesOpen.has(item.key)) card.append(buildNoteBox(item, written));

  return card;
}

/* -------------------------------------------------------------------------- */
/* Placeholders while the board waits                                         */
/* -------------------------------------------------------------------------- */

/** One grey bar. `width` is any CSS length. */
function buildSkeletonBar(width, extra = "") {
  const bar = document.createElement("span");
  bar.className = `skeleton ${extra}`.trim();
  bar.style.width = width;
  return bar;
}

/** A placeholder in the shape of a work item card. */
function buildSkeletonCard() {
  const card = document.createElement("li");
  card.className = "issue skeleton-card";
  const where = document.createElement("p");
  where.className = "issue-where";
  where.append(buildSkeletonBar("2.5rem", "skeleton-pill"), buildSkeletonBar("9rem"));
  const title = document.createElement("p");
  title.append(buildSkeletonBar("70%", "skeleton-title"));
  const note = document.createElement("p");
  note.append(buildSkeletonBar("100%", "skeleton-note"));
  card.append(where, title, note);
  return card;
}

/** A placeholder in the shape of a token row: a name box, a line of facts, a button. */
function buildSkeletonTokenRow() {
  const row = document.createElement("li");
  row.className = "token-row skeleton-card";
  const lines = document.createElement("div");
  lines.className = "token-lines";
  lines.append(buildSkeletonBar("11rem", "skeleton-input"), buildSkeletonBar("60%"));
  const actions = document.createElement("div");
  actions.className = "token-actions";
  actions.append(buildSkeletonBar("3.5rem", "skeleton-button"), buildSkeletonBar("5.5rem", "skeleton-button"));
  row.append(lines, actions);
  const fold = document.createElement("div");
  fold.className = "token-checks";
  fold.append(buildSkeletonBar("9rem"));
  row.append(fold);
  return row;
}

const times = (count, make) => Array.from({ length: count }, make);

/**
 * Draw the shape of what is coming, before it comes.
 *
 * Nothing on this page appears out of nothing after a pause (ADR 0004). The
 * counts come from what the board held last time, so the placeholder is close to
 * the right size and the page barely moves when the real thing lands.
 */
function renderLoading() {
  const last = readLastCounts(storage);
  element("reviews-empty").hidden = true;
  element("reviews-count").replaceChildren(buildSkeletonBar("0.75rem"));
  element("reviews-list").replaceChildren(...times(skeletonCount(last.reviews, 2), buildSkeletonCard));

  const columns = element("board-columns");
  columns.setAttribute("aria-busy", "true");
  columns.replaceChildren(
    ...COLUMNS.map((column, index) => {
      const section = document.createElement("section");
      section.className = "column";
      const head = document.createElement("div");
      head.className = "column-head";
      head.append(buildSkeletonBar("7rem", "skeleton-title"), buildSkeletonBar("1.5rem", "skeleton-pill"));
      const list = document.createElement("ul");
      list.className = "issues";
      // Spread what was there last time across the columns, so the placeholder
      // is the height of the board that is coming (ADR 0004).
      const share = Math.max(1, Math.round(skeletonCount(last.items) / COLUMNS.length));
      list.replaceChildren(...times(index === 0 ? share + 1 : share, buildSkeletonCard));
      section.append(head, list);
      return section;
    }),
  );
  element("board-empty").hidden = true;

  element("repository-group").hidden = !(last.repositories > 1);
  element("repository-filters").replaceChildren(
    ...times(skeletonCount(last.repositories, 2), () => buildSkeletonBar("7rem", "skeleton-pill")),
  );
  element("label-group").hidden = !(last.labels > 0);
  element("label-filters").replaceChildren(
    ...times(skeletonCount(last.labels, 3), () => buildSkeletonBar("4.5rem", "skeleton-pill")),
  );

  element("tokens").replaceChildren(
    ...times(skeletonCount(last.tokens ?? state.tokens.length, 1), buildSkeletonTokenRow),
  );
  state.checks = {};
}

/**
 * Paint the page from the document: the theme on the root, and a colour on the
 * review row and on each column.
 *
 * A part with no record wears the colour the board ships for it; a record
 * always wins, including one that says "None". `data-colour` is absent only
 * when the answer is "None", never merely because nobody has touched that
 * part yet (ADR 0024).
 */
function paint(element_, areaId) {
  if (!element_) return;
  const colour = readColumnColour(state.board, areaId);
  const chosen = COLUMN_COLOURS.find((one) => one.id === colour);
  if (!chosen || chosen.id === DEFAULT_COLOUR) {
    element_.removeAttribute("data-colour");
    element_.style.removeProperty("--tint");
    return;
  }
  element_.setAttribute("data-colour", chosen.id);
  element_.style.setProperty("--tint", chosen.tint);
}

/** The arrow on the press that opens a list: pointing down when it is open. */
function buildChevron(open) {
  const drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  drawing.setAttribute("viewBox", "0 0 24 24");
  drawing.setAttribute("aria-hidden", "true");
  drawing.setAttribute("focusable", "false");
  drawing.setAttribute("class", `icon chevron${open ? " is-open" : ""}`);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", "M9 6l6 6-6 6");
  drawing.append(line);
  return drawing;
}

/** The theme the reader chose, on the root element where the tokens read it. */
function paintTheme() {
  const theme = readTheme(state.board);
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

/**
 * One person's face, which is also the button that narrows the list to them.
 *
 * The picture comes from GitHub and can fail to arrive: the circle carries the
 * person's initials underneath, so a face that never loads still says who it is
 * (ADR 0028).
 *
 * @param person `{login, name, avatarUrl}`
 * @param state what the board is waiting on them for, or "" on a review card
 * @param pressed whether the list is already narrowed to them
 */
function buildFace(person, state, pressed, onToggle) {
  const face = document.createElement("button");
  face.type = "button";
  face.className = "avatar";
  if (state !== "") face.setAttribute("data-review", state);
  face.setAttribute("aria-pressed", pressed ? "true" : "false");
  const says = personLabel(person, state);
  explain(face, says);
  face.setAttribute("aria-label", `Show only ${says}`);

  const initials = document.createElement("span");
  initials.className = "avatar-initials";
  initials.textContent = initialsOf(person);
  face.append(initials);

  if (person.avatarUrl !== "") {
    const picture = document.createElement("img");
    picture.className = "avatar-picture";
    picture.src = person.avatarUrl;
    picture.alt = "";
    picture.loading = "lazy";
    // Nothing to report and nothing the reader can do: the initials are
    // already there, so the picture simply leaves.
    picture.addEventListener("error", () => picture.remove());
    face.append(picture);
  }

  face.addEventListener("click", onToggle);
  return face;
}

/** The row of faces on a card, or nothing when there is nobody to draw. */
function buildFaces(people, { state = false, chosen, onToggle }) {
  if (!Array.isArray(people) || people.length === 0) return null;
  const row = document.createElement("p");
  row.className = "issue-people";
  for (const person of people) {
    row.append(buildFace(person, state ? (person.state ?? "") : "", chosen.includes(person.login), () => onToggle(person.login)));
  }
  return row;
}

/** One filter chip. Pressed or not, and it says which through `aria-pressed`. */
function buildChip(label, pressed, onToggle) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip";
  chip.setAttribute("aria-pressed", pressed ? "true" : "false");
  chip.textContent = label;
  chip.addEventListener("click", onToggle);
  return chip;
}

/**
 * Build the chips from what the list actually holds.
 *
 * A repository or a label nobody is assigned anything in is not offered: a
 * filter that can only ever empty the board is noise (ADR 0009).
 */
function renderFilters() {
  element("kind-filters").replaceChildren(
    ...KIND_FILTERS.map((kind) =>
      buildChip(kind.label, state.kind === kind.id, () => {
        state.kind = kind.id;
        afterFilterChange();
      }),
    ),
  );

  const repositories = availableRepositories(state.items);
  element("repository-group").hidden = repositories.length < 2;
  element("repository-filters").replaceChildren(
    ...repositories.map((name) =>
      buildChip(name, state.repositories.includes(name), () => {
        state.repositories = toggleInList(state.repositories, name);
        afterFilterChange();
      }),
    ),
  );

  // Only offered when the list can actually use it, exactly like the
  // repository chips (ADR 0009).
  const reviewers = availableReviewers(state.items);
  element("reviewer-group").hidden = reviewers.length < 2;
  element("reviewer-filters").replaceChildren(
    ...reviewers.map((person) =>
      buildChip(person.name, state.reviewers.includes(person.login), () => {
        state.reviewers = toggleInList(state.reviewers, person.login);
        afterFilterChange();
      }),
    ),
  );

  const assignees = availableAssignees(withoutItems(state.reviews, state.items));
  element("assignee-group").hidden = assignees.length < 2;
  element("assignee-filters").replaceChildren(
    ...assignees.map((person) =>
      buildChip(person.name, state.assignees.includes(person.login), () => {
        state.assignees = toggleInList(state.assignees, person.login);
        afterFilterChange();
      }),
    ),
  );

  const labels = availableLabels(state.items);
  element("label-group").hidden = labels.length === 0;
  element("label-filters").replaceChildren(
    ...labels.map((name) =>
      buildChip(name, state.labels.includes(name), () => {
        state.labels = toggleInList(state.labels, name);
        afterFilterChange();
      }),
    ),
  );
}

function afterFilterChange() {
  rememberUrl();
  renderFilters();
  renderBoard();
}

function clearFilters() {
  state.kind = DEFAULT_KIND;
  state.repositories = [];
  state.labels = [];
  state.assignees = [];
  state.reviewers = [];
  afterFilterChange();
}

/**
 * One saved token: a name the reader owns, and one line of facts under it.
 *
 * The name is theirs because GitHub does not say which owner a token is scoped
 * to. The board suggests one from where the token found work, and never
 * overwrites what the reader typed (ADR 0007).
 */
function buildTokenRow(entry, index) {
  const row = document.createElement("li");
  row.className = "token-row";

  const reach = document.createElement("div");
  reach.className = "token-lines";

  const suggestion = suggestedTokenName(entry, index);
  const name = document.createElement("input");
  name.className = "input token-name";
  name.type = "text";
  name.value = entry.name || suggestion;
  name.placeholder = suggestion;
  name.setAttribute("aria-label", "Name for this token");
  // On change, not on input: renaming must not save on every keystroke, and the
  // row must not be rebuilt under the cursor.
  name.addEventListener("change", () => {
    state.tokens = renameToken(state.tokens, entry.id, name.value);
    saveTokens(storage, state.tokens);
  });
  reach.append(name);

  const detail = document.createElement("p");
  detail.className = "check-detail";
  detail.textContent = describeTokenReach(entry);
  reach.append(detail);

  // GitHub shows a token once and never again, so this browser holds the only
  // copy, and Copy hands it back through the warning (ADR 0015). The token in
  // full is never offered: it only appears when the clipboard was refused.
  if (state.revealed.has(entry.id)) {
    const full = document.createElement("code");
    full.className = "token-revealed";
    full.textContent = entry.token;
    reach.append(full);
  }

  const actions = document.createElement("div");
  actions.className = "token-actions";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "button button-ghost";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => {
    askBeforeShowing(() => copyToClipboard(entry.token, copy, "Copy", () => revealToken(entry.id)));
  });

  const drop = document.createElement("button");
  drop.type = "button";
  drop.className = "button button-danger";
  drop.textContent = "Remove";
  drop.addEventListener("click", () => {
    state.tokens = removeToken(state.tokens, entry.id);
    saveTokens(storage, state.tokens);
    if (state.tokens.length === 0) return signOut();
    connectAll();
  });

  // A token the board already holds is usually the one that should write the
  // board file too. One press hands it to cloud storage, with the default
  // repository name, instead of asking the reader to paste it twice.
  if (!readCloudToken(storage)) {
    const use = document.createElement("button");
    use.type = "button";
    use.className = "button button-ghost";
    use.textContent = "Use as storage token";
    explain(use, `Save your half of the board with this token, in a private repository named ${CLOUD_REPO_NAME} on its account.`);
    use.addEventListener("click", async () => {
      use.disabled = true;
      const viewer = await fetchViewer(entry.token);
      const login = viewer.ok ? String(viewer.data?.login ?? "") : "";
      if (login === "") {
        use.disabled = false;
        return showNotice("settings-notice", describeFailure(viewer));
      }
      saveCloudToken(storage, { token: entry.token, name: entry.name, login, grantedPermissions: null });
      saveCloudRepo(storage, { owner: login, repo: CLOUD_REPO_NAME });
      cloudPanel?.refresh();
      store.reconnect();
      renderTokenList();
    });
    actions.append(use);
  }

  actions.append(copy, drop);
  row.append(reach, actions);

  // What this token proved, folded. One line says whether anything needs
  // attention, so nobody has to open every token to find the broken one
  // (ADR 0018).
  const proved = Array.isArray(state.checks[entry.id]) ? state.checks[entry.id] : [];
  const fold = document.createElement("details");
  fold.className = "token-checks";
  const summary = document.createElement("summary");
  summary.className = "token-checks-summary";
  summary.textContent = summariseChecks(proved);
  if (proved.some((one) => one?.ok !== true)) fold.classList.add("has-trouble");
  const list = document.createElement("ul");
  list.className = "checks";
  list.replaceChildren(...proved.map(buildCheckRow));
  fold.append(summary, list);
  row.append(fold);

  return row;
}

/**
 * Put one token on screen, and take every other one back off it.
 *
 * Only a refused clipboard calls this. Nothing on the row offers it, because
 * Copy is enough on a browser that has a clipboard.
 */
function revealToken(id) {
  state.revealed = new Set([id]);
  renderTokenList();
}

/**
 * Run something that puts a token where it can be read, once the reader has
 * seen the warning.
 *
 * The warning is read once a visit. Repeating it on every press would train the
 * reader to click it away, which is the opposite of what a warning is for.
 */
function askBeforeShowing(run) {
  if (state.warningRead) return run();
  state.onWarningAccepted = run;
  element("token-warning").showModal();
}

/**
 * Put text on the clipboard and say so on the button that asked.
 *
 * A browser refuses the clipboard outside a secure page, and the reader must
 * not be left thinking a copy happened. `whenRefused` is the way out that needs
 * no clipboard: show the token so it can be selected by hand.
 */
async function copyToClipboard(text, button, label, whenRefused) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = label;
    }, 1500);
  } catch {
    whenRefused();
    showNotice("settings-notice", "This browser refused the clipboard. Select the text and copy it.");
  }
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

/** The note box for one card, which exists only once there is a note or a request for one. */
/**
 * Make a note box exactly as tall as the note in it, and no taller.
 *
 * One line to start. Most notes are a few words, and an empty box three lines
 * high costs more of a column than every note on the board put together.
 *
 * It measures, so the box has to be on the page already: a box that is not in
 * the document has no height to read. `renderBoard` runs it over the board
 * once the cards are in place, which is why this is not a `requestAnimationFrame`
 * inside the builder. A hidden tab never runs those, so a board drawn in a tab
 * the reader has not looked at yet would keep every note one line high and cut
 * the rest off.
 */
function fitNote(note) {
  note.style.height = "auto";
  // The box is `border-box`, so its height has to carry the border as well, or
  // the last line is short by two pixels and the box starts scrolling.
  note.style.height = `${note.scrollHeight + (note.offsetHeight - note.clientHeight)}px`;
}

function buildNoteBox(item, written) {
  const note = document.createElement("textarea");
  note.className = "input note";
  note.id = `note-${item.key}`;
  note.rows = 1;
  note.placeholder = "A note only you can see";
  note.value = written;
  note.setAttribute("aria-label", `Note on ${item.repository} #${item.number}`);

  note.addEventListener("input", () => {
    state.board = writeNote(state.board, item.key, note.value, new Date().toISOString());
    scheduleSave();
    fitNote(note);
  });
  return note;
}

/* -------------------------------------------------------------------------- */
/* The tooltip                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What one thing explains when the pointer rests on it.
 *
 * Everything the board explains on hover goes through here, and nothing sets
 * `title`. A `title` is the operating system's tooltip: it cannot be themed,
 * it cannot be laid out, and it reads a breakdown of six lines as one cramped
 * block (ADR 0033). `invariants.test.js` holds the page to it.
 */
function explain(target, words) {
  if (typeof words === "string" && words.trim() !== "") target.setAttribute("data-tip", words);
  else target.removeAttribute("data-tip");
}

/** The thing the tooltip is about right now, and the wait before it appears. */
let tipFor = null;
let tipTimer = 0;

function hideTip() {
  clearTimeout(tipTimer);
  tipFor = null;
  const tip = element("tooltip");
  if (tip?.matches(":popover-open")) tip.hidePopover();
}

/**
 * Show one, and put it where it fits.
 *
 * Filled and opened before it is placed, because an element with no size
 * cannot be placed: `tipPlacement` reads the tooltip's own width and height.
 */
function showTip(target) {
  const words = target.dataset.tip ?? "";
  if (words === "") return;
  const tip = element("tooltip");
  tipFor = target;
  tip.textContent = words;
  tip.showPopover();
  const at = tipPlacement(target.getBoundingClientRect(), tip.getBoundingClientRect(), {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  tip.style.left = `${at.left}px`;
  tip.style.top = `${at.top}px`;
  tip.setAttribute("data-side", at.side);
}

const tipTarget = (node) => (node instanceof Element ? node.closest("[data-tip]") : null);

/**
 * One set of listeners for the whole page.
 *
 * The board rebuilds every card each time it asks GitHub, so a listener per
 * element would be a listener per card per minute. The page is asked instead,
 * which also covers everything drawn after this runs.
 */
function wireTooltip() {
  document.addEventListener("pointerover", (event) => {
    // A finger has no hover. A tap would otherwise leave a tooltip behind it,
    // which is what `title` gets right by doing nothing at all on touch.
    if (event.pointerType !== "mouse") return;
    const target = tipTarget(event.target);
    if (!target || target === tipFor) return;
    hideTip();
    tipTimer = setTimeout(() => showTip(target), TOOLTIP_DELAY_MS);
  });

  document.addEventListener("pointerout", (event) => {
    const from = tipTarget(event.target);
    if (!from || tipTarget(event.relatedTarget) === from) return;
    hideTip();
  });

  // A keyboard has no pointer to rest, so focus says it at once.
  document.addEventListener("focusin", (event) => {
    const target = tipTarget(event.target);
    hideTip();
    if (target) showTip(target);
  });
  document.addEventListener("focusout", hideTip);

  // Escape closes it, the way it closes the menu. Scrolling and resizing move
  // the thing it points at, and a tooltip beside nothing is worse than none.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTip();
  });
  document.addEventListener("click", hideTip);
  window.addEventListener("resize", hideTip);
  // Capturing, because the columns scroll and a scroll inside them does not
  // reach the window.
  window.addEventListener("scroll", hideTip, true);
}

/* -------------------------------------------------------------------------- */
/* The card menu                                                              */
/* -------------------------------------------------------------------------- */

/**
 * One row in the card menu for a line the reader wrote.
 *
 * The row is named by the reader and copies their own text, filled from this
 * card. What it will copy is on the row as its tooltip, so the reader can tell
 * two similar lines apart without pressing either (ADR 0031).
 */
function buildCopyMenuRow(action, item) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "menu-item";
  row.setAttribute("role", "menuitem");
  row.textContent = action.label;
  const filled = fillCopyTemplate(action.template, item);
  explain(row, filled);
  row.addEventListener("click", async () => {
    closeCardMenu();
    try {
      await navigator.clipboard.writeText(filled);
      setStatus(`Copied ${filled}`);
    } catch {
      // Nowhere to put it but the status line, which is at least selectable.
      setStatus(`This browser would not copy. The line is ${filled}`);
    }
  });
  return row;
}

/**
 * Put a menu next to the thing that opened it, and keep it on the screen.
 *
 * A popover lives in the browser's top layer, so nothing clips it, and nothing
 * positions it either: it has to be placed by hand. The clamp is what stops a
 * menu opened by the last card in the last column from hanging off the edge.
 */
function placeMenu(menu, anchor, { beside = false } = {}) {
  const at = anchor.getBoundingClientRect();
  const size = menu.getBoundingClientRect();
  const gap = 4;
  const left = beside ? at.right + gap : at.right - size.width;
  const top = beside ? at.top : at.bottom + gap;
  menu.style.left = `${Math.max(gap, Math.min(left, window.innerWidth - size.width - gap))}px`;
  menu.style.top = `${Math.max(gap, Math.min(top, window.innerHeight - size.height - gap))}px`;
}

/**
 * Fill the list of columns for whichever card the menu is pointed at.
 *
 * One menu serves the whole board, rather than one menu per card: a board of
 * forty cards would otherwise carry eighty menus nobody has opened (ADR 0012).
 * It is filled before it is shown, so it has its size when it is placed.
 */
function fillMoveMenu() {
  const item = state.menuItem;
  const submenu = element("card-submenu");
  if (!item) return submenu.replaceChildren();
  const options = moveOptions(item, readRelationship(state.links, item.key), readColumn(state.board, item.key));

  submenu.replaceChildren(
    ...options.map((option) => {
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = option.current ? "menu-item is-current" : "menu-item";
      choice.setAttribute("role", "menuitemradio");
      choice.setAttribute("aria-checked", option.current ? "true" : "false");

      const mark = document.createElement("span");
      mark.className = "menu-mark";
      mark.textContent = option.current ? "✓" : "";
      const label = document.createElement("span");
      label.textContent = option.label;
      choice.append(mark, label);

      choice.addEventListener("click", () => {
        state.board = writeColumn(
          state.board,
          item.key,
          option.id === AUTOMATIC ? "" : option.id,
          new Date().toISOString(),
        );
        scheduleSave();
        closeCardMenu();
        renderBoard();
      });
      return choice;
    }),
  );
}

function closeCardMenu() {
  element("card-submenu").hidePopover();
  element("card-menu").hidePopover();
}

/** One line of links on a card: a label, then each linked item. */
function buildLinkLine(label, links) {
  const line = document.createElement("p");
  line.className = "issue-links";

  const name = document.createElement("span");
  name.className = "link-label";
  name.textContent = label;
  line.append(name);

  for (const link of links) {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.className = "issue-link";
    anchor.textContent = `#${link.number} ${link.title}`;
    line.append(anchor);
  }
  return line;
}

/**
 * One child of an issue: the issue itself, and the column it is in.
 *
 * The column is the same answer the board would give the child if it were a
 * card: the rule reads GitHub, and a column the reader chose by hand wins over
 * the rule, so the parent's list can never disagree with the child's own card
 * (ADR 0011).
 */
function buildChildRow({ item: child, columnId }) {
  const row = document.createElement("li");
  row.className = "child";

  const link = document.createElement("a");
  link.className = "issue-link child-title";
  link.href = child.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = `#${child.number} ${child.title}`;
  explain(link, child.title);

  row.append(link);

  // Only a child the board actually asked GitHub about gets a state. It asks
  // about one batch of children, so a board with a great many says nothing
  // about the last of them rather than reading them all as "To do" (ADR 0010).
  if (columnId !== "") {
    const badge = document.createElement("span");
    badge.className = "badge badge-outline child-state";
    badge.textContent = stateLabel(columnId);
    // The colour the reader painted that column, so the state on a child reads
    // as the place it would sit rather than as a word to be looked up
    // (ADR 0024, ADR 0032).
    paint(badge, columnId);
    row.append(badge);
  }
  return row;
}

/** The column each child is in, or "" when the board never asked about it. */
function childRows(children) {
  return orderChildren(
    children.map((child) => ({
      item: child,
      columnId: knowsAbout(state.links, child.key)
        ? columnFor(child, readRelationship(state.links, child.key), readColumn(state.board, child.key))
        : "",
    })),
  );
}

/**
 * One pill: one child, painted with the colour of the column it sits in.
 *
 * The pill carries no words, so it is a link to the issue and its whole
 * meaning is in the tooltip. A child the board could not ask GitHub about is
 * left unpainted rather than read as "To do" (ADR 0010, ADR 0032).
 */
function buildChildPill(row) {
  const pill = document.createElement("a");
  pill.className = "child-pill";
  pill.href = row.item.url;
  pill.target = "_blank";
  pill.rel = "noopener";
  pill.setAttribute("aria-label", childSummary(row));
  if (row.columnId !== "") {
    pill.setAttribute("data-column", row.columnId);
    paint(pill, row.columnId);
  }
  explain(pill, childSummary(row));
  return pill;
}

/**
 * The children of an issue: one pill each, the count beside them, and the list
 * one press below.
 *
 * The card used to say "3 of 8 done" and list five children. The number said
 * how much was left and nothing about what it was, and the list took five rows
 * of a card that sits in a column beside five others. The pills answer "how is
 * this going" in one line, each painted with the colour of the column that
 * child is in, and the list is there for anybody who asks (ADR 0032).
 *
 * What GitHub did not answer with is a link to the issue itself, because
 * "and 7 more" with nowhere to go is worse than not saying it.
 */
function buildChildren(item, subIssues) {
  const box = document.createElement("div");
  box.className = "issue-children";

  const rows = childRows(subIssues.children);
  const progress = childrenProgress(subIssues);

  const heading = document.createElement("p");
  heading.className = "issue-links children-head";
  const label = document.createElement("span");
  label.className = "link-label";
  label.textContent = "Children";

  const pills = document.createElement("span");
  pills.className = "child-pills";
  pills.replaceChildren(...rows.map(buildChildPill));

  const value = document.createElement("span");
  value.className = "children-count";
  value.textContent = progress.label;
  explain(value, `${progress.done} of ${progress.total} closed`);

  heading.append(label, pills, value);
  box.append(heading);

  const open = state.childrenOpen.has(item.key);
  if (rows.length > 0) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "button button-ghost children-toggle";
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.append(buildChevron(open), document.createTextNode(childrenToggleLabel(open, rows.length)));
    toggle.addEventListener("click", () => {
      if (open) state.childrenOpen.delete(item.key);
      else state.childrenOpen.add(item.key);
      renderBoard();
    });
    box.append(toggle);
  }

  if (open && rows.length > 0) {
    const list = document.createElement("ul");
    list.className = "children";
    list.replaceChildren(...rows.map(buildChildRow));
    box.append(list);
  }

  // Only what GitHub did not answer with at all. The children in the list are
  // one press away and are not "more on GitHub".
  const missing = subIssues.total - subIssues.children.length;
  if (missing > 0) {
    const more = document.createElement("a");
    more.className = "children-more";
    more.href = item.url;
    more.target = "_blank";
    more.rel = "noopener";
    more.textContent = `and ${missing} more on GitHub`;
    box.append(more);
  }

  return box;
}

/** One card, with any pull request that closes it nested inside. */
function buildGroupCard({ item, children }) {
  // The nested pull request draws the review, so the issue above it must not
  // draw the same faces again (ADR 0028).
  //
  // The badge goes on whichever card is the pull request, which is the same
  // card the stack lights up: an issue is never in a stack, because a stack is
  // read from branch names and an issue has none (ADR 0020, ADR 0027).
  const card = buildWorkItemCard(item, {
    people: children.length > 0 ? "none" : "reviewers",
    stack: state.stackBadges[item.key] ?? null,
  });
  if (children.length === 0) return card;

  // An issue is never in a stack itself, but the card the reader is pointing at
  // in a column is this one, so it lights up with the pull request inside it.
  // Without this, hovering a stack lit a small box inside a card instead of the
  // card (ADR 0027).
  const lit = children.map((child) => state.stackRoots[child.key]).find(Boolean);
  if (lit && !card.hasAttribute("data-stack")) card.setAttribute("data-stack", lit);

  const nest = document.createElement("ul");
  nest.className = "issues nested";
  nest.replaceChildren(
    ...children.map((child) =>
      buildWorkItemCard(child, {
        withMenu: false,
        compact: true,
        people: "reviewers",
        stack: state.stackBadges[child.key] ?? null,
      }),
    ),
  );
  card.append(nest);
  return card;
}

/**
 * The days the last column is about, and the control that changes them.
 *
 * A standup asks "what did you finish yesterday", and on a Monday it asks
 * about last week, so the column takes a range rather than only today. Three
 * presets are the words people use out loud; the two date boxes are the
 * calendar for everything else, and a browser draws them itself (ADR 0034).
 */
function buildDoneRange() {
  const open = state.donePickerOpen;
  const toggle = document.createElement("button");
  toggle.type = "button";
  // Not the card's own `icon-button`: that one is positioned in the corner of
  // the card it belongs to, and this one sits in a row of headings.
  toggle.className = "done-range-toggle";
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.append(buildCalendarIcon());
  explain(toggle, "Choose which days this column is about");
  toggle.addEventListener("click", () => {
    state.donePickerOpen = !state.donePickerOpen;
    renderBoard();
  });

  // The panel sits under the whole heading rather than under the press, so it
  // takes the width of the column and nothing has to be positioned by hand.
  if (!open) return { toggle, panel: null };

  const panel = document.createElement("div");
  panel.className = "done-range-panel";

  const presets = document.createElement("div");
  presets.className = "chips";
  presets.setAttribute("role", "group");
  presets.setAttribute("aria-label", "Which days this column is about");
  for (const preset of RANGE_PRESETS) {
    presets.append(
      buildChip(preset.label, state.doneRange === preset.id, () => {
        chooseDoneRange(preset.id);
      }),
    );
  }
  panel.append(presets);

  // The browser draws the calendar, in the reader's own language and with
  // their own first day of the week. Nothing here has to.
  const dates = rangeDates(state.doneRange, new Date());
  const row = document.createElement("div");
  row.className = "field-row done-range-dates";
  const from = document.createElement("input");
  from.type = "date";
  from.className = "input";
  from.value = dates.from;
  from.setAttribute("aria-label", "First day");
  const to = document.createElement("input");
  to.type = "date";
  to.className = "input";
  to.value = dates.to;
  to.setAttribute("aria-label", "Last day");
  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "button button-outline";
  apply.textContent = "Show";
  apply.addEventListener("click", () => {
    chooseDoneRange(rangeFromDates(from.value, to.value));
  });
  row.append(from, to, apply);
  panel.append(row);

  return { toggle, panel };
}

/** The calendar on the press that opens the picker. */
function buildCalendarIcon() {
  const drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  drawing.setAttribute("viewBox", "0 0 24 24");
  drawing.setAttribute("aria-hidden", "true");
  drawing.setAttribute("focusable", "false");
  drawing.setAttribute("class", "icon");
  for (const d of ["M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18", "M8 3v4", "M16 3v4"]) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", d);
    drawing.append(line);
  }
  return drawing;
}

/**
 * Show a different set of days in the last column.
 *
 * The range decides what the board asks GitHub for, so it takes a read rather
 * than only a redraw. The read is quiet: the board already holds a good answer
 * for every other column, and replacing a good answer with placeholders would
 * make a change of days look like a reload (ADR 0029).
 */
function chooseDoneRange(range) {
  const chosen = readRange(range);
  if (chosen === state.doneRange) {
    state.donePickerOpen = false;
    renderBoard();
    return;
  }
  state.doneRange = chosen;
  state.donePickerOpen = false;
  rememberUrl();
  renderBoard();
  connectAll({ quiet: true }).catch(() => {});
}

/** One column: its name, how much is in it, and the cards. */
function buildColumn({ column, groups }, counted) {
  const section = document.createElement("section");
  section.className = "column";
  section.dataset.columnId = column.id;
  section.setAttribute("aria-label", column.label);

  const head = document.createElement("div");
  head.className = "column-head";

  // The last column says which days it is about, because the reader can move
  // it off today and a heading that still said "Done today" would be a lie
  // (ADR 0034).
  const isDone = column.id === "done";
  const name = document.createElement("h3");
  name.className = "column-name";
  name.textContent = isDone ? rangeLabel(state.doneRange, new Date()) : column.label;
  explain(name, isDone ? rangeHint(state.doneRange, new Date()) : column.hint);

  // The number the reader asked for, which is not always how many cards are
  // there: a part of the board can be set to leave out the work pushed down,
  // and then it has to say so (ADR 0026, ADR 0030).
  const count = document.createElement("span");
  count.className = "badge column-count";
  count.textContent = String(counted?.count ?? groups.length);
  const left = describeExcluded(counted?.excluded ?? 0);
  explain(count, left);
  head.append(name, count);
  const picker = isDone ? buildDoneRange() : null;
  if (picker) head.append(picker.toggle);

  const list = document.createElement("ul");
  list.className = "issues";
  list.replaceChildren(...groups.map(buildGroupCard));

  section.append(head);
  if (picker?.panel) section.append(picker.panel);

  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "column-empty";
    empty.textContent = "Nothing here";
    section.append(empty);
    return section;
  }

  section.append(list);
  return section;
}

/**
 * Light up every card in one stack, and nothing else.
 *
 * A stack is scattered: its cards can sit in two columns, or in a column and
 * the review row, and the order alone does not say which belong together. The
 * pointer answers that, and so does the keyboard, because a card is reachable
 * by tab and a reader who never uses a mouse asks the same question (ADR 0027).
 *
 * @param root the key of the stack's bottom, or "" to light nothing
 */
function lightStack(root) {
  for (const card of document.querySelectorAll(".issue[data-stack]")) {
    card.classList.toggle("stack-lit", root !== "" && card.dataset.stack === root);
  }
}

/** What each part of the board counts, as the reader set it (ADR 0030). */
function countingSettings() {
  const chosen = {};
  for (const area of colourableAreas()) chosen[area.id] = readCounting(state.board, area.id);
  return chosen;
}

/**
 * The number on the page and the name of the browser tab.
 *
 * The tab is the point: a board sitting behind three other tabs is a board
 * nobody looks at, and the number is what brings the reader back on purpose
 * rather than on a hunch (ADR 0030).
 */
function showTotal(counts) {
  document.title = tabTitle(counts.total);
  const badge = element("board-total");
  badge.textContent = counts.total > 0 ? `(${counts.total})` : "";
  badge.hidden = counts.total === 0;
  explain(badge, describeBreakdown(counts.parts));
}

/** The cards the reader marked, out of the ones on screen right now. */
function lowPriorityKeys(items) {
  const marked = new Set();
  for (const item of items) {
    if (item && readPriority(state.board, item.key) === LOW) marked.add(item.key);
  }
  return marked;
}

/**
 * Put the list on the screen in the chosen order.
 *
 * Called on load, when the order changes, and after a note is written, because
 * "ones you noted first" moves an item the moment the first character lands.
 */
function renderBoard() {
  paintTheme();
  // Every card is about to be replaced, and a tooltip about an element that no
  // longer exists would sit there pointing at nothing.
  hideTip();
  const hasNote = (key) => readNote(state.board, key).trim() !== "";
  const visible = filterByPerson(filterWorkItems(state.items, state), state.reviewers, "reviewers");
  const ordered = sortWorkItems(visible, state.sortId, hasNote);
  // The stack pass runs on the grouped board, not on the items: a pull request
  // travels inside the card of the issue it closes, so the card is what moves.
  // Only the smart order asks for it; every other order says what it does and
  // must keep doing exactly that (ADR 0016).
  const plain = groupByLinkedIssue(ordered, state.links);
  // The cards the reader pushed down go last, and take anything stacked on top
  // of them along: those cannot merge first, so leaving them up would show work
  // that reads as ready and is not (ADR 0016, ADR 0026). Like the stack pass,
  // only the smart order does this.
  const grouped =
    state.sortId === "smart"
      ? sinkLowPriority(orderStacksForMerging(plain), lowPriorityKeys(plain.map((group) => group.item)))
      : plain;

  // The row above the columns. It follows the chosen order, and with no choice
  // made it puts the longest-waiting first (ADR 0013).
  const queued = sortWorkItems(
    filterByPerson(withoutItems(state.reviews, state.items), state.assignees, "assignees"),
    reviewSortId(state.sortId),
    hasNote,
  );
  // The row is ordered by the same rules as a column, in the same order: the
  // stacks first, then the cards the reader pushed down (ADR 0016, ADR 0026).
  // The row is flat and a column holds groups, which is the only difference.
  const waiting =
    state.sortId === "smart"
      ? sinkLowPriorityItems(orderItemsForMerging(queued), lowPriorityKeys(queued))
      : queued;

  // Over everything on screen, not one area: a stack can have a card in the
  // review row and another in a column, and the reader can see both. The badge
  // keeps its own count of the review row alone, which answers a different
  // question: where this card sits among the ones you were asked to review
  // (ADR 0020, ADR 0027).
  const onBoard = grouped.flatMap((group) => [group.item, ...group.children]);
  const onScreen = [...waiting, ...onBoard];
  state.stackRoots = Object.fromEntries(
    Object.entries(stackPositions(onScreen)).map(([key, at]) => [key, at.root]),
  );
  // The badge on a card in a column counts the board, the way the badge in the
  // review row counts the review row: each one is the truth about the list the
  // reader is looking at (ADR 0020).
  state.stackBadges = stackPositions(onBoard);
  element("reviews-empty").hidden = waiting.length > 0;
  const stacked = stackPositions(waiting);
  element("reviews-list").replaceChildren(
    ...waiting.map((item) =>
      buildWorkItemCard(item, { withMenu: false, stack: stacked[item.key] ?? null, people: "assignees" }),
    ),
  );

  const overrides = {};
  for (const { item } of grouped) overrides[item.key] = readColumn(state.board, item.key);
  const board = groupIntoColumns(grouped, state.links, overrides);

  // Every number on the page comes from one pass, so the badge on a column, the
  // number beside the title and the name of the browser tab can never disagree
  // (ADR 0030). The work pushed down is read through the same set the fade and
  // the sink use, never a second check of its own (ADR 0026).
  // `colourableAreas` is the one list of the board's parts, so Settings and the
  // counting can never drift apart on what the parts are.
  const keysByArea = {
    [REVIEW_ROW_ID]: waiting.map((item) => item.key),
    ...Object.fromEntries(board.map(({ column, groups }) => [column.id, groups.map((group) => group.item.key)])),
  };
  const counts = countBoard(
    colourableAreas().map((area) => ({ ...area, keys: keysByArea[area.id] ?? [] })),
    lowPriorityKeys([...waiting, ...board.flatMap(({ groups }) => groups.map((group) => group.item))]),
    countingSettings(),
  );
  const countFor = Object.fromEntries(counts.parts.map((part) => [part.id, part]));

  const reviewCount = element("reviews-count");
  reviewCount.textContent = String(countFor[REVIEW_ROW_ID]?.count ?? waiting.length);
  const leftOut = describeExcluded(countFor[REVIEW_ROW_ID]?.excluded ?? 0);
  explain(reviewCount, leftOut);

  element("board-columns").replaceChildren(...board.map((one) => buildColumn(one, countFor[one.column.id])));
  showTotal(counts);
  // The cards are on the page now, so every note can be measured (ADR 0014).
  for (const note of document.querySelectorAll(".issue .note")) fitNote(note);
  paint(element("reviews"), REVIEW_ROW_ID);
  for (const column of document.querySelectorAll("#board-columns .column")) {
    paint(column, column.dataset.columnId);
  }

  const narrowed = activeFilterCount(state) > 0;

  // An empty list has two very different causes, and the way out of each one is
  // different too: widen the filters, or add a token (ADR 0007, ADR 0009).
  const hiddenByFilters = state.items.length > 0 && visible.length === 0;
  const owners = [...new Set(state.tokens.flatMap((entry) => entry.owners))];
  element("board-empty").hidden = visible.length > 0;
  element("board-empty-reason").textContent = hiddenByFilters
    ? "Nothing here matches the filters you chose."
    : sayEmptyBoard({ tokenCount: state.tokens.length, owners });
  element("board-empty-hint").hidden = hiddenByFilters;
  element("empty-open-settings").hidden = hiddenByFilters;
  element("clear-filters").hidden = !narrowed;
}

/**
 * The appearance panel in Settings: the theme, and a colour for each part of
 * the board. Both are written to the reader's own repository, so a choice made
 * on one machine is there on the next (ADR 0024).
 */
/**
 * What each part of the board counts, in Settings.
 *
 * Two answers per part, both as pressed buttons rather than as checkboxes,
 * because every two-state control on this page is a button that says so through
 * `aria-pressed` (ADR 0004). A checkbox here would be the only one in the
 * project.
 */
function renderCounting() {
  element("counting-areas").replaceChildren(
    ...colourableAreas().map((area) => {
      const row = document.createElement("li");
      row.className = "colour-area counting-area";

      const name = document.createElement("p");
      name.className = "colour-area-name";
      name.textContent = area.label;

      const chips = document.createElement("div");
      chips.className = "chips";
      chips.setAttribute("role", "group");
      chips.setAttribute("aria-label", `What ${area.label} counts`);

      const chosen = readCounting(state.board, area.id);
      const set = (changes) => {
        state.board = writeCounting(state.board, area.id, { ...chosen, ...changes }, new Date().toISOString());
        scheduleSave();
        renderCounting();
        renderBoard();
      };

      chips.append(
        buildChip("In the tab name", chosen.counted, () => set({ counted: !chosen.counted })),
        buildChip('Count "not a priority"', chosen.withLowPriority, () =>
          set({ withLowPriority: !chosen.withLowPriority }),
        ),
      );

      row.append(name, chips);
      return row;
    }),
  );
}

/**
 * One line the reader wrote, editable where it is shown.
 *
 * Both boxes save as they are typed, like a note box, and the row is never
 * rebuilt under the cursor: a list that redraws itself on every keystroke
 * throws the reader out of the box they are in (ADR 0031).
 */
function buildCopyActionRow(action) {
  const row = document.createElement("li");
  row.className = "copy-action-row";

  const save = (changes) => {
    state.board = writeCopyAction(state.board, action.id, { ...action, ...changes }, new Date().toISOString());
    scheduleSave();
  };

  const lines = document.createElement("div");
  lines.className = "copy-action-lines";

  const name = document.createElement("input");
  name.className = "input copy-action-name";
  name.type = "text";
  name.value = action.label;
  name.placeholder = EXAMPLE_ACTIONS[0].label;
  name.setAttribute("aria-label", "Name of this line");
  name.addEventListener("input", () => save({ label: name.value }));

  const template = document.createElement("input");
  template.className = "input";
  template.type = "text";
  template.spellcheck = false;
  template.value = action.template;
  template.placeholder = EXAMPLE_ACTIONS[0].template;
  template.setAttribute("aria-label", "What this line copies");
  template.addEventListener("input", () => save({ template: template.value }));

  lines.append(name, template);

  const buttons = document.createElement("div");
  buttons.className = "copy-action-buttons";
  const drop = document.createElement("button");
  drop.type = "button";
  drop.className = "button button-danger";
  drop.textContent = "Remove";
  drop.addEventListener("click", () => {
    state.board = removeCopyAction(state.board, action.id, new Date().toISOString());
    scheduleSave();
    renderCopyActions();
  });
  buttons.append(drop);

  row.append(lines, buttons);
  return row;
}

/** The lines the reader wrote, in Settings. */
function renderCopyActions() {
  const actions = readCopyActions(state.board);
  element("copy-actions-empty").hidden = actions.length > 0;
  element("copy-actions").replaceChildren(...actions.map(buildCopyActionRow));
}

/**
 * The examples in the empty boxes, and the list of placeholders under them.
 *
 * Nobody starts with a line, so the boxes have to say what one looks like, and
 * both the examples and the placeholders come from `copyActions.js` so the page
 * cannot offer something the board does not fill (ADR 0031).
 */
function renderCopyActionHelp() {
  element("new-copy-action-name").placeholder = EXAMPLE_ACTIONS[0].label;
  element("new-copy-action-template").placeholder = EXAMPLE_ACTIONS[0].template;

  element("copy-action-examples").replaceChildren(
    ...EXAMPLE_ACTIONS.map((one) => {
      const row = document.createElement("li");
      row.className = "example-row";
      const name = document.createElement("span");
      name.className = "example-name";
      name.textContent = one.label;
      const line = document.createElement("code");
      line.className = "example-line";
      line.textContent = one.template;
      row.append(name, line);
      return row;
    }),
  );

  element("copy-placeholders").replaceChildren(
    ...PLACEHOLDERS.map((one) => {
      const row = document.createElement("li");
      row.className = "placeholder-row";
      const token = document.createElement("code");
      token.className = "placeholder-token";
      token.textContent = one.token;
      const says = document.createElement("span");
      says.textContent = one.describe;
      row.append(token, says);
      return row;
    }),
  );
}

function renderAppearance() {
  renderCounting();
  renderCopyActions();
  const theme = readTheme(state.board);
  element("theme-choices").replaceChildren(
    ...THEMES.map((one) =>
      buildChip(one.label, theme === one.id, () => {
        state.board = writeTheme(state.board, one.id, new Date().toISOString());
        scheduleSave();
        paintTheme();
        renderAppearance();
      }),
    ),
  );

  element("colour-areas").replaceChildren(
    ...colourableAreas().map((area) => {
      const row = document.createElement("li");
      row.className = "colour-area";

      const name = document.createElement("p");
      name.className = "colour-area-name";
      name.textContent = area.label;

      const swatches = document.createElement("div");
      swatches.className = "swatches";
      swatches.setAttribute("role", "group");
      swatches.setAttribute("aria-label", `Colour for ${area.label}`);
      const chosen = readColumnColour(state.board, area.id);

      for (const colour of COLUMN_COLOURS) {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = colour.id === DEFAULT_COLOUR ? "swatch swatch-none" : "swatch";
        swatch.setAttribute("aria-pressed", chosen === colour.id ? "true" : "false");
        swatch.setAttribute("aria-label", colour.label);
        explain(swatch, colour.label);
        if (colour.tint !== "") swatch.style.setProperty("--tint", colour.tint);
        swatch.addEventListener("click", () => {
          state.board = writeColumnColour(state.board, area.id, colour.id, new Date().toISOString());
          scheduleSave();
          renderAppearance();
          renderBoard();
        });
        swatches.append(swatch);
      }

      row.append(name, swatches);
      return row;
    }),
  );
}

function renderTokenList() {
  renderAppearance();
  element("tokens").replaceChildren(...state.tokens.map((entry, index) => buildTokenRow(entry, index)));
}

/**
 * Show one screen.
 *
 * Which screen is open lives in the address bar (root ADR 0006), so a reload
 * comes back to the same place. Settings needs a token to manage, so before the
 * first connection the welcome screen is the only screen there is.
 */
function showView(view) {
  // Settings carries the cloud storage panel, and the local mirror and the
  // cloud copy can both have changed since it was drawn (root ADR 0016).
  if (view === "settings") cloudPanel?.refresh();
  const connected = state.tokens.length > 0;
  state.view = connected ? view : DEFAULT_VIEW;

  // One control, and where it goes depends on where you are. Adding a token
  // was opened from Settings, so "back" from there means Settings (ADR 0018).
  const back = { board: null, settings: "board", "add-token": "settings" }[state.view] ?? null;
  const label = { settings: "Back to the board", "add-token": "Back to settings" }[state.view] ?? "Settings";

  // A token shown in full stays shown only while the reader is looking at it.
  if (state.view !== "settings" && state.revealed.size > 0) {
    state.revealed.clear();
    renderTokenList();
  }
  const toggle = element("view-toggle");
  toggle.hidden = !connected;
  element("view-toggle-label").textContent = label;
  element("view-toggle-arrow").hidden = back === null;
  state.viewToggleGoesTo = back ?? "settings";
  element("setup").hidden = connected;
  element("board").hidden = !connected || state.view !== "board";
  element("sort-control").hidden = !connected || state.view !== "board";
  element("refresh-control").hidden = !connected || state.view !== "board";
  element("settings-view").hidden = state.view !== "settings";
  element("add-token-view").hidden = state.view !== "add-token";
  rememberUrl();
}

/** Keep the address bar showing the open screen and the chosen order. */
function rememberUrl() {
  const search = buildSearch(state);
  history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
}

/* -------------------------------------------------------------------------- */
/* Connecting                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A one-off message in Settings, or on the add-token screen.
 *
 * The connection checks used to be one list at the bottom of Settings, shared
 * by every token and by messages like this one. They now live folded inside
 * the token they belong to (ADR 0018), so this is only for the answer to
 * something the reader just pressed.
 */
function showNotice(where, text) {
  const line = element(where);
  if (line) line.textContent = text;
}

/**
 * Ask one token what it can reach.
 *
 * Every call says which permission it needed, so a failure names the permission
 * to add rather than repeating GitHub's own wording (ADR 0005).
 *
 * @returns {{entry: object, raw: array, rows: array}} the entry with what it
 *   learned, the raw items it returned, and what to show about it.
 */
async function inspectToken(entry) {
  const rows = [];
  const [identity, work] = CONNECTION_CHECKS;
  let updated = { ...entry, owners: [], itemCount: 0 };
  let links = {};

  const viewer = await fetchViewer(entry.token);
  if (!viewer.ok) {
    rows.push({ id: identity.id, label: identity.label, ok: false, detail: describeFailure({ ...viewer, need: identity.need }) });
    return { entry: updated, raw: [], rows, links, reviews: [] };
  }
  const login = viewer.data?.login ?? "";
  state.login = state.login ?? login;
  rows.push({ id: identity.id, label: identity.label, ok: true, detail: `Signed in as ${login}.` });

  const answer = await fetchAssignedIssues(entry.token);
  if (!answer.ok) {
    rows.push({ id: work.id, label: work.label, ok: false, detail: describeFailure({ ...answer, need: work.need }) });
    return { entry: updated, raw: [], rows, links, reviews: [] };
  }
  const raw = Array.isArray(answer.data) ? answer.data : [];
  const items = normalizeWorkItems(raw);
  const counted = countByKind(items);

  // Where this token found work, which is the suggestion for its name and the
  // one thing about its reach the board can state honestly (ADR 0007).
  const owners = ownersOf(items.map((item) => item.repository));
  updated = { ...updated, owners, itemCount: items.length };

  // What landed in the days the last column is about. A second question,
  // because the first one asks only for open work and a merged pull request is
  // closed (ADR 0017). A token that cannot answer it costs the board nothing
  // but an empty last column. The range is the reader's, and defaults to today
  // (ADR 0034).
  const { from: since, to: until } = rangeBounds(state.doneRange, new Date());
  const closed = await fetchFinishedWork(entry.token, since);
  const finished = closed.ok ? finishedBetween(normalizeWorkItems(closed.data), since, until) : [];
  // Back to the raw rows, so the one merge in `connectAll` still de-duplicates
  // everything two tokens both see. The token's own name and count stay on its
  // open work: what it finished is not a measure of what it reaches (ADR 0007).
  const finishedKeys = new Set(finished.map((one) => one.key));
  const finishedRaw = (Array.isArray(closed.data) ? closed.data : []).filter((one) =>
    finishedKeys.has(one?.node_id),
  );

  // Waiting on you is not assigned to you, so it takes its own question. A
  // token that cannot answer it is not broken: the board simply shows nothing
  // from it (ADR 0013).
  const waiting = await fetchReviewRequests(entry.token);
  const reviews = waiting.ok ? normalizeWorkItems(waiting.data?.items) : [];

  // The relationships of this token's own items, with this token: a node id
  // from one owner is not readable by another owner's token (ADR 0010).
  const linked = await fetchRelationships(
    entry.token,
    [...items, ...finished, ...reviews].map((item) => item.key),
  );
  links = linked.ok ? normalizeRelationships(linked.data) : {};
  rows.push({
    id: work.id,
    label: work.label,
    ok: true,
    detail:
      items.length === 0
        ? "This token reached no repository with work assigned to you."
        : `${counted.issues} issues and ${counted.pullRequests} pull requests, in ${owners.join(", ")}.`,
  });

  if (updated.grantedPermissions === null) updated = { ...updated, grantedPermissions: permissionsFingerprint() };
  return { entry: updated, raw: [...raw, ...finishedRaw], rows, links, reviews };
}

/**
 * Ask every saved token, merge what they return, and show the board.
 *
 * A **quiet** read is the one the auto refresh makes. It draws no placeholders
 * and skips the "Reading GitHub..." status line: the board already holds a
 * good answer, and it is replaced in place by another good answer. The
 * placeholder rule is about a list with nothing in it yet, which is not this
 * case (ADR 0004, ADR 0025).
 */
async function connectAll({ quiet = false } = {}) {
  if (state.tokens.length === 0) return;
  state.loading = true;
  if (!quiet) {
    setStatus("Reading GitHub...");
    showView(state.view);
    renderLoading();
  }

  const checks = {};
  const everything = [];
  const waiting = [];
  let links = {};
  for (const entry of state.tokens) {
    const result = await inspectToken(entry);
    state.tokens = updateToken(state.tokens, entry.id, result.entry);
    everything.push(...result.raw);
    checks[entry.id] = result.rows;
    waiting.push(...(result.reviews ?? []));
    links = { ...links, ...(result.links ?? {}) };
  }
  state.checks = checks;
  state.links = links;
  // Through the same step as the board's own items: a review card needs the
  // branch names to know it is one of a stack (ADR 0020).
  state.reviews = applyPullRequestState(uniqueByKey(waiting), links);

  saveTokens(storage, state.tokens);
  // Merging here, not per token, is what removes an item two tokens both see.
  state.items = applyPullRequestState(normalizeWorkItems(everything), links);

  state.loading = false;
  state.lastReadAt = Date.now();
  element("board-columns").removeAttribute("aria-busy");
  showNotice("settings-notice", "");
  renderTokenList();
  renderTokenNotice();
  renderFilters();
  renderBoard();
  showView(state.view);
  saveLastCounts(storage, {
    reviews: state.reviews.length,
    items: state.items.length,
    repositories: availableRepositories(state.items).length,
    labels: availableLabels(state.items).length,
    tokens: state.tokens.length,
  });
  // Only when something is wrong. A board that saves itself is the ordinary
  // case, and a line that says so on every read is a line nobody reads. The
  // store says so itself when a save does not get through.
  setStatus("");
  // Here rather than only at start-up: a token connected after a sign-out has
  // to start the schedule again, and there was none to start before.
  applyAutoRefresh();
}

/* -------------------------------------------------------------------------- */
/* Asking again                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Whether a refresh right now would interrupt the reader or race a save.
 *
 * A refresh rebuilds every card. A note box being typed into would lose what is
 * in it, and an open menu would vanish under the pointer. A save is worse: it
 * re-reads the board file, merges and writes, so a read landing in the middle
 * of it would replace the document that save is working from (ADR 0002).
 */
function boardIsBusy() {
  if (state.loading || store?.busy) return true;
  if (element("card-menu")?.matches(":popover-open")) return true;
  const focused = document.activeElement;
  return focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement;
}

/** Ask GitHub again, but only when the schedule says so and nothing is in the way. */
function tickRefresh() {
  const due = refreshDue({
    choice: state.refreshId,
    lastAt: state.lastReadAt,
    now: Date.now(),
    hidden: document.visibilityState === "hidden",
    busy: boardIsBusy(),
  });
  if (due) connectAll({ quiet: true }).catch(() => {});
}

/**
 * Start or stop the schedule the reader chose.
 *
 * One timer, always the same length, asking a question that is cheap to answer.
 * Turning the schedule off stops it, so a board set to "Off" runs no timer at
 * all.
 */
function applyAutoRefresh() {
  clearInterval(state.refreshTimer);
  state.refreshTimer = null;
  // "Off", not "the default": those were the same string once, and they are
  // not the same idea (ADR 0025).
  if (state.refreshId === OFF) return;
  // Nothing to ask with, and nothing to ask about.
  if (state.tokens.length === 0) return;
  state.refreshTimer = setInterval(tickRefresh, REFRESH_TICK_MS);
}

/* -------------------------------------------------------------------------- */
/* Saving                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Hand the document to the store. It writes the local mirror at once and the
 * cloud copy a second after the last change, re-reading first so another
 * device's work is merged rather than overwritten (root ADR 0016, ADR 0002).
 */
function scheduleSave() {
  store.write(state.board);
}

/* -------------------------------------------------------------------------- */
/* Start-up                                                                   */
/* -------------------------------------------------------------------------- */

function signOut() {
  forgetAllTokens(storage);
  // Back to what a fresh browser gets. Nothing starts, because `applyAutoRefresh`
  // runs no timer without a token.
  state.refreshId = DEFAULT_REFRESH;
  state.lastReadAt = null;
  applyAutoRefresh();
  element("refresh").value = state.refreshId;
  state.tokens = [];
  state.revealed.clear();
  state.items = [];
  state.reviews = [];
  state.links = {};
  state.login = null;
  element("token").value = "";
  paintTheme();
  showView(DEFAULT_VIEW);
  renderTokenNotice();
}

function connectPastedToken(field, name = "") {
  const pasted = field.value.trim();
  if (pasted === "") {
    return showNotice("add-token-notice", "The token box is empty.");
  }
  // The same box takes a token or a whole backup. Text that was meant to be a
  // backup is never tried as a token: GitHub's answer about a bad credential
  // would hide the real problem, which is a blob that was cut short.
  if (looksLikeBackup(pasted)) return restoreBackup(field, pasted);

  field.value = "";
  const grown = addToken(state.tokens, { id: newId(), token: pasted, name });
  if (grown.length === state.tokens.length) {
    return showNotice("add-token-notice", "The board is already using that token.");
  }
  state.tokens = grown;
  saveTokens(storage, state.tokens);
  if (state.view === "add-token") showView("settings");
  connectAll();
}

/** Put back every token from a pasted backup, skipping the ones already here. */
function restoreBackup(field, pasted) {
  const backup = readTokenBackup(pasted);
  if (!backup.ok) {
    return showNotice("add-token-notice", backup.message);
  }

  let grown = state.tokens;
  let added = 0;
  for (const one of backup.tokens) {
    const next = addToken(grown, { id: newId(), token: one.token, name: one.name });
    if (next.length > grown.length) added += 1;
    grown = next;
  }
  field.value = "";

  if (added === 0) {
    const detail = `The board is already using ${backup.tokens.length === 1 ? "that token" : "every token in it"}.`;
    return showNotice("add-token-notice", detail);
  }
  state.tokens = grown;
  saveTokens(storage, state.tokens);
  if (state.view === "add-token") showView("settings");
  connectAll();
}

function start() {
  renderDeployLine(element("deploy-line"), readStamp(document), "en", say, escapeHtml, PROJECT_PATH);
  fillTokenGuides();

  const asked = readStateFromSearch(location.search);
  state.sortId = asked.sortId;
  state.view = asked.view;
  state.kind = asked.kind;
  state.repositories = asked.repositories;
  state.labels = asked.labels;
  state.doneRange = asked.doneRange;
  renderFilters();
  const sortField = element("sort");
  sortField.replaceChildren(
    ...SORT_OPTIONS.map((option) => {
      const choice = document.createElement("option");
      choice.value = option.id;
      choice.textContent = option.label;
      return choice;
    }),
  );
  sortField.value = state.sortId;
  sortField.addEventListener("change", () => {
    state.sortId = sortField.value;
    rememberUrl();
    renderBoard();
  });

  // The schedule is not in the address bar, unlike the order. A link is shared,
  // and how often somebody else's browser asks GitHub is not the sharer's to
  // choose (ADR 0025).
  const refreshField = element("refresh");
  refreshField.replaceChildren(
    ...REFRESH_CHOICES.map((choice) => {
      const option = document.createElement("option");
      option.value = choice.id;
      option.textContent = choice.label;
      return option;
    }),
  );
  state.refreshId = readAutoRefresh(storage);
  refreshField.value = state.refreshId;
  refreshField.addEventListener("change", () => {
    state.refreshId = refreshField.value;
    saveAutoRefresh(storage, state.refreshId);
    applyAutoRefresh();
  });

  // A tab that was hidden caught no tick, so it catches up the moment it is
  // looked at again rather than up to a whole interval later.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tickRefresh();
  });

  element("connect").addEventListener("click", () => connectPastedToken(element("token")));
  const openAddToken = () => {
    element("another-token").value = "";
    element("another-token-name").value = "";
    showNotice("add-token-notice", "");
    showView("add-token");
    window.scrollTo({ top: 0 });
  };
  element("open-add-token").addEventListener("click", openAddToken);
  element("cancel-add-token").addEventListener("click", () => showView("settings"));
  element("add-token").addEventListener("click", () =>
    connectPastedToken(element("another-token"), element("another-token-name").value),
  );

  const backup = element("copy-backup");
  backup.addEventListener("click", () => {
    if (state.tokens.length === 0) {
      return showNotice("settings-notice", "No token is connected yet.");
    }
    askBeforeShowing(() =>
      copyToClipboard(encodeTokenBackup(state.tokens), backup, "Copy every token as a backup", () =>
        showNotice("settings-notice", "This browser refused the clipboard. Copy each token from its own row."),
      ),
    );
  });

  const warning = element("token-warning");
  // Escape closes the dialog without the button being pressed, so the thing it
  // was going to do must be dropped here too.
  warning.addEventListener("cancel", () => {
    state.onWarningAccepted = null;
  });
  element("token-warning-cancel").addEventListener("click", () => {
    state.onWarningAccepted = null;
    warning.close();
  });
  element("token-warning-go").addEventListener("click", () => {
    state.warningRead = true;
    warning.close();
    const run = state.onWarningAccepted;
    state.onWarningAccepted = null;
    run?.();
  });
  // One listener for the whole page rather than two on every card: the board is
  // rebuilt on every render, and a card carrying its own listeners has to be
  // given them again each time. `mouseover` bubbles, so moving onto anything
  // that is not a stacked card clears the light by itself.
  const followStack = (event) => {
    const card = event.target instanceof Element ? event.target.closest(".issue[data-stack]") : null;
    lightStack(card?.dataset.stack ?? "");
  };
  document.addEventListener("mouseover", followStack);
  document.addEventListener("focusin", followStack);
  // The pointer can leave through the edge of the window, which fires no
  // `mouseover` on the way out.
  document.documentElement.addEventListener("mouseleave", () => lightStack(""));

  // Ask now, whatever the schedule says. The button reports when the board last
  // heard anything, and it is read at the moment the reader asks rather than
  // written once: a label that says "just now" for an hour is worse than none
  // (ADR 0029).
  const refreshNow = element("refresh-now");
  const sayWhen = () => {
    explain(refreshNow, describeLastRefresh(state.lastReadAt, Date.now()));
  };
  refreshNow.addEventListener("mouseenter", sayWhen);
  refreshNow.addEventListener("focus", sayWhen);
  sayWhen();

  refreshNow.addEventListener("click", async () => {
    // Nothing to ask with, or the board is already asking: a second read
    // running beside the first spends the rate limit twice and answers the
    // same question (ADR 0029).
    if (refreshNow.disabled || state.loading || state.tokens.length === 0) return;
    refreshNow.disabled = true;
    refreshNow.setAttribute("aria-busy", "true");
    try {
      // Both, not either: the answer has to be in, and the button has to have
      // been down long enough for the press to have read as one.
      await Promise.all([
        connectAll({ quiet: true }).catch(() => {}),
        new Promise((resume) => setTimeout(resume, MANUAL_REFRESH_REST_MS)),
      ]);
    } finally {
      refreshNow.disabled = false;
      refreshNow.removeAttribute("aria-busy");
      sayWhen();
    }
  });

  renderCopyActionHelp();
  element("add-copy-action").addEventListener("click", () => {
    const name = element("new-copy-action-name");
    const template = element("new-copy-action-template");
    const line = template.value.trim();
    if (line === "") {
      return showNotice("settings-notice", "A line needs something to copy. Write it in the second box.");
    }
    const now = new Date().toISOString();
    state.board = writeCopyAction(state.board, newId(), { label: name.value, template: line, createdAt: now }, now);
    scheduleSave();
    name.value = "";
    template.value = "";
    renderCopyActions();
    name.focus();
  });

  element("view-toggle").addEventListener("click", () => showView(state.viewToggleGoesTo ?? "settings"));
  element("empty-open-settings").addEventListener("click", () => showView("settings"));
  element("clear-filters").addEventListener("click", clearFilters);

  wireTooltip();

  const menu = element("card-menu");
  const submenu = element("card-submenu");
  const move = element("menu-move");

  // Tapped or hovered: both open the columns, because a menu that answers only
  // one of those is broken on half the machines that open it. The tap goes
  // through `popovertarget`; the hover has no click to dismiss it, so it can
  // open the popover itself.
  move.setAttribute("popovertarget", "card-submenu");
  move.addEventListener("mouseenter", () => {
    if (!submenu.matches(":popover-open")) submenu.showPopover();
  });

  element("menu-branch").addEventListener("click", async () => {
    const item = state.menuItem;
    const branch = typeof item?.headRefName === "string" ? item.headRefName : "";
    closeCardMenu();
    if (branch === "") return setStatus("This one has no branch.");
    try {
      await navigator.clipboard.writeText(branch);
      setStatus(`Copied ${branch}.`);
    } catch {
      // Nowhere to put it but the status line, which is at least selectable.
      setStatus(`This browser would not copy. The branch is ${branch}`);
    }
  });

  element("menu-priority").addEventListener("click", () => {
    const item = state.menuItem;
    if (!item) return;
    const now = readPriority(state.board, item.key);
    state.board = writePriority(state.board, item.key, now === LOW ? NORMAL : LOW, new Date().toISOString());
    scheduleSave();
    closeCardMenu();
    renderBoard();
  });

  element("menu-note").addEventListener("click", () => {
    const item = state.menuItem;
    if (!item) return;
    state.notesOpen.add(item.key);
    closeCardMenu();
    renderBoard();
    // After the board is rebuilt, not before: the box did not exist until now.
    element(`note-${item.key}`)?.focus();
  });

  menu.addEventListener("toggle", (event) => {
    const open = event.newState === "open";
    if (open && state.menuItem) {
      element("menu-note").textContent = noteMenuLabel(readNote(state.board, state.menuItem.key));
      element("menu-priority").textContent = priorityMenuLabel(readPriority(state.board, state.menuItem.key));
      const rows = cardMenuRows(state.menuItem, {
        canMove: state.menuCanMove,
        copyActions: readCopyActions(state.board),
      });
      element("menu-copies").replaceChildren(
        ...rows.copies.map((action) => buildCopyMenuRow(action, state.menuItem)),
      );
      element("menu-note").hidden = !rows.note;
      element("menu-branch").hidden = !rows.branch;
      element("menu-priority").hidden = !rows.priority;
      move.hidden = !rows.move;
    }
    state.menuAnchor?.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) placeMenu(menu, state.menuAnchor);
    else submenu.hidePopover();
  });

  // Filled before it is shown, so it has a size to be placed by; placed after,
  // because only then does it have one.
  submenu.addEventListener("beforetoggle", (event) => {
    if (event.newState === "open") fillMoveMenu();
  });
  submenu.addEventListener("toggle", (event) => {
    const open = event.newState === "open";
    move.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) placeMenu(submenu, move, { beside: true });
  });
  // The board's half of the data. `adoptLegacyStorage` runs first so a reader
  // who set the board up before cloud storage existed carries on with the
  // same token and repository (root ADR 0016). The store reads `board.json`
  // from the root of that repository once, when the new path is missing.
  adoptLegacyStorage(storage);
  store = openStore({
    project: PROJECT,
    file: DOCUMENT_PATH,
    recordMaps: RECORD_MAPS,
    legacyPath: DOCUMENT_PATH,
    storage,
    onChange: (document) => {
      state.board = document;
      paintTheme();
      renderAppearance();
      if (!state.loading) renderBoard();
    },
    onStatus: (sync) => {
      // The panel in Settings carries the badge. The board itself speaks only
      // when a save is not getting through (ADR 0019).
      setStatus(sync.state === "broken" ? sync.detail : "");
    },
    onQuestion: askCopyQuestion,
  });
  state.board = store.document;
  paintTheme();
  cloudPanel = mountCloudSettings(element("cloud-settings"), {
    mode: "full",
    heading: null,
    storage,
    pageHref: "../cloud-storage/",
    onConfigured: () => {
      store.reconnect();
      renderTokenList();
    },
  });

  state.tokens = readTokens(storage);
  renderTokenNotice();
  showView(state.view);
  applyAutoRefresh();
  if (state.tokens.length > 0) connectAll();
}

start();
