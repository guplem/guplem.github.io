// The page: DOM glue over the pure modules.
//
// The page has two views, and the URL decides which one shows:
//
// - "Receive" opens for a shared link (`?e=`). It is built for anyone,
//   including older people: pick your name, confirm the warning, open the
//   present. A small link at the very bottom leads to the organiser's view.
// - "Create" opens for every other address. It is the editor (names,
//   exclusions, an optional title and note), then the share screen with the
//   link, a ready-made message in a language of your choice, and share buttons.
//
// All logic worth testing lives in draw.js, editor.js, urlState.js, share.js,
// memory.js and i18n.js; this file only reads the DOM and writes it.
//
// The URL holds the state (root ADR 0006):
//   ?e=<event>      a drawn event, opened in the receive view
//   ?draft=<event>  the create view's draft, so a reload keeps the list; its
//                   seed is "-" until a draw happens, then the draw's seed

import { drawAssignments, findBlockedPeople, hashString, newSeed } from "./draw.js";
import { addPeople, forbiddenFor, isForbidden, removePerson, toggleForbidden } from "./editor.js";
import { LANGUAGES, detectLanguage, translate } from "./i18n.js";
import { EVENT_PARAM, MAX_NOTE_LENGTH, buildShareUrl, clip, decodeEvent, encodeEvent, readEventFromSearch } from "./urlState.js";
import { shareMessage, whatsappUrl } from "./share.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { burstConfetti, buzz, startSnow } from "./effects.js";
import { forgetGiver, recallGiver, rememberGiver } from "./memory.js";
import { browserStorage } from "../cloud-storage/cloudSettings.js";

const DRAFT_PARAM = "draft";
const DRAFT_SEED = "-";
const MIN_PEOPLE = 3;

const $ = (id) => document.getElementById(id);
const storage = browserStorage();
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const emptyDraft = () => ({ title: "", note: "", names: [], forbidden: [] });

const state = {
  lang: detectLanguage(navigator.languages ?? [navigator.language]),
  /** The language of the message on the share screen. Follows the page until changed. */
  messageLang: null,
  view: "create",
  draft: emptyDraft(),
  /** Names whose exclusion panel is open. Keyed by name, so removals do not shift it. */
  open: new Set(),
  /** Names added since the last render, so only they play the entrance. */
  fresh: new Set(),
  /** The current draw of the draft: { seed }, or null when the draft changed. */
  drawn: null,
  /** True while the share screen shows instead of the editor. */
  sharing: false,
  /** The event read from a shared link. */
  event: null,
};

const say = (key, params) => translate(state.lang, key, params);
const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// --- language ----------------------------------------------------------------

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.title = say("app.documentTitle");
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = say(node.dataset.i18n);
  $("event-title").placeholder = say("create.titlePlaceholder");
  $("event-note").placeholder = say("create.notePlaceholder");
  $("name-input").placeholder = say("create.namePlaceholder");
  $("name-input").setAttribute("aria-label", say("create.namePlaceholder"));
  $("lang-picker").setAttribute("aria-label", say("app.language"));
  $("message-lang").setAttribute("aria-label", say("share.messageLanguage"));
  renderDeployLine($("deploy-line"), readStamp(document), state.lang, say, escapeHtml, "web-projects/secret-santa");
  render();
}

function languageButtons(host, current, onPick) {
  host.replaceChildren();
  for (const { code, label, name } of LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = name;
    button.lang = code;
    button.setAttribute("aria-pressed", String(code === current));
    button.addEventListener("click", () => onPick(code));
    host.append(button);
  }
}

// --- URL and views -----------------------------------------------------------------

