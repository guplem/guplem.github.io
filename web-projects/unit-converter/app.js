// The page itself: reading the input box and putting the answers on screen.
//
// Everything hard already happened somewhere else. `parse.js` reads the line,
// `search.js` finds the unit, `convert.js` does the arithmetic and `format.js`
// writes the numbers, and every one of those is pure and tested. This file only
// listens, calls them, and builds elements. Keep it that way: anything here
// worth a test belongs in one of those modules instead.
//
// Every piece of text goes on screen through `textContent`, never through
// `innerHTML`. The one exception is the deploy line, which needs a link inside
// a sentence and brings its own escaping. That is why no escaping helper
// appears anywhere else in this file: there is nothing to escape.

import { convert, convertAll } from "./convert.js";
import { fetchRates } from "./dataSource.js";
import { readStamp, renderDeployLine } from "./deployStamp.js";
import { formatCompound, formatNumber, formatPlainValue, formatValue } from "./format.js";
import { LANGUAGES, pickLanguage, sayIn } from "./i18n.js";
import { parseQuery } from "./parse.js";
import { isStale } from "./rates.js";
import { matchesExactly, searchUnits } from "./search.js";
import { readLanguage, readRates, readRecents, rememberConversion, saveLanguage, saveRates } from "./store.js";
import { CATEGORIES, SNAPSHOT_DATE, categoryById, unitById, unitsInCategory } from "./units.js";
import { buildSearch, readState } from "./urlState.js";

/** How many answers show before the "show more" control. */
const ROWS_SHOWN = 8;
/** How long the typing has to stop before a conversion counts as one worth remembering. */
const REMEMBER_AFTER_MS = 1400;
/** The lines the empty state offers, each one a shape the parser understands. */
const EXAMPLES = ["100 km", `5'10"`, "20 °C", "1 1/2 cup", "100 USD", "1 GB", "7 l/100km", "180 lb"];

const el = (id) => document.getElementById(id);
const dom = {
  query: el("query"),
  field: el("field"),
  clear: el("clear"),
  suggestions: el("suggestions"),
  reading: el("reading"),
  results: el("results"),
  resultsHeading: el("results-heading"),
  targetSlot: el("target-slot"),
  rows: el("rows"),
  showAll: el("show-all"),
  ratesNote: el("rates-note"),
  prompt: el("prompt"),
  promptHeading: el("prompt-heading"),
  promptHint: el("prompt-hint"),
  examples: el("examples"),
  recents: el("recents"),
  recentsHeading: el("recents-heading"),
  categoriesHeading: el("categories-heading"),
  categories: el("categories"),
  langPicker: el("lang-picker"),
  toast: el("toast"),
  deployLine: el("deploy-line"),
  privacy: el("privacy"),
  backLink: el("back-link"),
  title: el("title"),
  tagline: el("tagline"),
};

/** The browser's storage, or nothing when the browser refuses to hand it over. */
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

let lang = "en";
let say = sayIn(lang);
/** Today's rates, or null while they are still coming or if they never do. */
let liveRates = null;
/** What the rates note should say right now. */
let ratesState = "loading";
/** A target that came in on a shared link, used until the typed line names one. */
let linkedTarget = null;
/** Whether the answer list is showing everything or just the common units. */
let expanded = false;
/** Which suggestion the arrow keys are on, or -1 for none. */
let activeSuggestion = -1;
/** The units currently offered, so Enter knows what it is choosing. */
let offered = [];
let rememberTimer = 0;

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  return svg;
}

/** The one place this page writes HTML rather than text, so the one escaper it needs. */
const escapeForDeployLine = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let toastTimer = 0;
function toast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove("is-shown"), 2200);
}

/**
 * Put text on the clipboard.
 *
 * `navigator.clipboard` is missing on a page served over plain http and
 * refused in some browsers, so the old selection trick stays as the fallback.
 * A copy that silently does nothing is the worst outcome, so a refusal says so.
 */
