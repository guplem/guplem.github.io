// The page. It listens, calls the modules, and builds elements. It holds no
// logic worth a test: anything that could be wrong belongs in a pure module.
//
// Two rules hold here and `invariants.test.js` guards both:
//   - Nothing reaches the screen through `innerHTML` except the deploy line,
//     which carries its own escaper. Titles come from other people.
//   - Storage is only ever touched through `settings.js`.
//
// The board reads from every saved token and merges the answers, because a
// fine-grained token belongs to one owner and most people's work is spread
// across their own account and one or more organisations (ADR 0007).

import { DOCUMENT_PATH, emptyDocument, parseDocument, readNote, writeNote } from "./boardDocument.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import {
  fetchAssignedIssues,
  fetchBoardFile,
  fetchRepository,
  fetchViewer,
  saveBoardFile,
} from "./gateway.js";
import {
  DEFAULT_KIND,
  KIND_FILTERS,
  activeFilterCount,
  availableLabels,
  availableRepositories,
  filterWorkItems,
  toggleInList,
} from "./filters.js";
import { describeFailure } from "./githubErrors.js";
import { escapeHtml, say, sayEmptyBoard } from "./messages.js";
import {
  CONNECTION_CHECKS,
  REQUIRED_PERMISSIONS,
  newPermissionsSince,
  permissionsFingerprint,
  tokenNeedsUpdate,
} from "./permissions.js";
import {
  DEFAULT_DATA_REPO_NAME,
  addToken,
  boardWritingToken,
  browserStorage,
  forgetAllTokens,
  readDataRepo,
  readLastCounts,
  readTokens,
  removeToken,
  renameToken,
  saveDataRepo,
  saveLastCounts,
  saveTokens,
  updateToken,
} from "./settings.js";
import { skeletonCount } from "./skeletons.js";
import { DEFAULT_SORT_ID, SORT_OPTIONS, sortWorkItems } from "./sorting.js";
import { planSave, planText } from "./sync.js";
import { DEFAULT_VIEW, buildSearch, readStateFromSearch } from "./urlState.js";
import { describeTokenReach, suggestedTokenName } from "./tokenIdentity.js";
import { countByKind, normalizeWorkItems, ownersOf } from "./workItems.js";

const SAVE_DELAY_MS = 1200;
const PROJECT_PATH = "web-projects/github-work-board";

const storage = browserStorage();
const element = (id) => document.getElementById(id);
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `t${Date.now()}${Math.random()}`);