function readUrl() {
  const params = new URLSearchParams(location.search);
  state.event = null;
  if (params.has(EVENT_PARAM)) {
    state.view = "receive";
    state.event = readEventFromSearch(location.search);
  } else {
    state.view = "create";
  }
  const draft = decodeEvent(params.get(DRAFT_PARAM) ?? "");
  if (draft) {
    const { title, note, names, forbidden, seed } = draft;
    state.draft = { title, note, names, forbidden };
    state.drawn = seed === DRAFT_SEED ? null : { seed };
    state.sharing = Boolean(state.drawn);
  }
  resetReveal();
}

function draftUrl() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  // decodeEvent needs two names, so a one-name draft lives in memory only. The
  // seed of the last draw rides along, so a reload keeps the share screen.
  if (state.draft.names.length >= 2) {
    url.searchParams.set(DRAFT_PARAM, encodeEvent({ ...state.draft, seed: state.drawn?.seed ?? DRAFT_SEED }));
  }
  return url.toString();
}

function render() {
  // The receive view carries no footer: it holds only what a participant needs.
  document.body.classList.toggle("is-receive", state.view === "receive");
  $("view-create").hidden = state.view !== "create";
  $("view-receive").hidden = state.view !== "receive";
  if (state.view === "create") renderCreate();
  else renderReceive();
}

// --- create: the editor -------------------------------------------------------------

function avatarFor(name) {
  const span = document.createElement("span");
  span.className = "avatar";
  span.style.setProperty("--hue", String(hashString(name) % 360));
  span.textContent = [...name][0]?.toUpperCase() ?? "?";
  span.setAttribute("aria-hidden", "true");
  return span;
}

/**
 * Store a new draft. A change to the people or the exclusions drops the draw,
 * because the old seed would give a different result. The title and the note
 * are not part of the draw, so they keep it.
 */
function changeDraft(next, { affectsDraw = true } = {}) {
  state.draft = next;
  if (affectsDraw) state.drawn = null;
  history.replaceState(null, "", draftUrl());
  renderCreate();
}

function renderCreate() {
  $("editor").hidden = state.sharing;
  $("share-view").hidden = !state.sharing;
  if (state.sharing) renderShare();
  else renderEditor();
}

function renderEditor() {
  const { names } = state.draft;
  const list = $("people");
  list.replaceChildren();
  names.forEach((name, index) => {
    const li = document.createElement("li");
    li.className = "person";
    if (!state.fresh.has(name)) li.style.animation = "none";

    const row = document.createElement("div");
    row.className = "person-row";

    const main = document.createElement("div");
    main.className = "person-main";
    const title = document.createElement("div");
    title.className = "person-name";
    title.textContent = name;
    const banned = forbiddenFor(state.draft, index).map((i) => names[i]);
    const rules = document.createElement("div");
    rules.className = "person-rules" + (banned.length ? " has-rules" : "");
    rules.textContent = banned.length ? say("create.rulesSummary", { list: banned.join(", ") }) : say("create.noRules");
    main.append(title, rules);

    const isOpen = state.open.has(name);
    const rulesButton = document.createElement("button");
    rulesButton.type = "button";
    rulesButton.className = "icon-btn";
    rulesButton.textContent = "🚫";
    rulesButton.title = say("create.editRules");
    rulesButton.setAttribute("aria-label", `${say("create.editRules")}: ${name}`);
    rulesButton.setAttribute("aria-expanded", String(isOpen));
    rulesButton.addEventListener("click", () => {
      if (state.open.has(name)) state.open.delete(name);
      else state.open.add(name);
      renderEditor();
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-btn";
    removeButton.textContent = "✕";
    removeButton.setAttribute("aria-label", say("create.remove", { name }));
    removeButton.addEventListener("click", () => {
      li.classList.add("leaving");
      buzz();
      const done = () => {
        state.open.delete(name);
        changeDraft(removePerson(state.draft, state.draft.names.indexOf(name)));
      };
      if (reducedMotion()) done();
      else li.addEventListener("animationend", done, { once: true });
    });

    row.append(avatarFor(name), main, rulesButton, removeButton);
    li.append(row);

    if (isOpen) {
      const panel = document.createElement("div");
      panel.className = "rules-panel";
      const help = document.createElement("p");
      help.textContent = say("create.rulesHelp", { name });
      const chips = document.createElement("div");
      chips.className = "chips";
      names.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = other;
        chip.setAttribute("aria-pressed", String(isForbidden(state.draft, index, otherIndex)));
        chip.addEventListener("click", () => {
          buzz(8);
          changeDraft(toggleForbidden(state.draft, index, otherIndex, $("mutual").checked));
        });
        chips.append(chip);
      });
      panel.append(help, chips);
      li.append(panel);
    }
    list.append(li);
  });
  state.fresh.clear();

  $("people-empty").hidden = names.length > 0;
  $("people-count").textContent =
    names.length === 0 ? "" : names.length === 1 ? say("create.countOne") : say("create.count", { count: names.length });
  if (document.activeElement !== $("event-title")) $("event-title").value = state.draft.title;
  if (document.activeElement !== $("event-note")) $("event-note").value = state.draft.note;
  $("note-count").textContent = `${Array.from(state.draft.note).length}/${MAX_NOTE_LENGTH}`;
  $("create-error").hidden = true;
  resetClearButton();
}

