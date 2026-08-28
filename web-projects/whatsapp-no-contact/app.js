// DOM glue. All the logic worth testing lives in countries.js, phone.js and
// recents.js; this file only reads the page, calls those modules, and writes
// the result back.

import { findByDial, findByIso2, flagEmoji, searchCountries, regionFromLocale } from "./countries.js";
import {
  buildWhatsAppUrl,
  digitsOnly,
  formatForDisplay,
  normalizeNational,
  parseInternational,
  parseUrlState,
  serializeUrlState,
  validateNumber,
} from "./phone.js";
import { RECENTS_KEY, addRecent, deserializeRecents, serializeRecents } from "./recents.js";

// Shown when the number cannot be used yet. The key is the reason
// `validateNumber` reports.
const PROBLEM_TEXT = {
  "no-country": "Choose the country first.",
  empty: "Type the number, without the country code.",
  "too-short": "That number looks too short. Check the digits.",
  "too-long": "That number is too long. A number holds 15 digits at most, including the country code.",
};

// The country preselected when the browser gives no usable locale.
const FALLBACK_ISO2 = "US";

const STATUS_RESET_MS = 2200;

const form = document.getElementById("dial-form");
const phoneInput = document.getElementById("phone-input");
const hint = document.getElementById("hint");
const openButton = document.getElementById("open-button");
const copyButton = document.getElementById("copy-link");
const shareStatus = document.getElementById("share-status");
const countryTrigger = document.getElementById("country-trigger");
const countryFlag = document.getElementById("country-flag");
const countryDial = document.getElementById("country-dial");
const countryTriggerName = document.getElementById("country-trigger-name");
const countryPanel = document.getElementById("country-panel");
const countrySearch = document.getElementById("country-search");
const countryList = document.getElementById("country-list");
const countryEmpty = document.getElementById("country-empty");
const recentsSection = document.getElementById("recents");
const recentsList = document.getElementById("recents-list");
const clearRecentsButton = document.getElementById("clear-recents");

/** @type {?object} the selected country */
let selected = null;
/** @type {object[]} the countries the panel currently lists */
let listed = [];
/** @type {number} which listed country the keyboard is on, -1 for none */
let activeIndex = -1;
/** @type {Array<{dial: string, national: string}>} */
let recents = [];
let statusTimer = 0;

/* --- Storage (root ADR 0007: every access is wrapped) --- */

function readStoredRecents() {
  try {
    return window.localStorage.getItem(RECENTS_KEY);
  } catch {
    return null;
  }
}

function writeStoredRecents(list) {
  try {
    window.localStorage.setItem(RECENTS_KEY, serializeRecents(list));
  } catch {
    // Private mode, a full quota or disabled storage. The list still works for
    // this visit, it just does not survive a reload.
  }
}

function removeStoredRecents() {
  try {
    window.localStorage.removeItem(RECENTS_KEY);
  } catch {
    // Nothing to do: the list is cleared in memory either way.
  }
}

/* --- Current number --- */

/**
 * @returns {{dial: ?string, national: string}} what the page holds right now
 */
function currentState() {
  return { dial: selected === null ? null : selected.dial, national: phoneInput.value };
}

/* --- Rendering --- */

function renderTrigger() {
  countryFlag.textContent = selected === null ? "🌐" : flagEmoji(selected.iso2);
  countryDial.textContent = selected === null ? "+ ?" : `+${selected.dial}`;
  countryTriggerName.textContent = selected === null ? "Choose a country" : selected.name;
}

function renderNumber() {
  const state = currentState();
  const { valid, reason } = validateNumber(state);

  // The open control is a link. It carries an href only while the number is
  // complete, so an unusable number cannot be clicked or tabbed to.
  if (valid) {
    openButton.href = buildWhatsAppUrl(state);
    openButton.removeAttribute("aria-disabled");
  } else {
    openButton.removeAttribute("href");
    openButton.setAttribute("aria-disabled", "true");
  }
  copyButton.disabled = !valid;
  hint.classList.toggle("is-ready", valid);
  hint.classList.toggle("is-problem", !valid && reason !== "empty" && reason !== "no-country");

  if (!valid) {
    hint.textContent = PROBLEM_TEXT[reason] ?? "";
  } else {
    // Say so when the trunk zero was dropped, because the number shown then
    // differs from what the visitor typed.
    const droppedZero = digitsOnly(phoneInput.value) !== normalizeNational(phoneInput.value, state.dial);
    hint.textContent = droppedZero
      ? `${formatForDisplay(state)}  ·  leading 0 removed`
      : formatForDisplay(state);
  }

  syncUrl(state);
}

