// DOM glue for the random-word page.
//
// Everything worth testing lives in `pick.js` (choosing, links) and
// `wikitext.js` (reading the definition). This file only wires them to the
// page. It writes text with `textContent`; the deploy line is the one
// `innerHTML`, through its own escaper.

import { readStamp, renderDeployLine } from "./deployStamp.js";
import { sayIn } from "./i18n.js";
import { apiUrl, pickWord, raeUrl, searchForWord, wiktionaryUrl, wordFromSearch } from "./pick.js";
import { spainEntries } from "./wikitext.js";
import { WORDS } from "./words.js";

/** The most senses shown per part of speech; the links lead to the rest. */
const MAX_SENSES = 6;

const dom = {
  word: document.getElementById("word"),
  toggle: document.getElementById("toggle"),
  next: document.getElementById("next"),
  definition: document.getElementById("definition"),
  status: document.getElementById("status"),
  entries: document.getElementById("entries"),
  wiktionaryLink: document.getElementById("wiktionary-link"),
  raeLink: document.getElementById("rae-link"),
  deployLine: document.getElementById("deploy-line"),
};

const escapeForDeployLine = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One request per word per visit: the answer is kept, a failure is not. */
const definitions = new Map();

let current = null;

function fetchEntries(word) {
  if (!definitions.has(word)) {
    const request = fetch(apiUrl(word))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => spainEntries(data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? ""));
    request.catch(() => definitions.delete(word));
    definitions.set(word, request);
  }
  return definitions.get(word);
}

function renderEntries(entries) {
  dom.entries.replaceChildren();
  for (const entry of entries) {
    const pos = document.createElement("h2");
    pos.className = "pos";
    pos.textContent = entry.pos;
    const list = document.createElement("ol");
    list.className = "senses";
    for (const sense of entry.senses.slice(0, MAX_SENSES)) {
      const item = document.createElement("li");
      if (sense.topic) {
        const topic = document.createElement("span");
        topic.className = "topic";
        topic.textContent = `${sense.topic}. `;
        item.append(topic);
      }
      item.append(sense.text);
      list.append(item);
    }
    dom.entries.append(pos, list);
  }
}

async function loadDefinition(word) {
  dom.status.textContent = "Buscando la definición…";
  dom.entries.replaceChildren();
  try {
    const entries = await fetchEntries(word);
    if (word !== current) return;
    dom.status.textContent = entries.length ? "" : "El Wikcionario no tiene una definición de uso en España para esta palabra.";
    renderEntries(entries);
  } catch {
    if (word !== current) return;
    dom.status.textContent = "No se ha podido cargar la definición. Revisa la conexión o usa los enlaces de abajo.";
  }
}

function setOpen(open) {
  dom.definition.hidden = !open;
  dom.toggle.setAttribute("aria-expanded", String(open));
  dom.toggle.textContent = open ? "Ocultar definición" : "Mostrar definición";
  if (open) loadDefinition(current);
}

function showWord(word) {
  current = word;
  dom.word.textContent = word;
  dom.wiktionaryLink.href = wiktionaryUrl(word);
  dom.raeLink.href = raeUrl(word);
  document.title = `${word} · Palabra al azar · Guillem Poy`;
  setOpen(false);
}

dom.toggle.addEventListener("click", () => setOpen(dom.definition.hidden));

dom.next.addEventListener("click", () => {
  const word = pickWord(WORDS, Math.random, current);
  history.pushState(null, "", searchForWord(word));
  showWord(word);
});

// The back button walks through the words already seen.
window.addEventListener("popstate", () => {
  const word = wordFromSearch(location.search, WORDS);
  if (word) showWord(word);
});

const first = wordFromSearch(location.search, WORDS) ?? pickWord(WORDS);
history.replaceState(null, "", searchForWord(first));
showWord(first);
renderDeployLine(dom.deployLine, readStamp(document), "es", sayIn("es"), escapeForDeployLine, "web-projects/spanish-random-word");