function showCreateError(text) {
  const box = $("create-error");
  box.hidden = false;
  box.textContent = text;
  // Restart the shake on a repeated error.
  box.style.animation = "none";
  void box.offsetWidth;
  box.style.animation = "";
  box.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  buzz([20, 40, 20]);
}

/** Check the draft, and give a new seed when `fresh` or when there is no draw yet. */
function generate(fromButton, { fresh = false } = {}) {
  const { names, forbidden } = state.draft;
  if (names.length < MIN_PEOPLE) return showCreateError(say("create.needMore"));
  const blocked = findBlockedPeople(names.length, forbidden);
  if (blocked.givers.length) {
    return showCreateError(say("create.blockedGiver", { list: blocked.givers.map((i) => names[i]).join(", ") }));
  }
  if (blocked.receivers.length) {
    return showCreateError(say("create.blockedReceiver", { list: blocked.receivers.map((i) => names[i]).join(", ") }));
  }
  if (fresh || !state.drawn) {
    const seed = newSeed();
    if (!drawAssignments(names, forbidden, seed)) return showCreateError(say("create.impossible"));
    state.drawn = { seed };
  }
  state.sharing = true;
  state.open.clear();
  history.replaceState(null, "", draftUrl());
  renderCreate();
  window.scrollTo({ top: 0 });
  const rect = fromButton.getBoundingClientRect();
  burstConfetti($("confetti"), { x: rect.left + rect.width / 2, y: Math.min(rect.top, innerHeight / 2) });
  buzz([15, 30, 15]);
}

let clearArmed = null;

function resetClearButton() {
  clearTimeout(clearArmed);
  clearArmed = null;
  $("clear").textContent = say("create.clear");
  $("clear").classList.remove("armed");
  $("clear").hidden = state.draft.names.length === 0 && !state.draft.title && !state.draft.note;
}

/** "Start over" asks for a second tap, so one slip does not wipe the list. */
function clearDraft() {
  if (!clearArmed) {
    $("clear").textContent = say("create.clearConfirm");
    $("clear").classList.add("armed");
    buzz();
    clearArmed = setTimeout(resetClearButton, 3000);
    return;
  }
  state.open.clear();
  changeDraft(emptyDraft());
  $("name-input").focus();
}

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

// --- create: the share screen ------------------------------------------------------

function shareUrl() {
  return buildShareUrl(location.href, { ...state.draft, seed: state.drawn.seed });
}

function currentMessage() {
  return shareMessage(state.messageLang ?? state.lang, { title: state.draft.title, url: shareUrl() });
}