async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
    return;
  } catch {
    // Fall through to the fallback below.
  }
  const holder = document.createElement("textarea");
  holder.value = text;
  holder.setAttribute("readonly", "");
  holder.style.position = "fixed";
  holder.style.opacity = "0";
  document.body.append(holder);
  holder.select();
  const worked = document.execCommand?.("copy");
  holder.remove();
  toast(worked ? message : say("ui.copyFailed"));
}

/** The name of a unit in the current language, with its note if it has one. */
const nameOf = (unit) => unit.name[lang] ?? unit.name.en;
const tagOf = (unit) => (unit.tag ? unit.tag[lang] ?? unit.tag.en : null);
const categoryName = (id) => {
  const category = categoryById(id);
  return category ? category.name[lang] ?? category.name.en : "";
};

/* -------------------------------------------------------------------------- */
/* The answers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One answer: a big number, the unit it is in, and the second reading under it
 * when there is one worth having (`5′ 10.1″` under `5.8399 ft`).
 *
 * The whole row copies on click, because copying the number is what a person
 * came to do. The small button on the end starts a new conversion from that
 * unit instead, which is the other thing they do.
 */
function buildRow(row, { card = false } = {}) {
  const shown = formatValue(row.value, row.unit, lang);
  const plain = formatPlainValue(row.value, row.unit);

  const main = element("button", card ? "target-card" : "row-main");
  main.type = "button";
  main.setAttribute("aria-label", say("ui.copyValue", { value: `${plain} ${row.unit.sym}` }));
  main.addEventListener("click", () => copyText(plain, say("ui.copied", { value: shown })));

  const headline = element("span", "value-line");
  headline.append(element("span", "value", shown));
  headline.append(element("span", "sym", row.unit.sym));
  main.append(headline);

  const about = element("div", "about");
  about.append(element("span", "about-note", [nameOf(row.unit), tagOf(row.unit)].filter(Boolean).join(" · ")));
  const compound = formatCompound(row.value, row.unit.id, lang);
  if (compound) about.append(element("span", "about-note compound", compound));
  main.append(about);

  if (card) return main;

  const item = element("li", "row");
  item.append(main);

  const swap = element("button", "row-swap");
  swap.type = "button";
  swap.setAttribute("aria-label", say("ui.useAsSource", { unit: nameOf(row.unit) }));
  swap.append(icon("M7 7h10l-3-3m3 3-3 3M17 17H7l3-3m-3 3 3 3"));
  swap.addEventListener("click", () => {
    setQuery(`${plain} ${row.unit.sym}`);
    toast(say("ui.swapped", { unit: nameOf(row.unit) }));
  });
  item.append(swap);
  return item;
}

/** The line under the input saying what the page made of what was typed. */
function renderReading(parsed) {
  const unit = unitById(parsed.unitId);
  dom.reading.className = "reading";
  dom.reading.replaceChildren();

  if (!unit) {
    if (parsed.unitQuery !== "") {
      dom.reading.className = "reading is-warning";
      dom.reading.append(document.createTextNode(`${say("ui.noUnit", { text: parsed.unitQuery })} ${say("ui.noUnitHint")}`));
    } else if (parsed.value !== null) {
      dom.reading.append(document.createTextNode(say("ui.needUnit")));
    } else {
      dom.reading.hidden = true;
      return;
    }
    dom.reading.hidden = false;
    return;
  }

  const amount = parsed.label ?? `${formatNumber(parsed.value, lang)} ${nameOf(unit)}`;
  // The sentence differs by language, so it is split on its own placeholder
  // rather than assembled from pieces that only line up in English.
  const SLOT = String.fromCharCode(1);
  const [before, after = ""] = say("ui.reading", { amount: SLOT }).split(SLOT);
  dom.reading.append(document.createTextNode(before));
  dom.reading.append(element("strong", null, amount));
  dom.reading.append(document.createTextNode(after));
  dom.reading.hidden = false;
}

