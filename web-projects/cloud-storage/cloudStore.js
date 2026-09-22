// The store a project opens: one document, mirrored here, saved to the cloud.
//
// This is glue, and it is thin on purpose: every decision it makes is a call
// into a pure, tested module. It holds the current document, writes the local
// mirror on every change, and, when cloud storage is configured, reads the
// cloud copy on open, asks the reader when the two copies meet for the first
// time, and saves a second after the last change with the sha dance and one
// retry on 409 (root ADR 0016).
//
// A project uses it like this:
//
//   const store = openStore({ project: "akwaaba-monsters", file: "save.json",
//     recordMaps: ["saves"], onChange: render, onStatus: showBadge, onQuestion: askCopyQuestion });
//   store.write(shape.write(store.document, "saves", id, fields, now));
//
// `onChange` fires when the document changes under the project: after the
// cloud copy is merged in on open, after a save merges in what another device
// wrote, and after the reader answers the question. `onStatus` receives what
// `describeSync` says. `onQuestion` receives `{project, file, local, cloud,
// answer(id)}` and must show it; `cloudSettingsPanel.askCopyQuestion` does.

import { DATA_FOLDER, browserStorage, documentPath, isReconciled, markReconciled, mirrorKey, readRepo, readToken, saveToken } from "./cloudSettings.js";
import { MAX_DOCUMENT_BYTES, documentBytes, hasRecords, migrate, parseDocument } from "./envelope.js";
import { fetchFile, fetchFolder, fetchRepository, fetchViewer, saveFile } from "./cloudGateway.js";
import { CONNECTION_CHECKS, permissionsFingerprint } from "./cloudPermissions.js";
import { describeFailure, describeSync } from "./cloudMessages.js";
import { planSave, planText, sameRecords } from "./merge.js";
import { applyAnswer, describeCopies } from "./reconcile.js";
import { readJson, writeJson } from "./localStore.js";

/** How long after the last change the cloud save goes out. Long enough to fold a burst of edits into one write. */
export const SAVE_DELAY_MS = 1200;

const isoNow = () => new Date().toISOString();

/** The saved token and repository together, or null when either is missing. */
export function cloudConfiguration(storage) {
  const token = readToken(storage);
  const repo = readRepo(storage);
  return token && repo ? { token, repo } : null;
}

/**
 * The three checks the settings panel shows, run in order, each one stopping
 * the rest when it fails. Also remembers the login and the permission
 * fingerprint on the saved token, so the panel can say who is signed in and
 * whether the token is behind the list.
 *
 * @returns {{ok: boolean, rows: Array<{id, label, ok, detail}>, login: string}}
 */
export async function runConnectionChecks({ token, repo }, storage = browserStorage()) {
  const [identity, repository, folder] = CONNECTION_CHECKS;
  const rows = [];

  const viewer = await fetchViewer(token.token);
  if (!viewer.ok) {
    rows.push({ ...identity, ok: false, detail: describeFailure({ ...viewer, need: identity.need }) });
    return { ok: false, rows, login: "" };
  }
  const login = String(viewer.data?.login ?? "");
  rows.push({ ...identity, ok: true, detail: `Signed in as ${login}.` });

  const seen = await fetchRepository(token.token, repo);
  if (!seen.ok) {
    rows.push({ ...repository, ok: false, detail: describeFailure({ ...seen, need: repository.need }) });
    return { ok: false, rows, login };
  }
  if (seen.data?.private === false) {
    rows.push({ ...repository, ok: false, detail: `${repo.owner}/${repo.repo} is public. Your data would be readable by anyone. Make it private first.` });
    return { ok: false, rows, login };
  }
  rows.push({ ...repository, ok: true, detail: `${repo.owner}/${repo.repo} is private.` });

  const listed = await fetchFolder(token.token, repo, DATA_FOLDER);
  if (!listed.ok) {
    rows.push({ ...folder, ok: false, detail: describeFailure({ ...listed, need: folder.need }) });
    return { ok: false, rows, login };
  }
  rows.push({
    ...folder,
    ok: true,
    detail: listed.data.missing
      ? `${repo.owner}/${repo.repo} is ready. The ${DATA_FOLDER} folder is written on the first save.`
      : `${listed.data.entries.filter((one) => one.type === "dir").length} project folders in ${repo.owner}/${repo.repo}/${DATA_FOLDER}.`,
  });

  saveToken(storage, { ...token, login, grantedPermissions: permissionsFingerprint() });
  return { ok: true, rows, login };
}

/**
 * Open one project's document.
 *
 * @param project the project slug, its folder name under web-projects/
 * @param file the file name, `history.json`
 * @param recordMaps the maps this build knows
 * @param legacyPath a file to read once when the new path is missing, for a
 *   project that kept its file somewhere else before the standard
 */
