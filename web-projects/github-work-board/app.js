// The page. It listens, calls the modules, and builds elements. It holds no
// logic worth a test: anything that could be wrong belongs in a pure module.
//
// Two rules hold here and `invariants.test.js` guards both:
//   - Nothing reaches the screen through `innerHTML` except the deploy line,
//     which carries its own escaper. Issue titles come from other people.
//   - Storage is only ever touched through `settings.js`.

import { DOCUMENT_PATH, emptyDocument, parseDocument, readNote, writeNote } from "./boardDocument.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { fetchAssignedIssues, fetchBoardFile, fetchRepository, fetchViewer, saveBoardFile } from "./gateway.js";
import { describeFailure } from "./githubErrors.js";
import {
  CONNECTION_CHECKS,
  REQUIRED_PERMISSIONS,
  newPermissionsSince,
  permissionsFingerprint,
  tokenNeedsUpdate,
} from "./permissions.js";
import { DEFAULT_SORT_ID, SORT_OPTIONS, sortWorkItems } from "./sorting.js";
import { buildSearch, readStateFromSearch } from "./urlState.js";
import { countByKind, normalizeWorkItems } from "./workItems.js";
import { escapeHtml, say } from "./messages.js";
import {
  DEFAULT_DATA_REPO_NAME,
  browserStorage,
  forgetToken,
  readDataRepo,
  readGrantedPermissions,
  readToken,
  saveDataRepo,
  saveGrantedPermissions,
  saveToken,
} from "./settings.js";
import { planSave, planText } from "./sync.js";

const SAVE_DELAY_MS = 1200;
const PROJECT_PATH = "web-projects/github-work-board";

const storage = browserStorage();
const element = (id) => document.getElementById(id);