/** The note that says where the exchange rates came from, and how old they are. */
function renderRatesNote(isCurrency) {
  if (!isCurrency) {
    dom.ratesNote.hidden = true;
    return;
  }
  dom.ratesNote.replaceChildren();
  if (ratesState === "loading") {
    dom.ratesNote.textContent = say("ui.ratesLoading");
  } else if (ratesState === "live" && liveRates) {
    const where = liveRates.source ? ` ${say("ui.ratesSource", { name: liveRates.source })}` : "";
    dom.ratesNote.textContent = `${say("ui.ratesLive", { date: liveRates.date })}${where}`;
  } else {
    dom.ratesNote.textContent = say("ui.ratesOffline", { date: SNAPSHOT_DATE });
  }
  dom.ratesNote.hidden = false;
}

function renderResults(parsed) {
  const unit = unitById(parsed.unitId);
  if (!unit || parsed.value === null) {
    dom.results.hidden = true;
    dom.prompt.hidden = false;
    return;
  }

  const context = liveRates ? { rates: liveRates.rates } : undefined;
  const all = convertAll(parsed.value, unit.id, context);
  const targetId = parsed.targetId ?? (unitById(linkedTarget)?.cat === unit.cat ? linkedTarget : null);

  dom.resultsHeading.textContent = `${say("ui.results")} · ${categoryName(unit.cat)}`;

  dom.targetSlot.replaceChildren();
  let rest = all;
  if (targetId && targetId !== unit.id) {
    const chosen = all.find((row) => row.unit.id === targetId);
    if (chosen) {
      dom.targetSlot.append(buildRow(chosen, { card: true }));
      rest = all.filter((row) => row.unit.id !== targetId);
    }
  }

  const shown = expanded ? rest : rest.slice(0, ROWS_SHOWN);
  dom.rows.replaceChildren(...shown.map((row) => buildRow(row)));

  const hidden = rest.length - shown.length;
  dom.showAll.hidden = hidden <= 0 && !expanded;
  dom.showAll.textContent = expanded ? say("ui.showFewer") : say("ui.showAll", { n: hidden });

  renderRatesNote(unit.cat === "currency");
  dom.results.hidden = false;
  dom.prompt.hidden = true;
}

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Which half of the line the suggestions are for.
 *
 * While a target is being typed the suggestions are units of the same category,
 * because nothing else can be an answer. Otherwise they are units of any
 * category, because the source unit is what decides the category in the first
 * place.
 */
function suggestionContext(parsed) {
  if (parsed.awaitingTarget) {
    return { token: parsed.targetQuery, category: unitById(parsed.unitId)?.cat ?? null, forTarget: true };
  }
  return { token: parsed.unitQuery, category: null, forTarget: false };
}