export function openStore({
  project,
  file,
  recordMaps,
  legacyPath = null,
  storage = browserStorage(),
  now = isoNow,
  onChange = () => {},
  onStatus = () => {},
  onQuestion = () => {},
}) {
  const path = documentPath(project, file);
  const key = mirrorKey(project, file);
  const shape = { migrate: (value) => migrate(value, recordMaps, now()) };

  const state = {
    document: shape.migrate(readJson(storage, key, null)),
    config: null,
    rows: [],
    connected: false,
    reconciled: isReconciled(storage, project, file),
    timer: null,
    saving: false,
    savePending: false,
  };

  const keepMirror = () => writeJson(storage, key, state.document);
  const status = (over = null) =>
    onStatus(over ?? describeSync(state.rows, { configured: Boolean(state.config), asked: true }));
  const replace = (document) => {
    const changed = !sameRecords(document, state.document);
    state.document = shape.migrate(document);
    keepMirror();
    if (changed) onChange(state.document);
  };
  const settle = () => {
    markReconciled(storage, project, file, now());
    state.reconciled = true;
  };

  async function readCloud() {
    const fresh = await fetchFile(state.config.token.token, state.config.repo, path);
    if (!fresh.ok) return fresh;
    if (!fresh.data.missing || !legacyPath) return fresh;
    // The project kept its file elsewhere before the standard. Read it once as
    // the cloud copy; the first save writes the new path and leaves it be.
    const old = await fetchFile(state.config.token.token, state.config.repo, legacyPath);
    if (!old.ok || old.data.missing) return fresh;
    return { ok: true, data: { missing: false, text: old.data.text, sha: null, legacy: true } };
  }

  async function save(attempt = 0) {
    if (!state.connected || !state.reconciled) return;
    if (state.saving) {
      state.savePending = true;
      return;
    }
    state.saving = true;
    state.savePending = false;
    const fresh = await readCloud();
    if (!fresh.ok) {
      state.saving = false;
      status({ state: "broken", label: "Not saving", detail: describeFailure(fresh) });
      return;
    }
    const remote = fresh.data.missing ? null : parseDocument(fresh.data.text, recordMaps, now());
    const plan = planSave({ local: state.document, remote, remoteSha: fresh.data.legacy ? null : fresh.data.sha, now: now() });
    if (plan.action === "skip") {
      replace(plan.document);
      state.saving = false;
      status();
      return;
    }
    const text = planText(plan);
    if (documentBytes(text) > MAX_DOCUMENT_BYTES) {
      state.saving = false;
      status({ state: "broken", label: "Not saving", detail: `This document is over ${Math.round(MAX_DOCUMENT_BYTES / 1024)} KB, more than one file can hold. It stays on this device.` });
      return;
    }
    const written = await saveFile(state.config.token.token, state.config.repo, path, {
      text,
      sha: plan.sha,
      message: `Update ${project}/${file} (${now()})`,
    });
    state.saving = false;
    if (!written.ok) {
      if (written.status === 409 && attempt === 0) return save(1);
      status({ state: "broken", label: "Not saving", detail: describeFailure(written) });
      return;
    }
    replace(plan.document);
    const folder = state.rows.find((one) => one.id === "folder");
    if (folder) folder.detail = `Saved ${project}/${file} to ${state.config.repo.owner}/${state.config.repo.repo}.`;
    status();
    if (state.savePending) schedule();
  }

  function schedule() {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = null;
      save();
    }, SAVE_DELAY_MS);
  }

  async function connect() {
    state.config = cloudConfiguration(storage);
    state.connected = false;
    if (!state.config) {
      state.rows = [];
      status();
      return;
    }
    onStatus(describeSync([], { configured: true, asked: false }));
    const checks = await runConnectionChecks(state.config, storage);
    state.rows = checks.rows;
    if (!checks.ok) {
      status();
      return;
    }
    const fresh = await readCloud();
    if (!fresh.ok) {
      status({ state: "broken", label: "Not saving", detail: describeFailure(fresh) });
      return;
    }
    state.connected = true;
    const cloud = fresh.data.missing ? null : parseDocument(fresh.data.text, recordMaps, now());
    const situation = describeCopies({ local: state.document, cloud, reconciled: state.reconciled });

    if (situation === "ask") {
      status({ state: "checking", label: "Waiting for you", detail: "This device and the cloud both hold data for this project. Choose which to keep." });
      onQuestion({
        project,
        file,
        local: state.document,
        cloud,
        answer: (id) => {
          const result = applyAnswer(id, { local: state.document, cloud, now: now() });
          settle();
          replace(result.document);
          status();
          if (result.writeCloud) save();
        },
      });
      return;
    }

    settle();
    if (situation === "local-only") {
      status();
      save();
      return;
    }
    // synced, none, same, cloud-only: the merge is the whole answer, and a
    // merge with nothing new on this side is a skip. A document with no
    // records is not written either: an empty file in the repository would be
    // a commit that says nothing.
    const plan = planSave({ local: state.document, remote: cloud, remoteSha: fresh.data.sha, now: now() });
    replace(plan.document);
    status();
    if (plan.action !== "skip" && (cloud || hasRecords(plan.document))) save();
  }

  connect();

  return {
    /** The document as the project should read it now. */
    get document() {
      return state.document;
    },
    /** Whether a token and a repository are saved. */
    get configured() {
      return Boolean(state.config);
    },
    /** Whether a cloud save is waiting or in flight. */
    get busy() {
      return state.saving || state.savePending || state.timer !== null;
    },
    /** Replace the document. The mirror is written at once; the cloud a moment later. */
    write(document) {
      state.document = shape.migrate(document);
      keepMirror();
      if (state.connected && state.reconciled) schedule();
    },
    /** Save now instead of after the rest. */
    saveNow() {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      return save();
    },
    /** Read the settings again and connect again. Call it after the reader changes the token or the repository. */
    reconnect() {
      state.reconciled = isReconciled(storage, project, file);
      return connect();
    },
  };
}
