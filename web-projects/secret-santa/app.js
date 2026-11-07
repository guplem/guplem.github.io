// The page: DOM glue over the pure modules.
//
// Two modes share one page. "Create" edits a draft (names, forbidden pairs and
// an optional title) and makes the share link. "Who do I give to?" reads the
// event from the link, lets a person pick who they are, warns them, and reveals
// their match. All logic worth testing lives in draw.js, editor.js,
// urlState.js and i18n.js; this file only reads the DOM and writes it.
//
// The URL holds the state (root ADR 0006):
//   ?e=<event>      a drawn event, opened in "Who do I give to?"
//   ?draft=<event>  the create screen's draft, so a reload keeps the list
//   ?mode=receive   the "Who do I give to?" tab with no event yet

import { drawAssignments, findBlockedPeople, hashString, newSeed } from "./draw.js";
import { addPeople, forbiddenFor, isForbidden, removePerson, toggleForbidden } from "./editor.js";
import { LANGUAGES, detectLanguage, translate } from "./i18n.js";
import { EVENT_PARAM, buildShareUrl, decodeEvent, encodeEvent, readEventFromSearch } from "./urlState.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { burstConfetti, buzz, startSnow } from "./effects.js";
import { forgetGiver, recallGiver, rememberGiver } from "./memory.js";
import { browserStorage } from "../cloud-storage/cloudSettings.js";

const DRAFT_PARAM = "draft";
const DRAFT_SEED = "-";
const MIN_PEOPLE = 3;

const $ = (id) => document.getElementById(id);
const storage = browserStorage();

const state = {
  lang: detectLanguage(navigator.languages ?? [navigator.language]),
  mode: "create",
  draft: { title: "", names: [], forbidden: [] },
  /** Names whose exclusion panel is open. Keyed by name, so removals do not shift it. */
  open: new Set(),
  /** Names added since the last render, so only they play the entrance. */
  fresh: new Set(),
  /** The last draw made on the create screen: { seed }, or null. */
  drawn: null,
  stale: false,
  /** The event read from a link, for "Who do I give to?". */
  event: null,
  eventError: false,
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
  $("name-input").placeholder = say("create.namePlaceholder");
  $("paste-link").placeholder = say("receive.pastePlaceholder");
  $("modes").setAttribute("aria-label", say("mode.label"));
  $("lang-picker").setAttribute("aria-label", say("app.language"));
  for (const button of $("lang-picker").children) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === state.lang));
  }
  renderDeployLine($("deploy-line"), readStamp(document), state.lang, say, escapeHtml, "web-projects/secret-santa");
  renderCreate();
  renderReceive();
}

function buildLanguagePicker() {
  for (const { code, label, name } of LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.lang = code;
    button.textContent = label;
    button.title = name;
    button.lang = code;
    button.addEventListener("click", () => {
      state.lang = code;
      applyLanguage();
    });
    $("lang-picker").append(button);
  }
}

// --- URL and modes ---------------------------------------------------------------

function readUrl() {
  const params = new URLSearchParams(location.search);
  state.event = null;
  state.eventError = false;
  if (params.has(EVENT_PARAM)) {
    state.event = readEventFromSearch(location.search);
    state.eventError = !state.event;
    state.mode = "receive";
  } else if (params.get("mode") === "receive") {
    state.mode = "receive";
  } else {
    state.mode = "create";
  }
  const draft = decodeEvent(params.get(DRAFT_PARAM) ?? "");
  if (draft) {
    state.draft = { title: draft.title, names: draft.names, forbidden: draft.forbidden };
    state.drawn = draft.seed === DRAFT_SEED ? null : { seed: draft.seed };
    state.stale = false;
  }
  resetReveal();
}

function draftUrl() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  // decodeEvent needs two names, so a one-name draft lives in memory only. The
  // seed of the last draw rides along, so a reload keeps the share link.
  if (state.draft.names.length >= 2) {
    url.searchParams.set(DRAFT_PARAM, encodeEvent({ ...state.draft, seed: state.drawn?.seed ?? DRAFT_SEED }));
  }
  return url.toString();
}

function setMode(mode, { push = true } = {}) {
  state.mode = mode;
  if (push) {
    let target;
    if (mode === "create") target = draftUrl();
    else if (state.event) target = buildShareUrl(location.href, state.event);
    else {
      const url = new URL(location.href);
      url.search = "?mode=receive";
      target = url.toString();
    }
    if (target !== location.href) history.pushState(null, "", target);
  }
  resetReveal();
  renderMode();
  renderReceive();
  window.scrollTo({ top: 0 });
}

function renderMode() {
  $("modes").dataset.mode = state.mode;
  $("tab-create").setAttribute("aria-selected", String(state.mode === "create"));
  $("tab-receive").setAttribute("aria-selected", String(state.mode === "receive"));
  $("view-create").hidden = state.mode !== "create";
  $("view-receive").hidden = state.mode !== "receive";
}

// --- create ------------------------------------------------------------------------

function avatarFor(name) {
  const span = document.createElement("span");
  span.className = "avatar";
  span.style.setProperty("--hue", String(hashString(name) % 360));
  span.textContent = [...name][0]?.toUpperCase() ?? "?";
  span.setAttribute("aria-hidden", "true");
  return span;
}

function changeDraft(next, { affectsDraw = true } = {}) {
  state.draft = next;
  if (affectsDraw && state.drawn) {
    state.drawn = null;
    state.stale = true;
  }
  history.replaceState(null, "", draftUrl());
  renderCreate();
}

function renderCreate() {
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
      renderCreate();
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
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
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

  $("create-error").hidden = true;
  $("stale").hidden = !state.stale;
  renderResult();
}