function renderSuggestions(parsed) {
  const focused = document.activeElement === dom.query;
  const { token, category, forTarget } = suggestionContext(parsed);
  const chosen = unitById(forTarget ? parsed.targetId : parsed.unitId);

  // Nothing left to suggest once the unit is written out in full.
  const settled = chosen && matchesExactly(chosen, token);
  const wanted = focused && !settled && (token !== "" || (forTarget && category));

  if (!wanted) {
    closeSuggestions();
    return;
  }

  offered =
    token === "" && category
      ? unitsInCategory(category).slice(0, ROWS_SHOWN)
      : searchUnits(token, { limit: ROWS_SHOWN, category }).map((hit) => hit.unit);

  if (offered.length === 0) {
    closeSuggestions();
    return;
  }

  dom.suggestions.replaceChildren(
    ...offered.map((unit, index) => {
      const item = element("li", "suggestion");
      item.id = `suggestion-${index}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === activeSuggestion));
      item.append(element("span", "suggestion-sym", unit.sym));
      item.append(element("span", "suggestion-name", [nameOf(unit), tagOf(unit)].filter(Boolean).join(" · ")));
      item.append(element("span", "suggestion-cat", categoryName(unit.cat)));
      // `mousedown` rather than `click`: the input must not lose focus first,
      // or the list closes before the choice lands.
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        chooseUnit(unit);
      });
      return item;
    }),
  );
  dom.suggestions.hidden = false;
  dom.query.setAttribute("aria-expanded", "true");
  dom.query.setAttribute("aria-activedescendant", activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : "");
}

function closeSuggestions() {
  dom.suggestions.hidden = true;
  dom.suggestions.replaceChildren();
  dom.query.setAttribute("aria-expanded", "false");
  dom.query.removeAttribute("aria-activedescendant");
  offered = [];
  activeSuggestion = -1;
}

/** Put a chosen unit into the line, in place of the half-typed word it replaces. */
function chooseUnit(unit) {
  const parsed = parseQuery(dom.query.value);
  if (parsed.awaitingTarget) {
    setQuery(`${parsed.amountText} ${say("ui.toWord")} ${unit.sym}`);
  } else {
    const amount = parsed.amountText.slice(0, parsed.amountText.length - parsed.unitQuery.length).trim();
    setQuery(amount === "" ? unit.sym : `${amount} ${unit.sym}`);
  }
  activeSuggestion = -1;
  dom.query.focus();
}

function moveSuggestion(step) {
  if (offered.length === 0) return;
  const next = activeSuggestion + step;
  activeSuggestion = next < 0 ? offered.length - 1 : next % offered.length;
  render();
  document.getElementById(`suggestion-${activeSuggestion}`)?.scrollIntoView({ block: "nearest" });
}

/* -------------------------------------------------------------------------- */
/* Chips                                                                      */
/* -------------------------------------------------------------------------- */

function buildChip(label, onPick, { hue = null, sub = null } = {}) {
  const chip = element("button", hue === null ? "chip" : "chip chip-category");
  chip.type = "button";
  if (hue !== null) {
    chip.style.setProperty("--hue", String(hue));
    chip.append(element("span", "chip-dot"));
  }
  chip.append(element("span", "chip-code", label));
  if (sub) chip.append(element("span", "suggestion-cat", sub));
  chip.addEventListener("click", () => onPick());
  return chip;
}

function renderChips() {
  dom.examples.replaceChildren(...EXAMPLES.map((text) => buildChip(text, () => setQuery(text))));
  dom.categories.replaceChildren(
    ...CATEGORIES.map((category) =>
      buildChip(category.name[lang] ?? category.name.en, () => setQuery(category.sample), { hue: category.hue }),
    ),
  );

  const recents = readRecents(storage);
  dom.recents.replaceChildren(...recents.map((entry) => buildChip(entry.q, () => setQuery(entry.q))));
  dom.recents.hidden = recents.length === 0;
  dom.recentsHeading.hidden = recents.length === 0;
}

/* -------------------------------------------------------------------------- */
/* Wiring it together                                                         */
/* -------------------------------------------------------------------------- */

function setQuery(text) {
  dom.query.value = text;
  expanded = false;
  activeSuggestion = -1;
  closeSuggestions();
  dom.query.focus();
  render();
}

/** Keep the address bar showing what is on screen, so the link can be shared. */
function updateUrl(parsed) {
  const search = buildSearch({ q: parsed.raw, to: parsed.targetId ?? linkedTarget, lang });
  const next = `${location.pathname}${search}${location.hash}`;
  if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, "", next);
}

/** Remember a conversion only once the typing has stopped, so no half-typed line is kept. */
function scheduleRemember(parsed) {
  clearTimeout(rememberTimer);
  if (!parsed.unitId || parsed.value === null || parsed.impliedValue) return;
  rememberTimer = setTimeout(() => {
    rememberConversion(storage, { q: parsed.raw, to: parsed.targetId });
    renderChips();
  }, REMEMBER_AFTER_MS);
}

function render() {
  const parsed = parseQuery(dom.query.value);
  dom.clear.hidden = dom.query.value === "";
  renderReading(parsed);
  renderResults(parsed);
  renderSuggestions(parsed);
  updateUrl(parsed);
  scheduleRemember(parsed);
}

function applyLanguage(next) {
  lang = next;
  say = sayIn(lang);
  document.documentElement.lang = lang;
  dom.title.textContent = say("ui.title");
  dom.tagline.textContent = say("ui.tagline");
  dom.query.setAttribute("aria-label", say("ui.inputLabel"));
  dom.clear.setAttribute("aria-label", say("ui.clear"));
  dom.suggestions.setAttribute("aria-label", say("ui.suggestions"));
  dom.langPicker.setAttribute("aria-label", say("ui.languageLabel"));
  dom.promptHeading.textContent = say("ui.emptyTitle");
  dom.promptHint.textContent = say("ui.emptyHint");
  dom.recentsHeading.textContent = say("ui.recentsTitle");
  dom.categoriesHeading.textContent = say("ui.categoriesTitle");
  dom.privacy.textContent = say("ui.privacy");
  dom.backLink.textContent = say("ui.backToProjects");
  for (const button of dom.langPicker.children) button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  renderDeployLine(dom.deployLine, readStamp(document), lang, say, escapeForDeployLine, "web-projects/unit-converter");
  renderChips();
  render();
}

function buildLanguagePicker() {
  dom.langPicker.replaceChildren(
    ...LANGUAGES.map((language) => {
      const button = element("button", null, language.label);
      button.type = "button";
      button.dataset.lang = language.code;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        saveLanguage(storage, language.code);
        applyLanguage(language.code);
      });
      return button;
    }),
  );
}

function onKeyDown(event) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (dom.suggestions.hidden) return;
    event.preventDefault();
    moveSuggestion(event.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (event.key === "Enter") {
    if (activeSuggestion >= 0 && offered[activeSuggestion]) {
      event.preventDefault();
      chooseUnit(offered[activeSuggestion]);
      return;
    }
    dom.query.blur();
    return;
  }
  if (event.key === "Escape") {
    if (!dom.suggestions.hidden) {
      event.preventDefault();
      closeSuggestions();
      render();
    }
  }
}

/**
 * Ask for today's rates once, in the background.
 *
 * A cached table less than half a day old is used as it is, so most visits ask
 * for nothing at all. When no service answers, the page keeps the snapshot
 * bundled into `units.js` and the note under the answers says so. It never goes
 * blank and it never silently shows a rate it cannot stand behind.
 */
async function loadRates() {
  const cached = readRates(storage);
  if (cached && !isStale(cached.date)) {
    liveRates = { ...cached, source: cached.source ?? "" };
    ratesState = "live";
    render();
    return;
  }
  const fresh = await fetchRates();
  if (fresh) {
    liveRates = fresh;
    ratesState = "live";
    saveRates(storage, fresh);
  } else if (cached) {
    // Older than we would like, but real rates beat a months-old snapshot.
    liveRates = { ...cached, source: cached.source ?? "" };
    ratesState = "live";
  } else {
    ratesState = "offline";
  }
  render();
}

function start() {
  const state = readState(location.search);
  linkedTarget = state.to;
  lang = pickLanguage(state.lang ?? readLanguage(storage), navigator.languages ?? [navigator.language]);

  buildLanguagePicker();
  applyLanguage(lang);

  if (state.q) dom.query.value = state.q;

  dom.query.addEventListener("input", () => {
    expanded = false;
    activeSuggestion = -1;
    render();
  });
  dom.query.addEventListener("keydown", onKeyDown);
  dom.query.addEventListener("focus", render);
  dom.query.addEventListener("blur", () => {
    // A moment's delay, so a click on a suggestion is not lost to the blur.
    setTimeout(() => {
      closeSuggestions();
      render();
    }, 120);
  });
  dom.clear.addEventListener("click", () => setQuery(""));
  dom.showAll.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });

  render();
  // Focus the box on a device with a keyboard already attached. On a phone it
  // would throw the on-screen keyboard up over the examples, which are the part
  // that teaches a first-time reader what they can type.
  if (!state.q && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    dom.query.focus({ preventScroll: true });
  }
  loadRates();
}

start();