/**
 * Keep the number in the address bar, so the page URL is always shareable
 * (root ADR 0006). An incomplete number leaves no parameter behind.
 * @param {{dial: ?string, national: string}} state
 */
function syncUrl(state) {
  const query = serializeUrlState(state);
  try {
    window.history.replaceState(null, "", query === "" ? window.location.pathname : `?${query}`);
  } catch {
    // Opening the file directly (file://) can refuse a history write. The page
    // works without it; only the shareable URL is lost.
  }
}

function renderRecents() {
  recentsList.replaceChildren();
  for (const entry of recents) {
    const country = findByDial(entry.dial);
    if (country === null) continue;

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "recent-chip";

    const flag = document.createElement("span");
    flag.className = "flag";
    flag.setAttribute("aria-hidden", "true");
    flag.textContent = flagEmoji(country.iso2);

    const label = document.createElement("span");
    label.textContent = formatForDisplay(entry);

    chip.append(flag, label);
    chip.addEventListener("click", () => {
      selected = country;
      phoneInput.value = entry.national;
      renderTrigger();
      renderNumber();
      phoneInput.focus();
    });

    const item = document.createElement("li");
    item.append(chip);
    recentsList.append(item);
  }
  recentsSection.hidden = recentsList.childElementCount === 0;
}

function showStatus(message) {
  shareStatus.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    shareStatus.textContent = "";
  }, STATUS_RESET_MS);
}

/* --- Country panel --- */