function currentShareEvent() {
  return { ...state.draft, seed: state.drawn.seed };
}

function renderResult() {
  const box = $("result");
  // Once a draw exists, "Draw again" in the result card replaces the big button.
  $("draw").closest(".draw-bar").hidden = Boolean(state.drawn);
  if (!state.drawn) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const url = buildShareUrl(location.href, currentShareEvent());
  $("share-link").value = url;
  $("open-link").href = url;
  $("share").hidden = typeof navigator.share !== "function";
  $("seed-line").textContent = say("create.seed", { seed: state.drawn.seed });
}

function showCreateError(text) {
  const box = $("create-error");
  box.hidden = false;
  box.textContent = text;
  // Restart the shake on a repeated error.
  box.style.animation = "none";
  void box.offsetWidth;
  box.style.animation = "";
  buzz([20, 40, 20]);
}

function draw(fromButton) {
  const { names, forbidden } = state.draft;
  if (names.length < MIN_PEOPLE) return showCreateError(say("create.needMore"));
  const blocked = findBlockedPeople(names.length, forbidden);
  if (blocked.givers.length) {
    return showCreateError(say("create.blockedGiver", { list: blocked.givers.map((i) => names[i]).join(", ") }));
  }
  if (blocked.receivers.length) {
    return showCreateError(say("create.blockedReceiver", { list: blocked.receivers.map((i) => names[i]).join(", ") }));
  }
  const seed = newSeed();
  if (!drawAssignments(names, forbidden, seed)) return showCreateError(say("create.impossible"));

  state.drawn = { seed };
  state.stale = false;
  state.open.clear();
  history.replaceState(null, "", draftUrl());
  renderCreate();
  const rect = fromButton.getBoundingClientRect();
  burstConfetti($("confetti"), { x: rect.left + rect.width / 2, y: rect.top });
  buzz([15, 30, 15]);
  $("result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}

async function copyLink() {
  const input = $("share-link");
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand("copy");
  }
  const button = $("copy");
  button.textContent = say("create.copied");
  buzz();
  setTimeout(() => { button.textContent = say("create.copy"); }, 1600);
}

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
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

  // The title is not part of the draw, so editing it keeps the result and only
  // rewrites the link.
  $("event-title").addEventListener("input", (event) => {
    changeDraft({ ...state.draft, title: event.target.value.slice(0, 60) }, { affectsDraw: false });
  });

  $("draw").addEventListener("click", (event) => draw(event.currentTarget));
  $("redraw").addEventListener("click", (event) => draw(event.currentTarget));
  $("copy").addEventListener("click", copyLink);
  $("share").addEventListener("click", async () => {
    try {
      await navigator.share({
        title: state.draft.title || say("app.name"),
        text: say("create.shareText"),
        url: $("share-link").value,
      });
    } catch {
      // The reader closed the share sheet; nothing to do.
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

function renderReceive() {
  const event = state.event;
  const revealing = $("receive-reveal").dataset.giver !== "";
  $("receive-nolink").hidden = Boolean(event) || revealing;
  $("paste-form").hidden = false;
  $("receive-error").hidden = !state.eventError;
  $("receive-error").textContent = say("receive.badLink");
  $("receive-pick").hidden = !event || revealing;
  if (!event) return;

  // This device already knows who opened this draw: go straight to their present.
  if (!revealing && state.mode === "receive") {
    const remembered = recallGiver(storage, event);
    if (remembered !== null) {
      startReveal(remembered);
      return;
    }
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
    $("remembered").textContent = say("receive.remembered", { name: event.names[giver] });
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
  const { names, forbidden, seed } = state.event;
  const result = drawAssignments(names, forbidden, seed);
  if (!result) {
    state.eventError = false;
    $("receive-error").hidden = false;
    $("receive-error").textContent = say("receive.impossible");
    $("receive-nolink").hidden = false;
    $("paste-form").hidden = true;
    return;
  }
  const reveal = $("receive-reveal");
  reveal.dataset.giver = String(giver);
  $("recipient").textContent = names[result[giver]];
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
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    gift.hidden = true;
    $("answer").hidden = false;
    $("hide").hidden = false;
  }, reduced ? 0 : 650);
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
  $("paste-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("paste-link").value.trim();
    let search = "";
    try {
      search = new URL(text).search;
    } catch {
      search = `?${EVENT_PARAM}=${encodeURIComponent(text)}`;
    }
    const found = readEventFromSearch(search);
    state.event = found;
    state.eventError = !found;
    if (found) {
      $("paste-link").value = "";
      history.pushState(null, "", buildShareUrl(location.href, found));
    }
    renderReceive();
  });
  $("edit-draw").addEventListener("click", (event) => {
    event.preventDefault();
    const { title, names, forbidden } = state.event;
    state.draft = { title, names: [...names], forbidden: forbidden.map((p) => [...p]) };
    state.drawn = null;
    state.stale = false;
    renderCreate();
    setMode("create");
  });
}

// --- start-up --------------------------------------------------------------------

function start() {
  buildLanguagePicker();
  for (const tab of document.querySelectorAll("#modes [data-mode]")) {
    tab.addEventListener("click", () => {
      if (state.mode !== tab.dataset.mode) {
        buzz();
        setMode(tab.dataset.mode);
      }
    });
  }
  wireCreate();
  wireReceive();
  window.addEventListener("popstate", () => {
    readUrl();
    renderMode();
    applyLanguage();
  });
  readUrl();
  renderMode();
  applyLanguage();
  startSnow($("snow"));
}

start();