function renderShare() {
  const url = shareUrl();
  $("share-link").value = url;
  $("preview-link").href = url;
  languageButtons($("message-lang"), state.messageLang ?? state.lang, (code) => {
    state.messageLang = code;
    renderShare();
  });
  // The preview shows the link on one cut line: the full link is long and
  // would push the buttons off the screen. The copied text has the full link.
  const message = currentMessage();
  const cut = message.lastIndexOf("\n");
  const text = document.createElement("span");
  text.textContent = message.slice(0, cut);
  const link = document.createElement("span");
  link.className = "preview-url";
  link.textContent = message.slice(cut + 1);
  $("message-preview").replaceChildren(text, link);
  $("whatsapp").href = whatsappUrl(currentMessage());
  // The phone's own share menu offers every app. A browser without one gets a
  // WhatsApp link instead.
  const canShare = typeof navigator.share === "function";
  $("share-native").hidden = !canShare;
  $("whatsapp").hidden = canShare;
}

async function copyText(text, fallbackInput) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallbackInput) return false;
    fallbackInput.select();
    return document.execCommand("copy");
  }
}

/** After a copy, say so and offer the share buttons right away. */
function afterCopy(button, label) {
  buzz();
  const span = button.querySelector("[data-i18n]");
  span.textContent = say("share.copiedShort");
  setTimeout(() => { span.textContent = say(label); }, 1400);
  const next = $("share-next");
  next.hidden = false;
  next.classList.remove("pop");
  void next.offsetWidth;
  next.classList.add("pop");
  next.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
}

function wireCreate() {
  const input = $("name-input");
  const submit = () => {
    const before = new Set(state.draft.names);
    const next = addPeople(state.draft, input.value);
    next.names.filter((n) => !before.has(n)).forEach((n) => state.fresh.add(n));
    input.value = "";
    autoGrow(input);
    if (next.names.length !== state.draft.names.length) {
      buzz();
      changeDraft(next);
    }
    input.focus();
  };
  $("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  input.addEventListener("input", () => autoGrow(input));

  $("event-title").addEventListener("input", (event) => {
    changeDraft({ ...state.draft, title: event.target.value.slice(0, 60) }, { affectsDraw: false });
  });
  $("event-note").addEventListener("input", (event) => {
    autoGrow(event.target);
    changeDraft({ ...state.draft, note: clip(event.target.value, MAX_NOTE_LENGTH) }, { affectsDraw: false });
  });

  $("clear").addEventListener("click", clearDraft);
  $("generate").addEventListener("click", (event) => generate(event.currentTarget));
  $("redraw").addEventListener("click", (event) => generate(event.currentTarget, { fresh: true }));
  $("edit").addEventListener("click", () => {
    state.sharing = false;
    $("share-next").hidden = true;
    renderCreate();
    window.scrollTo({ top: 0 });
  });

  $("copy-link").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (await copyText($("share-link").value, $("share-link"))) afterCopy(button, "share.copyLink");
  });
  $("copy-message").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (await copyText(currentMessage())) afterCopy(button, "share.copyMessage");
  });
  $("share-native").addEventListener("click", async () => {
    try {
      await navigator.share({ text: currentMessage() });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  });
}

// --- receive -------------------------------------------------------------------

function closeGift() {
  const gift = $("gift");
  gift.classList.remove("open");
  gift.hidden = false;
  $("gift-hint").hidden = false;
  $("answer").hidden = true;
  $("hide").hidden = true;
}

function resetReveal() {
  closeGift();
  $("receive-reveal").hidden = true;
  $("receive-reveal").dataset.giver = "";
}

function showReceiveError(key) {
  $("receive-error").hidden = false;
  $("receive-error-text").textContent = say(key);
  $("receive-pick").hidden = true;
  $("receive-reveal").hidden = true;
}