function renderCountryList(query) {
  listed = searchCountries(query);
  countryEmpty.hidden = listed.length > 0;

  const fragment = document.createDocumentFragment();
  listed.forEach((country, index) => {
    const option = document.createElement("li");
    option.className = "country-option";
    option.id = `country-option-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(selected !== null && selected.iso2 === country.iso2));

    const flag = document.createElement("span");
    flag.className = "flag";
    flag.setAttribute("aria-hidden", "true");
    flag.textContent = flagEmoji(country.iso2);

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = country.name;

    const dial = document.createElement("span");
    dial.className = "dial";
    dial.textContent = `+${country.dial}`;

    option.append(flag, name, dial);
    option.addEventListener("click", () => chooseCountry(country));
    fragment.append(option);
  });
  countryList.replaceChildren(fragment);

  // Start on the selected country when the whole list is shown, and on the best
  // match once the visitor searches.
  const selectedIndex = listed.findIndex((country) => selected !== null && country.iso2 === selected.iso2);
  setActiveIndex(query.trim() === "" && selectedIndex !== -1 ? selectedIndex : listed.length > 0 ? 0 : -1);
}

function setActiveIndex(index) {
  activeIndex = index;
  const options = countryList.children;
  for (let i = 0; i < options.length; i++) {
    options[i].classList.toggle("active", i === index);
  }
  if (index >= 0 && index < options.length) {
    countrySearch.setAttribute("aria-activedescendant", options[index].id);
    options[index].scrollIntoView({ block: "nearest" });
  } else {
    countrySearch.removeAttribute("aria-activedescendant");
  }
}

function openPanel() {
  countryPanel.hidden = false;
  countryTrigger.setAttribute("aria-expanded", "true");
  countrySearch.value = "";
  renderCountryList("");
  countrySearch.focus();
}

function closePanel({ focusTrigger = false } = {}) {
  if (countryPanel.hidden) return;
  countryPanel.hidden = true;
  countryTrigger.setAttribute("aria-expanded", "false");
  countrySearch.removeAttribute("aria-activedescendant");
  if (focusTrigger) countryTrigger.focus();
}

function chooseCountry(country) {
  selected = country;
  renderTrigger();
  closePanel();
  renderNumber();
  // The number is the next thing to type, so go straight there.
  phoneInput.focus();
}

/* --- Events --- */

countryTrigger.addEventListener("click", () => {
  if (countryPanel.hidden) openPanel();
  else closePanel({ focusTrigger: true });
});

countrySearch.addEventListener("input", () => renderCountryList(countrySearch.value));

countrySearch.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      setActiveIndex(Math.min(activeIndex + 1, listed.length - 1));
      break;
    case "ArrowUp":
      event.preventDefault();
      setActiveIndex(Math.max(activeIndex - 1, 0));
      break;
    case "Home":
      event.preventDefault();
      setActiveIndex(listed.length > 0 ? 0 : -1);
      break;
    case "End":
      event.preventDefault();
      setActiveIndex(listed.length - 1);
      break;
    case "Enter":
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < listed.length) chooseCountry(listed[activeIndex]);
      break;
    case "Escape":
      event.preventDefault();
      closePanel({ focusTrigger: true });
      break;
    case "Tab":
      closePanel();
      break;
    default:
      break;
  }
});

// A click anywhere else closes the panel.
document.addEventListener("pointerdown", (event) => {
  if (countryPanel.hidden) return;
  if (!countryPanel.contains(event.target) && !countryTrigger.contains(event.target)) closePanel();
});

phoneInput.addEventListener("input", () => {
  // A number typed or pasted with its country code (+34 ... or 0034 ...) sets
  // the country itself and leaves only the national part in the field.
  const parsed = parseInternational(phoneInput.value);
  if (parsed !== null) {
    const country = findByDial(parsed.dial);
    if (country !== null) {
      if (selected === null || selected.dial !== parsed.dial) selected = country;
      phoneInput.value = parsed.national;
      renderTrigger();
    }
  }
  renderNumber();
});

// The browser opens the link itself. This only records the number, and runs
// before the new tab takes over.
openButton.addEventListener("click", () => {
  if (!openButton.hasAttribute("href")) return;
  recents = addRecent(recents, currentState());
  writeStoredRecents(recents);
  renderRecents();
});

/** Follow the open link, for the visitor who presses Enter instead. */
function launchChat() {
  if (openButton.hasAttribute("href")) openButton.click();
}

phoneInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  launchChat();
});

// The form holds no submit button, so this only catches a browser that submits
// on Enter anyway. It must never reload the page.
form.addEventListener("submit", (event) => {
  event.preventDefault();
  launchChat();
});

copyButton.addEventListener("click", async () => {
  const query = serializeUrlState(currentState());
  if (query === "") return;

  const link = `${window.location.href.split(/[?#]/)[0]}?${query}`;
  try {
    await navigator.clipboard.writeText(link);
    // Say what the link holds: root ADR 0006 allows personal data in URL state
    // only when the page is clear about it.
    showStatus("Copied. The link holds this number.");
  } catch {
    // No clipboard permission, or an insecure origin.
    showStatus("Copy it from the address bar");
  }
});

clearRecentsButton.addEventListener("click", () => {
  recents = [];
  removeStoredRecents();
  renderRecents();
});

/* --- Start --- */

function pickStartingCountry() {
  const fromUrl = parseUrlState(window.location.search);
  if (fromUrl.dial !== null) {
    const country = findByDial(fromUrl.dial);
    if (country !== null) {
      selected = country;
      phoneInput.value = fromUrl.national;
      return;
    }
  }

  const locales = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  for (const locale of locales) {
    const country = findByIso2(regionFromLocale(locale));
    if (country !== null) {
      selected = country;
      return;
    }
  }
  selected = findByIso2(FALLBACK_ISO2);
}

recents = deserializeRecents(readStoredRecents());
pickStartingCountry();
renderTrigger();
renderNumber();
renderRecents();

// Focus the number field on a device with a pointer. On touch that would open
// the keyboard before the visitor asked for it.
if (window.matchMedia("(hover: hover)").matches) phoneInput.focus();
