// The cloud storage settings, as one component any page mounts.
//
// Two modes. **Full** is the whole thing: the sync badge, the token guide
// (written once, here, and filled from `cloudPermissions.js`), the token,
// the repository, the three checks, every document this browser or the cloud
// holds with the question when the two copies differ, export and import.
// **Compact** is one line for a project's own settings: the badge, where the
// data goes, and a link to the full page.
//
// It is DOM glue, exempt from unit tests (root ADR 0012), so it decides
// nothing: every rule it applies is a call into a pure module. Nothing that
// came from GitHub reaches the page through `innerHTML`; every text goes
// through `textContent`.
//
// It also exports `askCopyQuestion`, the dialog a project shows when its store
// meets two copies for the first time (root ADR 0016).

import { DATA_FOLDER, DEFAULT_REPO_NAME, browserStorage, documentPath, forgetToken, listMirrors, mirrorKey, newRepoUrl, readRepo, readToken, repoUrl, saveRepo, saveToken, isReconciled, markReconciled } from "./cloudSettings.js";
import { REQUIRED_PERMISSIONS, newPermissionsSince, tokenNeedsUpdate } from "./cloudPermissions.js";
import { describeFailure, describeSync } from "./cloudMessages.js";
import { cloudConfiguration, runConnectionChecks } from "./cloudStore.js";
import { fetchFile, fetchFolder, fetchViewer, saveFile } from "./cloudGateway.js";
import { migrate, parseDocument, recordCount, serializeDocument } from "./envelope.js";
import { mergeDocuments, planSave, planText } from "./merge.js";
import { ANSWERS, applyAnswer, describeCopies } from "./reconcile.js";
import { bundleFileName, encodeBundle, readBundle } from "./exportBundle.js";
import { readJson, writeJson } from "./localStore.js";