function renderReceive() {
  const event = state.event;
  $("receive-error").hidden = true;
  if (!event) return showReceiveError("receive.badLink");

  const revealing = $("receive-reveal").dataset.giver !== "";
  $("receive-pick").hidden = revealing;

  // This device already knows who opened this draw: go straight to their present.
  if (!revealing) {
    const remembered = recallGiver(storage, event);
    if (remembered !== null) return startReveal(remembered);
  }

  $("event-name").textContent = event.title || say("app.name");
  const list = $("names");
  list.replaceChildren();
  event.names.forEach((name, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "name-btn";
    button.style.animationDelay = `${Math.min(index * 30, 300)}ms`;
    button.append(avatarFor(name), document.createTextNode(name));
    button.addEventListener("click", () => askWho(index));
    li.append(button);
    list.append(li);
  });

  if (revealing) {
    const giver = Number($("receive-reveal").dataset.giver);
    $("hello").textContent = say("receive.hello", { name: event.names[giver] });
  }
}

function askWho(giver) {
  const name = state.event.names[giver];
  buzz();
  $("warning-title").textContent = say("receive.warningTitle", { name });
  $("warning-body").textContent = say("receive.warningBody", { name });
  $("warning-ok").textContent = say("receive.confirm", { name });
  $("warning-cancel").textContent = say("receive.cancel");
  const dialog = $("warning");
  dialog.returnValue = "";
  dialog.onclose = () => {
    if (dialog.returnValue !== "ok") return;
    rememberGiver(storage, state.event, giver);
    startReveal(giver);
  };
  dialog.showModal();
  $("warning-cancel").focus();
}

function startReveal(giver) {
  const { names, forbidden, seed, note } = state.event;
  const result = drawAssignments(names, forbidden, seed);
  if (!result) return showReceiveError("receive.impossible");
  const reveal = $("receive-reveal");
  reveal.dataset.giver = String(giver);
  $("recipient").textContent = names[result[giver]];
  $("note-card").hidden = !note;
  $("note-text").textContent = note;
  renderReceive();
  reveal.hidden = false;
  window.scrollTo({ top: 0 });
}

function openGift() {
  const gift = $("gift");
  if (gift.classList.contains("open")) return;
  gift.classList.add("open");
  $("gift-hint").hidden = true;
  buzz([10, 30, 10, 30, 60]);
  const rect = gift.getBoundingClientRect();
  burstConfetti($("confetti"), { x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 }, 180);
  setTimeout(() => {
    gift.hidden = true;
    $("answer").hidden = false;
    $("hide").hidden = false;
  }, reducedMotion() ? 0 : 650);
}

function wireReceive() {
  $("gift").addEventListener("click", openGift);
  // "Hide" closes the present again. The person stays on their own screen,
  // because this device remembers who they are.
  $("hide").addEventListener("click", () => {
    closeGift();
    window.scrollTo({ top: 0 });
  });
  // The one way back to the name list, kept small on purpose.
  $("not-me").addEventListener("click", (event) => {
    event.preventDefault();
    forgetGiver(storage, state.event);
    resetReveal();
    renderReceive();
    window.scrollTo({ top: 0 });
  });
  // The organiser's view hides behind this small link. It starts from the
  // event of the link, and "Start over" empties it.
  $("create-own").addEventListener("click", (event) => {
    event.preventDefault();
    if (state.event) {
      const { title, note, names, forbidden } = state.event;
      state.draft = { title, note, names: [...names], forbidden: forbidden.map((pair) => [...pair]) };
    }
    state.drawn = null;
    state.sharing = false;
    state.view = "create";
    history.pushState(null, "", draftUrl());
    resetReveal();
    render();
    window.scrollTo({ top: 0 });
  });
}

// --- start-up --------------------------------------------------------------------

function start() {
  wireCreate();
  wireReceive();
  window.addEventListener("popstate", () => {
    readUrl();
    applyLanguage();
  });
  const pickPageLanguage = (code) => {
    state.lang = code;
    languageButtons($("lang-picker"), state.lang, pickPageLanguage);
    applyLanguage();
  };
  languageButtons($("lang-picker"), state.lang, pickPageLanguage);
  readUrl();
  applyLanguage();
  startSnow($("snow"));
}

start();