/** Everything the page holds between events. The board document is the only part written back. */
const state = {
  tokens: [],
  login: null,
  repoName: DEFAULT_DATA_REPO_NAME,
  board: emptyDocument(new Date().toISOString()),
  remoteSha: null,
  saveTimer: null,
  items: [],
  sortId: DEFAULT_SORT_ID,
  view: DEFAULT_VIEW,
  kind: DEFAULT_KIND,
  repositories: [],
  labels: [],
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
 * screen and in Settings. Writing it twice is how the two copies drift, which is
 * the same failure ADR 0005 removed from the permission list itself.
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

function buildWorkItemCard(item) {
  const card = document.createElement("li");
  card.className = "issue";

  const heading = document.createElement("p");
  heading.className = "issue-where";

  const kind = document.createElement("span");
  kind.className = item.kind === "pull-request" ? "badge badge-pull" : "badge badge-issue";
  kind.textContent = item.kind === "pull-request" ? "PR" : "Issue";
  heading.append(kind);

  if (item.isDraft) {
    const draft = document.createElement("span");
    draft.className = "badge badge-outline";
    draft.textContent = "Draft";
    heading.append(draft);
  }

  const where = document.createElement("span");
  where.textContent = `${item.repository} #${item.number}`;
  heading.append(where);
  card.append(heading);

  const link = document.createElement("a");
  link.className = "issue-title";
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = item.title;
  card.append(link);

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

  const note = document.createElement("textarea");
  note.className = "input note";
  note.rows = 2;
  note.placeholder = "A note only you can see";
  note.value = readNote(state.board, item.key);
  note.addEventListener("input", () => {
    state.board = writeNote(state.board, item.key, note.value, new Date().toISOString());
    scheduleSave();
  });
  card.append(note);

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
  row.append(lines, buildSkeletonBar("5.5rem", "skeleton-button"));
  return row;
}

/** A placeholder in the shape of a connection check: a badge, then two lines. */
function buildSkeletonCheckRow() {
  const row = document.createElement("li");
  row.className = "check skeleton-card";
  const lines = document.createElement("div");
  lines.className = "token-lines";
  lines.append(buildSkeletonBar("13rem", "skeleton-title"), buildSkeletonBar("80%"));
  row.append(buildSkeletonBar("2.75rem", "skeleton-pill"), lines);
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
  const issues = element("issues");
  issues.setAttribute("aria-busy", "true");
  issues.replaceChildren(...times(skeletonCount(last.items), buildSkeletonCard));
  element("board-counts").replaceChildren(buildSkeletonBar("9rem"));
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
  element("checks").replaceChildren(...times(CONNECTION_CHECKS.length, buildSkeletonCheckRow));
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

  row.append(reach, drop);
  return row;
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Put the list on the screen in the chosen order.
 *
 * Called on load, when the order changes, and after a note is written, because
 * "ones you noted first" moves an item the moment the first character lands.
 */
function renderBoard() {
  const hasNote = (key) => readNote(state.board, key).trim() !== "";
  const visible = filterWorkItems(state.items, state);
  const ordered = sortWorkItems(visible, state.sortId, hasNote);
  element("issues").replaceChildren(...ordered.map(buildWorkItemCard));

  const { issues, pullRequests } = countByKind(visible);
  const parts = [];
  if (issues > 0) parts.push(`${issues} ${issues === 1 ? "issue" : "issues"}`);
  if (pullRequests > 0) parts.push(`${pullRequests} ${pullRequests === 1 ? "pull request" : "pull requests"}`);
  const narrowed = activeFilterCount(state) > 0;
  element("board-counts").textContent = narrowed
    ? `${parts.join(" and ") || "Nothing"} · ${visible.length} of ${state.items.length}`
    : parts.join(" and ");

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

function renderTokenList() {
  element("tokens").replaceChildren(...state.tokens.map((entry, index) => buildTokenRow(entry, index)));
  element("settings-repo-name").value = state.repoName;
}

/**
 * Show one screen.
 *
 * Which screen is open lives in the address bar (root ADR 0006), so a reload
 * comes back to the same place. Settings needs a token to manage, so before the
 * first connection the welcome screen is the only screen there is.
 */
function showView(view) {
  const connected = state.tokens.length > 0;
  state.view = connected ? view : DEFAULT_VIEW;

  // One control, in a header that never scrolls away. The settings screen is
  // taller than a window, so an exit that sits at the top of it is an exit the
  // reader cannot reach once they scroll (ADR 0008).
  const toggle = element("view-toggle");
  toggle.hidden = !connected;
  toggle.textContent = state.view === "settings" ? "Back to the board" : "Settings";
  element("setup").hidden = connected;
  element("board").hidden = !connected || state.view === "settings";
  element("settings-view").hidden = state.view !== "settings";
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

function showChecks(rows) {
  element("checks").replaceChildren(...rows.map(buildCheckRow));
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
  const [identity, work, board] = CONNECTION_CHECKS;
  let updated = { ...entry, owners: [], itemCount: 0, canWriteBoard: false };

  const viewer = await fetchViewer(entry.token);
  if (!viewer.ok) {
    rows.push({ label: identity.label, ok: false, detail: describeFailure({ ...viewer, need: identity.need }) });
    return { entry: updated, raw: [], rows };
  }
  const login = viewer.data?.login ?? "";
  state.login = state.login ?? login;
  rows.push({ label: identity.label, ok: true, detail: `Signed in as ${login}.` });

  const answer = await fetchAssignedIssues(entry.token);
  if (!answer.ok) {
    rows.push({ label: work.label, ok: false, detail: describeFailure({ ...answer, need: work.need }) });
    return { entry: updated, raw: [], rows };
  }
  const raw = Array.isArray(answer.data) ? answer.data : [];
  const items = normalizeWorkItems(raw);
  const counted = countByKind(items);

  // Where this token found work, which is the suggestion for its name and the
  // one thing about its reach the board can state honestly (ADR 0007).
  const owners = ownersOf(items.map((item) => item.repository));
  updated = { ...updated, owners, itemCount: items.length };
  rows.push({
    label: work.label,
    ok: true,
    detail:
      items.length === 0
        ? "This token reached no repository with work assigned to you."
        : `${counted.issues} issues and ${counted.pullRequests} pull requests, in ${owners.join(", ")}.`,
  });

  // Only one token can reach the notes repository, and it is the one whose
  // owner holds it. A token that cannot is not broken; it just is not that one.
  const repository = await fetchRepository(entry.token, { owner: login, repo: state.repoName });
  if (repository.ok) {
    if (repository.data?.private === false) {
      rows.push({
        label: board.label,
        ok: false,
        detail: `${login}/${state.repoName} is public. Your notes would be readable by anyone. Make it private first.`,
      });
    } else {
      const file = await fetchBoardFile(entry.token, { owner: login, repo: state.repoName });
      if (file.ok) {
        updated = { ...updated, canWriteBoard: true, grantedPermissions: permissionsFingerprint() };
        state.remoteSha = file.data.sha;
        state.board = file.data.missing
          ? emptyDocument(new Date().toISOString())
          : parseDocument(file.data.text, new Date().toISOString());
        saveDataRepo(storage, { owner: login, repo: state.repoName });
        rows.push({
          label: board.label,
          ok: true,
          detail: file.data.missing
            ? `${login}/${state.repoName} is ready. ${DOCUMENT_PATH} is written on your first note.`
            : `Read ${DOCUMENT_PATH} from ${login}/${state.repoName}.`,
        });
      } else {
        rows.push({ label: board.label, ok: false, detail: describeFailure({ ...file, need: board.need }) });
      }
    }
  }

  if (updated.grantedPermissions === null) updated = { ...updated, grantedPermissions: permissionsFingerprint() };
  return { entry: updated, raw, rows };
}

/** Ask every saved token, merge what they return, and show the board. */
async function connectAll() {
  if (state.tokens.length === 0) return;
  state.loading = true;
  setStatus("Reading GitHub...");
  showView(state.view);
  renderLoading();

  const rows = [];
  const everything = [];
  for (const entry of state.tokens) {
    const result = await inspectToken(entry);
    state.tokens = updateToken(state.tokens, entry.id, result.entry);
    everything.push(...result.raw);
    rows.push(...result.rows);
  }

  saveTokens(storage, state.tokens);
  // Merging here, not per token, is what removes an item two tokens both see.
  state.items = normalizeWorkItems(everything);

  state.loading = false;
  element("issues").removeAttribute("aria-busy");
  showChecks(rows);
  renderTokenList();
  renderTokenNotice();
  renderFilters();
  renderBoard();
  showView(state.view);
  saveLastCounts(storage, {
    items: state.items.length,
    repositories: availableRepositories(state.items).length,
    labels: availableLabels(state.items).length,
    tokens: state.tokens.length,
  });
  setStatus(boardWritingToken(state.tokens) ? "Notes save by themselves." : "No token can write your notes file.");
}

/* -------------------------------------------------------------------------- */
/* Saving                                                                     */
/* -------------------------------------------------------------------------- */

function scheduleSave() {
  setStatus("Saving...");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    save().catch(() => setStatus("The save did not finish. It will try again on your next change."));
  }, SAVE_DELAY_MS);
}

/**
 * Save the notes, re-reading first so another device's work is merged rather
 * than overwritten. A 409 means someone saved between the read and the write,
 * so the whole thing runs once more against the newer file (ADR 0002).
 */
async function save(attempt = 0) {
  const writer = boardWritingToken(state.tokens);
  const repo = readDataRepo(storage);
  if (!writer || !repo) return setStatus("No token can write your notes file.");

  const fresh = await fetchBoardFile(writer.token, repo);
  if (!fresh.ok) return setStatus(describeFailure(fresh));
  const now = new Date().toISOString();
  const remote = fresh.data.missing ? null : parseDocument(fresh.data.text, now);

  const plan = planSave({ local: state.board, remote, remoteSha: fresh.data.sha, now });
  state.board = plan.document;
  if (plan.action === "skip") return setStatus("Saved.");

  const written = await saveBoardFile(writer.token, {
    ...repo,
    text: planText(plan),
    sha: plan.sha,
    message: `Update board notes (${now})`,
  });
  if (written.ok) {
    state.remoteSha = written.data?.content?.sha ?? null;
    return setStatus("Saved.");
  }
  if (written.status === 409 && attempt === 0) return save(attempt + 1);
  setStatus(describeFailure(written));
}

/* -------------------------------------------------------------------------- */
/* Start-up                                                                   */
/* -------------------------------------------------------------------------- */

function signOut() {
  forgetAllTokens(storage);
  clearTimeout(state.saveTimer);
  state.tokens = [];
  state.items = [];
  state.login = null;
  state.board = emptyDocument(new Date().toISOString());
  element("token").value = "";
  showView(DEFAULT_VIEW);
  renderTokenNotice();
}

function connectPastedToken(field) {
  const pasted = field.value.trim();
  if (pasted === "") {
    return showChecks([{ label: "Paste a token", ok: false, detail: "The token box is empty." }]);
  }
  field.value = "";
  const grown = addToken(state.tokens, { id: newId(), token: pasted });
  if (grown.length === state.tokens.length) {
    return showChecks([{ label: "Already added", ok: false, detail: "The board is already using that token." }]);
  }
  state.tokens = grown;
  saveTokens(storage, state.tokens);
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

  const saved = readDataRepo(storage);
  const repoField = element("repo-name");
  repoField.value = saved?.repo ?? DEFAULT_DATA_REPO_NAME;
  state.repoName = repoField.value;
  const createLink = () => {
    element("create-repo-link").href =
      `https://github.com/new?name=${encodeURIComponent(state.repoName)}&visibility=private`;
  };
  createLink();
  repoField.addEventListener("input", () => {
    state.repoName = repoField.value.trim() || DEFAULT_DATA_REPO_NAME;
    createLink();
  });

  element("connect").addEventListener("click", () => connectPastedToken(element("token")));
  element("add-token").addEventListener("click", () => connectPastedToken(element("another-token")));
  element("sign-out").addEventListener("click", signOut);
  // The header's line appears only once something has scrolled behind it, so a
  // page that has not moved keeps a clean top edge.
  const masthead = document.querySelector(".masthead");
  const markStuck = () => masthead.classList.toggle("is-stuck", window.scrollY > 4);
  markStuck();
  window.addEventListener("scroll", markStuck, { passive: true });

  element("view-toggle").addEventListener("click", () =>
    showView(state.view === "settings" ? "board" : "settings"),
  );
  element("empty-open-settings").addEventListener("click", () => showView("settings"));
  element("clear-filters").addEventListener("click", clearFilters);
  element("save-repo-name").addEventListener("click", () => {
    state.repoName = element("settings-repo-name").value.trim() || DEFAULT_DATA_REPO_NAME;
    element("settings-repo-name").value = state.repoName;
    connectAll();
  });

  state.tokens = readTokens(storage);
  renderTokenNotice();
  showView(state.view);
  if (state.tokens.length > 0) connectAll();
}

start();