const isoNow = () => new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Small builders                                                             */
/* -------------------------------------------------------------------------- */

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const node = el("button", `cs-button ${className}`.trim(), label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function link(href, text, className = "") {
  const node = el("a", className, text);
  node.href = href;
  node.target = "_blank";
  node.rel = "noopener";
  return node;
}

function badge(sync) {
  const node = el("span", "cs-badge", sync.label);
  node.dataset.state = sync.state;
  return node;
}

function paintBadge(node, sync) {
  node.textContent = sync.label;
  node.dataset.state = sync.state;
}

function checkRow({ label, ok, detail }) {
  const row = el("li", "cs-check");
  row.dataset.ok = String(ok);
  const mark = el("span", "cs-badge", ok ? "Done" : "Fix");
  mark.dataset.state = ok ? "ok" : "broken";
  const body = el("div");
  body.append(el("p", "cs-check-label", label));
  if (detail) body.append(el("p", "cs-check-detail", detail));
  row.append(mark, body);
  return row;
}

/** The two copies of one document, as the table describes them. */
function describeCopy(document) {
  if (!document) return "nothing";
  const count = recordCount(document);
  const when = typeof document.updatedAt === "string" ? new Date(document.updatedAt) : null;
  const day = when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString() : "";
  return `${count} ${count === 1 ? "record" : "records"}${day ? `, ${day}` : ""}`;
}

const SITUATION_WORDS = {
  synced: "In sync",
  none: "Empty",
  "local-only": "This device only",
  "cloud-only": "Cloud only",
  same: "Same on both",
  ask: "Both differ: choose",
};

/* -------------------------------------------------------------------------- */
/* The token guide, written once                                              */
/* -------------------------------------------------------------------------- */

function step(label, ...body) {
  const row = el("li", "cs-step");
  row.append(el("p", "cs-step-label", label));
  const content = el("div", "cs-step-body");
  content.append(...body);
  row.append(content);
  return row;
}

function buildTokenGuide(repoName) {
  const wrap = el("div", "cs-section");
  const open = el("p");
  open.append(link("https://github.com/settings/personal-access-tokens/new", "Open GitHub's token form", "cs-button"));
  wrap.append(open);

  const permissions = el("ul", "cs-list");
  for (const one of REQUIRED_PERMISSIONS) {
    const row = el("li");
    const name = el("strong", "", `${one.name}: ${one.level}`);
    row.append(name, document.createTextNode(`, for ${one.why}`));
    permissions.append(row);
  }

  const repositoryBody = el("p");
  repositoryBody.append(
    document.createTextNode("Choose "),
    el("strong", "", "Only select repositories"),
    document.createTextNode(`, then select the data repository, ${repoName}. `),
  );
  const callout = el("p", "cs-callout");
  callout.append(el("strong", "", "This is the step people skip. "), document.createTextNode("A token that does not list the repository can read your account and cannot save a single thing."));

  const steps = el("ol", "cs-steps");
  steps.append(
    step("Resource owner", el("p", "", "Your own account. The data repository lives there.")),
    step("Repository access", repositoryBody, callout),
    step("Repository permissions", el("p", "", "Set these two. Leave every other permission alone."), permissions),
    step("Expiration", el("p", "", "Pick a date. 90 days is a good default: a token that never expires is one you cannot lose track of.")),
  );
  wrap.append(steps);
  return wrap;
}

/* -------------------------------------------------------------------------- */
/* The warning before the token is shown                                      */
/* -------------------------------------------------------------------------- */

/** One warning per visit. Repeating it trains the reader to click it away (github-work-board ADR 0015). */
let warningRead = false;

function askBeforeShowing(run) {
  if (warningRead) return run();
  const dialog = el("dialog", "cs-dialog cs-panel");
  dialog.append(el("h3", "", "This is the whole token"));
  dialog.append(
    el(
      "p",
      "cs-help",
      "A token is a password. Whoever holds this one can read and write every repository you listed, until the day it expires. GitHub shows a token once and never again, so this copy is the only one left.",
    ),
  );
  const list = el("ul", "cs-list");
  list.append(
    el("li", "", "Keep it where you keep passwords. Never put it in a chat, an issue, or a screenshot."),
    el("li", "", "Every app on this computer can read your clipboard, and Windows keeps a history of it."),
  );
  dialog.append(list);
  const row = el("p", "cs-row");
  row.append(
    button("Cancel", "", () => dialog.close()),
    button("I understand, continue", "cs-button-primary", () => {
      warningRead = true;
      dialog.close();
      run();
    }),
  );
  dialog.append(row);
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

async function copyToClipboard(text, node, label, whenRefused) {
  try {
    await navigator.clipboard.writeText(text);
    node.textContent = "Copied";
    setTimeout(() => {
      node.textContent = label;
    }, 1500);
  } catch {
    whenRefused();
  }
}

/* -------------------------------------------------------------------------- */
/* The question                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Show the reader the two copies of one document and take their answer.
 * Wire it as a store's `onQuestion`.
 */
export function askCopyQuestion({ project, file, local, cloud, answer }) {
  const dialog = el("dialog", "cs-dialog cs-panel");
  dialog.append(el("h3", "", `Two copies of ${project}`));
  dialog.append(
    el(
      "p",
      "cs-help",
      `This device holds ${describeCopy(local)} for ${file}, and the cloud holds ${describeCopy(cloud)}. They differ. Choose what to keep; the question is asked once on this device.`,
    ),
  );
  const answers = el("div", "cs-answers");
  for (const one of ANSWERS) {
    const choice = button("", `cs-answer ${one.id === "merge" ? "cs-button-primary" : ""}`, () => {
      dialog.close();
      answer(one.id);
    });
    choice.append(el("span", "", one.label), el("small", "", one.detail));
    answers.append(choice);
  }
  dialog.append(answers);
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

/* -------------------------------------------------------------------------- */
/* The panel                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mount the settings into a host element.
 *
 * @param mode "full" or "compact"
 * @param pageHref where the full page is, for the compact mode's link
 * @param onConfigured called after the token or the repository changed, so a
 *   project can `store.reconnect()`
 * @returns {{refresh: () => Promise<void>}}
 */
export function mountCloudSettings(host, { mode = "full", storage = browserStorage(), pageHref = "../cloud-storage/", onConfigured = () => {} } = {}) {
  host.classList.add("cs-panel");
  const state = { rows: [], login: "", asked: false, checking: null };

  if (mode === "compact") return mountCompact(host, { storage, pageHref, state });
  return mountFull(host, { storage, state, onConfigured });
}

async function runChecks(storage, state) {
  const config = cloudConfiguration(storage);
  state.asked = false;
  state.rows = [];
  if (!config) {
    state.asked = true;
    return null;
  }
  const result = await runConnectionChecks(config, storage);
  state.rows = result.rows;
  state.login = result.login;
  state.asked = true;
  return result;
}

function syncNow(storage, state) {
  return describeSync(state.rows, { configured: Boolean(cloudConfiguration(storage)), asked: state.asked });
}

function mountCompact(host, { storage, pageHref, state }) {
  const row = el("div", "cs-compact");
  const mark = badge(syncNow(storage, state));
  const words = el("span", "cs-help", "");
  const more = el("a", "", "Cloud storage settings");
  more.href = pageHref;
  row.append(mark, words, more);
  host.replaceChildren(row);

  async function refresh() {
    paintBadge(mark, describeSync([], { configured: Boolean(cloudConfiguration(storage)), asked: false }));
    await runChecks(storage, state);
    const sync = syncNow(storage, state);
    paintBadge(mark, sync);
    words.textContent = sync.detail;
  }
  refresh();
  return { refresh };
}

function mountFull(host, { storage, state, onConfigured }) {
  const now = isoNow;

  // --- The badge ---
  const heading = el("div", "cs-heading");
  const mark = badge(describeSync([], { configured: Boolean(cloudConfiguration(storage)), asked: false }));
  heading.append(el("h3", "", "Cloud storage"), mark);
  const detail = el("p", "cs-help", "");
  const intro = el(
    "p",
    "cs-help",
    `Every project on this site that keeps your data can save it to one private GitHub repository you own, in a folder named ${DATA_FOLDER}, one sub-folder per project. Without it, each project keeps its data in this browser only.`,
  );

  // --- The token ---
  const tokenSection = el("section", "cs-section");
  const tokenStatus = el("p", "cs-status");

  // --- The repository ---
  const repoSection = el("section", "cs-section");
  repoSection.append(el("h4", "", "Data repository"));
  const repoHelp = el("p", "cs-help", "A private repository on your own account. It does not have to exist before you paste the token; create it with the link, then press Save and check.");
  const repoRow = el("div", "cs-row");
  const repoInput = el("input", "cs-input");
  repoInput.type = "text";
  repoInput.autocomplete = "off";
  repoInput.spellcheck = false;
  repoInput.setAttribute("aria-label", "Repository name, on your own account");
  repoInput.value = readRepo(storage)?.repo ?? DEFAULT_REPO_NAME;
  const createLink = link(newRepoUrl(repoInput.value), "Create it on GitHub", "cs-button");
  const openLink = link("#", "Open on GitHub", "cs-button");
  repoInput.addEventListener("input", () => {
    createLink.href = newRepoUrl(repoInput.value.trim() || DEFAULT_REPO_NAME);
  });
  const saveRepoButton = button("Save and check", "cs-button-primary", async () => {
    const token = readToken(storage);
    const name = repoInput.value.trim() || DEFAULT_REPO_NAME;
    if (!token) return;
    let login = token.login;
    if (!login) {
      const viewer = await fetchViewer(token.token);
      login = viewer.ok ? String(viewer.data?.login ?? "") : "";
    }
    if (!login) {
      tokenStatus.textContent = "The token did not answer. Check it first.";
      return;
    }
    saveRepo(storage, { owner: login, repo: name });
    await refresh();
    onConfigured();
  });
  repoRow.append(repoInput, saveRepoButton, createLink, openLink);
  repoSection.append(repoHelp, repoRow);

  // --- The checks ---
  const checksSection = el("section", "cs-section");
  checksSection.append(el("h4", "", "Checks"));
  const checks = el("ul", "cs-checks");
  checksSection.append(checks);

  // --- The documents ---
  const docsSection = el("section", "cs-section");
  docsSection.append(el("h4", "", "Your data, project by project"));
  docsSection.append(el("p", "cs-help", "Everything this browser holds, and everything the repository holds. When a project's data differs between the two, choose which to keep. Merge loses nothing."));
  const docsStatus = el("p", "cs-status");
  const allRow = el("div", "cs-row");
  const tableWrap = el("div", "cs-table-wrap");
  docsSection.append(allRow, tableWrap, docsStatus);

  // --- Export and import ---
  const fileSection = el("section", "cs-section");
  fileSection.append(el("h4", "", "Export and import"));
  fileSection.append(el("p", "cs-help", "Export saves one file with every document of every project, from the cloud when it is connected and from this browser when it is not. Import reads that file back and merges it in, so nothing is overwritten."));
  const fileRow = el("div", "cs-row");
  const fileStatus = el("p", "cs-status");
  const picker = el("input", "cs-visually-hidden");
  picker.type = "file";
  picker.accept = "application/json,.json";
  picker.setAttribute("aria-label", "Import an export file");
  fileRow.append(
    button("Export", "", () => exportAll()),
    button("Import", "", () => picker.click()),
    picker,
  );
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (file) importFile(file);
    picker.value = "";
  });
  fileSection.append(fileRow, fileStatus);

  host.replaceChildren(heading, detail, intro, tokenSection, repoSection, checksSection, docsSection, fileSection);

  /* ---- Token section, drawn from the saved state ---- */
  function renderToken() {
    const token = readToken(storage);
    tokenSection.replaceChildren(el("h4", "", "Token"));
    if (!token) {
      tokenSection.append(
        el("p", "cs-help", "A fine-grained personal access token from GitHub. It is kept in this browser and sent to api.github.com and nowhere else."),
        buildTokenGuide(repoInput.value.trim() || DEFAULT_REPO_NAME),
      );
      const row = el("div", "cs-row");
      const input = el("input", "cs-input");
      input.type = "password";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.placeholder = "github_pat_…";
      input.setAttribute("aria-label", "Paste the token");
      const connect = button("Save token and check", "cs-button-primary", async () => {
        const value = input.value.trim();
        if (value === "") return;
        connect.disabled = true;
        const viewer = await fetchViewer(value);
        if (!viewer.ok) {
          tokenStatus.textContent = describeFailure(viewer);
          connect.disabled = false;
          return;
        }
        const login = String(viewer.data?.login ?? "");
        saveToken(storage, { token: value, name: "", login, grantedPermissions: null });
        if (!readRepo(storage)) saveRepo(storage, { owner: login, repo: repoInput.value.trim() || DEFAULT_REPO_NAME });
        input.value = "";
        tokenStatus.textContent = "";
        await refresh();
        onConfigured();
      });
      row.append(input, connect);
      tokenSection.append(row, tokenStatus);
      return;
    }

    const who = el("p", "", "");
    who.append(document.createTextNode(token.login ? `Signed in as ${token.login}. ` : "Saved. "), el("span", "cs-help", "The token is kept in this browser and sent to api.github.com and nowhere else."));
    tokenSection.append(who);

    if (tokenNeedsUpdate(token.grantedPermissions)) {
      const missing = newPermissionsSince(token.grantedPermissions);
      const notice = el("p", "cs-callout", "");
      notice.append(
        el("strong", "", "This token needs an update. "),
        document.createTextNode(`Open it on GitHub and add: ${missing.map((one) => `${one.name}: ${one.level}`).join(", ")}. Then press Save and check.`),
      );
      tokenSection.append(notice);
    }

    const row = el("div", "cs-row");
    const shown = el("code", "cs-visually-hidden", "");
    const copy = button("Copy token", "", () =>
      askBeforeShowing(() =>
        copyToClipboard(token.token, copy, "Copy token", () => {
          shown.textContent = token.token;
          shown.className = "";
          tokenStatus.textContent = "This browser refused the clipboard. Select the text and copy it.";
        }),
      ),
    );
    let armed = false;
    const forget = button("Forget token", "cs-button-danger", () => {
      if (!armed) {
        armed = true;
        forget.textContent = "Really forget? Your local copies stay.";
        return;
      }
      forgetToken(storage);
      state.rows = [];
      renderToken();
      refresh();
      onConfigured();
    });
    row.append(copy, forget);
    tokenSection.append(row, shown, tokenStatus);
  }

  /* ---- Documents table ---- */
  async function renderDocuments() {
    const config = cloudConfiguration(storage);
    const local = new Map(listMirrors(storage).map((one) => [`${one.project}/${one.file}`, one]));
    const cloud = new Map();
    docsStatus.textContent = "";

    if (config && state.rows.every((one) => one.ok)) {
      const folders = await fetchFolder(config.token.token, config.repo, DATA_FOLDER);
      if (folders.ok) {
        for (const folder of folders.data.entries.filter((one) => one.type === "dir")) {
          const files = await fetchFolder(config.token.token, config.repo, `${DATA_FOLDER}/${folder.name}`);
          if (!files.ok) continue;
          for (const file of files.data.entries.filter((one) => one.type === "file" && one.name.endsWith(".json"))) {
            const read = await fetchFile(config.token.token, config.repo, `${DATA_FOLDER}/${folder.name}/${file.name}`);
            if (read.ok && !read.data.missing) {
              cloud.set(`${folder.name}/${file.name}`, { project: folder.name, file: file.name, document: parseDocument(read.data.text, [], now()), sha: read.data.sha });
            }
          }
        }
      } else {
        docsStatus.textContent = describeFailure(folders);
      }
    }

    const keys = [...new Set([...local.keys(), ...cloud.keys()])].sort();
    const table = el("table", "cs-table");
    const head = el("tr");
    for (const title of ["Project", "File", "This device", "Cloud", "State", ""]) head.append(el("th", "", title));
    const thead = el("thead");
    thead.append(head);
    const body = el("tbody");
    const asks = [];

    for (const key of keys) {
      const here = local.get(key)?.document ?? null;
      const there = cloud.get(key)?.document ?? null;
      const [project, file] = key.split("/");
      const situation = describeCopies({ local: here, cloud: there, reconciled: config ? isReconciled(storage, project, file) : false });
      const row = el("tr");
      row.append(el("td", "", project), el("td", "", file), el("td", "", describeCopy(here)), el("td", "", describeCopy(there)));
      const stateCell = el("td", "cs-copy-state", config ? SITUATION_WORDS[situation] : SITUATION_WORDS["local-only"]);
      const actions = el("td");
      const entry = { project, file, here, there, sha: cloud.get(key)?.sha ?? null };
      if (config && situation === "ask") {
        const answerCell = el("div", "cs-row");
        for (const one of ANSWERS) {
          answerCell.append(button(one.label, `cs-button-small ${one.id === "merge" ? "cs-button-primary" : ""}`, () => answerFor([entry], one.id)));
        }
        actions.append(answerCell);
        asks.push(entry);
      } else if (config && situation === "local-only") {
        // A project does this itself the next time it opens. The button is for
        // a reader who wants it done now, from here.
        actions.append(button("Send to the cloud", "cs-button-small", () => answerFor([entry], "keep-local")));
      } else if (config && situation === "cloud-only") {
        actions.append(button("Bring to this device", "cs-button-small", () => answerFor([entry], "use-cloud")));
      }
      row.append(stateCell, actions);
      body.append(row);
    }
    table.append(thead, body);
    tableWrap.replaceChildren(keys.length === 0 ? el("p", "cs-help", "No project has saved anything yet.") : table);

    allRow.replaceChildren();
    if (asks.length > 1) {
      allRow.append(el("span", "cs-help", `${asks.length} projects differ. For all of them:`));
      for (const one of ANSWERS) allRow.append(button(`${one.label}, for all`, `cs-button-small ${one.id === "merge" ? "cs-button-primary" : ""}`, () => answerFor(asks, one.id)));
    }
  }

  /** Apply one answer to a list of documents, writing each side that changes. */
  async function answerFor(list, answerId) {
    const config = cloudConfiguration(storage);
    if (!config) return;
    docsStatus.textContent = "Writing…";
    for (const { project, file, here, there, sha } of list) {
      const result = applyAnswer(answerId, { local: here, cloud: there, now: now() });
      if (result.writeLocal) writeJson(storage, mirrorKey(project, file), result.document);
      if (result.writeCloud) {
        const written = await saveFile(config.token.token, config.repo, documentPath(project, file), {
          text: serializeDocument(result.document),
          sha,
          message: `Update ${project}/${file} from the settings page (${now()})`,
        });
        if (!written.ok) {
          docsStatus.textContent = `${project}/${file}: ${describeFailure(written)}`;
          continue;
        }
      }
      markReconciled(storage, project, file, now());
    }
    const failed = docsStatus.textContent !== "Writing…" ? docsStatus.textContent : "";
    await renderDocuments();
    docsStatus.textContent = failed || "Done.";
    onConfigured();
  }

  /* ---- Export and import ---- */
  async function exportAll() {
    const config = cloudConfiguration(storage);
    const projects = {};
    const add = (project, file, document) => {
      projects[project] = projects[project] ?? {};
      projects[project][file] = document;
    };
    for (const one of listMirrors(storage)) add(one.project, one.file, migrate(one.document, [], now()));
    if (config && state.rows.every((one) => one.ok)) {
      const folders = await fetchFolder(config.token.token, config.repo, DATA_FOLDER);
      for (const folder of folders.ok ? folders.data.entries.filter((one) => one.type === "dir") : []) {
        const files = await fetchFolder(config.token.token, config.repo, `${DATA_FOLDER}/${folder.name}`);
        for (const file of files.ok ? files.data.entries.filter((one) => one.type === "file") : []) {
          const read = await fetchFile(config.token.token, config.repo, `${DATA_FOLDER}/${folder.name}/${file.name}`);
          if (read.ok && !read.data.missing) {
            const document = parseDocument(read.data.text, [], now());
            add(folder.name, file.name, mergeDocuments(projects[folder.name]?.[file.name] ?? null, document, now()));
          }
        }
      }
    }
    const text = encodeBundle({ exportedAt: now(), projects });
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = el("a");
    anchor.href = url;
    anchor.download = bundleFileName(new Date());
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const count = Object.values(projects).reduce((sum, files) => sum + Object.keys(files).length, 0);
    fileStatus.textContent = `Saved ${count} ${count === 1 ? "document" : "documents"} to ${anchor.download}.`;
  }

  async function importFile(file) {
    const read = readBundle(await file.text());
    if (!read.ok) {
      fileStatus.textContent = read.message;
      return;
    }
    const config = cloudConfiguration(storage);
    let merged = 0;
    for (const [project, files] of Object.entries(read.projects)) {
      for (const [name, document] of Object.entries(files)) {
        const key = mirrorKey(project, name);
        const local = mergeDocuments(readJson(storage, key, null), document, now());
        writeJson(storage, key, local);
        if (config && state.rows.every((one) => one.ok)) {
          const path = documentPath(project, name);
          const fresh = await fetchFile(config.token.token, config.repo, path);
          if (fresh.ok) {
            const remote = fresh.data.missing ? null : parseDocument(fresh.data.text, [], now());
            const plan = planSave({ local, remote, remoteSha: fresh.data.sha, now: now() });
            if (plan.action !== "skip") {
              await saveFile(config.token.token, config.repo, path, { text: planText(plan), sha: plan.sha, message: `Import ${project}/${name} (${now()})` });
            }
            writeJson(storage, key, plan.document);
            markReconciled(storage, project, name, now());
          }
        }
        merged += 1;
      }
    }
    fileStatus.textContent = `Merged ${merged} ${merged === 1 ? "document" : "documents"} from ${file.name}.`;
    await renderDocuments();
    onConfigured();
  }

  /* ---- Refresh everything ---- */
  async function refresh() {
    renderToken();
    const config = cloudConfiguration(storage);
    paintBadge(mark, describeSync([], { configured: Boolean(config), asked: false }));
    openLink.hidden = !config;
    if (config) openLink.href = repoUrl(config.repo);
    saveRepoButton.disabled = !readToken(storage);
    checks.replaceChildren();
    const result = await runChecks(storage, state);
    const sync = syncNow(storage, state);
    paintBadge(mark, sync);
    detail.textContent = sync.detail;
    checks.replaceChildren(...(result ? state.rows.map(checkRow) : [checkRow({ label: "Cloud storage is not set up", ok: false, detail: "Paste a token below to start." })]));
    renderToken();
    await renderDocuments();
  }

  refresh();
  return { refresh };
}