/** Everything the page holds between events. The board document is the only part that is written back. */
const state = {
  token: null,
  owner: null,
  repo: null,
  board: emptyDocument(new Date().toISOString()),
  remoteSha: null,
  remoteText: null,
  saveTimer: null,
  items: [],
  sortId: DEFAULT_SORT_ID,
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
 * Tell the reader their token is behind, and name exactly what to add.
 *
 * This is what makes the single permission list worth having: the list grows in
 * `permissions.js`, and every reader who already connected is told, rather than
 * meeting a 403 months later with no idea which box to tick (ADR 0005).
 */
function renderTokenNotice() {
  const granted = readGrantedPermissions(storage);
  const notice = element("token-outdated");
  if (!tokenNeedsUpdate(granted)) {
    notice.hidden = true;
    return;
  }
  const missing = newPermissionsSince(granted);
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

/**
 * Put the list on the screen in the chosen order.
 *
 * Called on load, when the order changes, and after a note is written, because
 * "ones you noted first" moves an item the moment the first character lands.
 */
function renderBoard() {
  const hasNote = (key) => readNote(state.board, key).trim() !== "";
  const ordered = sortWorkItems(state.items, state.sortId, hasNote);
  element("issues").replaceChildren(...ordered.map(buildWorkItemCard));

  const { issues, pullRequests } = countByKind(state.items);
  const parts = [];
  if (issues > 0) parts.push(`${issues} ${issues === 1 ? "issue" : "issues"}`);
  if (pullRequests > 0) parts.push(`${pullRequests} ${pullRequests === 1 ? "pull request" : "pull requests"}`);
  element("board-counts").textContent = parts.join(" and ");
}

/** Keep the address bar showing the chosen order, so a reload and a shared link both keep it. */
function rememberSortInUrl() {
  const search = buildSearch({ sortId: state.sortId });
  history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
}

/* -------------------------------------------------------------------------- */
/* Connecting                                                                 */
/* -------------------------------------------------------------------------- */

function showChecks(rows) {
  const list = element("checks");
  list.replaceChildren(...rows.map(buildCheckRow));
  element("connection").hidden = false;
}

/**
 * Prove the token works, one call per permission, and say which one is missing
 * when a call fails. Stops at the first failure: a later check would fail for
 * the same reason and bury the one thing the reader has to fix.
 */
async function connect(token, repoName) {
  const rows = [];
  const fail = (check, failure) => {
    rows.push({ label: check.label, ok: false, detail: describeFailure({ ...failure, need: check.need }) });
    showChecks(rows);
  };

  const [identity, issues, board] = CONNECTION_CHECKS;

  const viewer = await fetchViewer(token);
  if (!viewer.ok) return fail(identity, viewer);
  const owner = viewer.data?.login ?? "";
  rows.push({ label: identity.label, ok: true, detail: `Signed in as ${owner}.` });

  const repository = await fetchRepository(token, { owner, repo: repoName });
  if (!repository.ok) {
    return fail(board, {
      ...repository,
      message:
        repository.status === 404
          ? `No repository called ${owner}/${repoName}. Create it as private, then connect again.`
          : repository.message,
    });
  }
  if (repository.data?.private === false) {
    rows.push({
      label: board.label,
      ok: false,
      detail: `${owner}/${repoName} is public. Your notes would be readable by anyone. Make it private first.`,
    });
    return showChecks(rows);
  }

  const file = await fetchBoardFile(token, { owner, repo: repoName });
  if (!file.ok) return fail(board, file);
  rows.push({
    label: board.label,
    ok: true,
    detail: file.data.missing
      ? `${owner}/${repoName} is ready. ${DOCUMENT_PATH} is written on your first note.`
      : `Read ${DOCUMENT_PATH} from ${owner}/${repoName}.`,
  });

  const answer = await fetchAssignedIssues(token);
  if (!answer.ok) return fail(issues, answer);
  const list = normalizeWorkItems(answer.data);
  const counted = countByKind(list);
  rows.push({
    label: issues.label,
    ok: true,
    detail: `${counted.issues} open issues and ${counted.pullRequests} pull requests are assigned to you.`,
  });
  showChecks(rows);

  // Everything worked, so this is the point where the settings are worth keeping.
  state.token = token;
  state.owner = owner;
  state.repo = repoName;
  state.remoteSha = file.data.sha;
  state.remoteText = file.data.text;
  state.board = file.data.missing
    ? emptyDocument(new Date().toISOString())
    : parseDocument(file.data.text, new Date().toISOString());
  saveToken(storage, token);
  saveDataRepo(storage, { owner, repo: repoName });
  // Every check passed, so this token really does carry the access the board
  // asks for today. That is what the fingerprint records.
  saveGrantedPermissions(storage, permissionsFingerprint());
  element("token-outdated").hidden = true;

  state.items = list;
  element("setup").hidden = true;
  element("board").hidden = false;
  renderBoard();
  setStatus(list.length === 0 ? "Nothing is assigned to you right now." : "Notes save by themselves.");
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
 * so the whole thing runs once more against the newer file.
 */
async function save(attempt = 0) {
  if (!state.token) return;

  const fresh = await fetchBoardFile(state.token, { owner: state.owner, repo: state.repo });
  if (!fresh.ok) return setStatus(describeFailure(fresh));
  const now = new Date().toISOString();
  const remote = fresh.data.missing ? null : parseDocument(fresh.data.text, now);

  const plan = planSave({ local: state.board, remote, remoteSha: fresh.data.sha, now });
  state.board = plan.document;
  if (plan.action === "skip") return setStatus("Saved.");

  const written = await saveBoardFile(state.token, {
    owner: state.owner,
    repo: state.repo,
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
  forgetToken(storage);
  clearTimeout(state.saveTimer);
  state.token = null;
  state.board = emptyDocument(new Date().toISOString());
  state.items = [];
  element("token").value = "";
  element("setup").hidden = false;
  element("board").hidden = true;
  element("connection").hidden = true;
  renderTokenNotice();
}

function start() {
  renderDeployLine(element("deploy-line"), readStamp(document), "en", say, escapeHtml, PROJECT_PATH);
  element("permissions").replaceChildren(...REQUIRED_PERMISSIONS.map(buildPermissionRow));
  renderTokenNotice();

  state.sortId = readStateFromSearch(location.search).sortId;
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
    rememberSortInUrl();
    renderBoard();
  });

  const saved = readDataRepo(storage);
  const repoField = element("repo-name");
  repoField.value = saved?.repo ?? DEFAULT_DATA_REPO_NAME;
  element("create-repo-link").href = `https://github.com/new?name=${encodeURIComponent(repoField.value)}&visibility=private`;
  repoField.addEventListener("input", () => {
    element("create-repo-link").href = `https://github.com/new?name=${encodeURIComponent(repoField.value.trim())}&visibility=private`;
  });

  element("connect").addEventListener("click", () => {
    const typed = element("token").value.trim();
    const token = typed === "" ? readToken(storage) : typed;
    if (!token) return showChecks([{ label: "Paste a token", ok: false, detail: "The token box is empty." }]);
    element("token").value = "";
    connect(token, repoField.value.trim() || DEFAULT_DATA_REPO_NAME);
  });

  element("sign-out").addEventListener("click", signOut);

  // A token saved on an earlier visit means the reader is already set up.
  const token = readToken(storage);
  if (token) connect(token, repoField.value.trim() || DEFAULT_DATA_REPO_NAME);
}

start();
