// Read a Spanish Wiktionary page (its wikitext, the markup the page is written in).
//
// This one module decides two things, so the two can never disagree:
// - at build time, `tools/buildWordList.js` asks `isEligibleWord` about every
//   page in the dump, to choose the words in `words.js`;
// - at run time, the page asks `spainEntries` which senses of one word to show.
//
// A sense is "usable in Spain" when no region label excludes Spain and no usage
// label marks it old, rare or cultured. See ADR 0001.

/** Usage labels that mark a sense most people in Spain would never use. */
export const EXCLUDED_USES = new Set([
  "anticuado",
  "antiguo",
  "arcaico",
  "desusado",
  "obsoleto",
  "poco usado",
  "infrecuente",
  "raro",
  "culto",
  "literario",
  "poético",
  "académico",
  "germanía",
  "rural",
  "lunfardismo",
]);

/** Usage labels a sense may carry, but a word may not rest on alone. */
export const OFFENSIVE_USES = new Set(["vulgar", "malsonante"]);

/** Parts of speech the list draws from. Grammar words (articles, conjunctions) stay out. */
export const WORD_POS = [
  "sustantivo",
  "adjetivo",
  "verbo",
  "adverbio",
  "interjección",
];

/** The region label that keeps a regional sense. */
const SPAIN = "España";

/**
 * Cut the Spanish section out of a page.
 * @param {string} wikitext the whole page
 * @returns {string|null} the section, or null when the page has none
 */
export function spanishSection(wikitext) {
  const start = wikitext.search(/^==\s*\{\{lengua\|es\}\}\s*==\s*$/m);
  if (start < 0) return null;
  const rest = wikitext.slice(start);
  const firstBreak = rest.indexOf("\n");
  const next = rest.slice(firstBreak + 1).search(/^==[^=]/m);
  return next < 0 ? rest : rest.slice(0, firstBreak + 1 + next);
}

/** Decode the entities a dump or an API answer carries. */
function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Split a template's inside into its unnamed arguments. */
function positional(inside) {
  return inside
    .split("|")
    .slice(1)
    .filter((part) => !part.includes("="))
    .map((part) => part.trim());
}

/**
 * Turn the markup of one definition into plain text.
 * @param {string} text the definition as it is in the wikitext
 */
export function cleanDefinition(text) {
  let out = decodeEntities(text);
  out = out.replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  // Templates, innermost first, so a template inside a template resolves.
  for (let guard = 0; guard < 10 && out.includes("{{"); guard++) {
    out = out.replace(/\{\{([^{}]*)\}\}/g, (match, inside) => {
      const name = inside.split("|")[0].trim();
      const args = positional(inside);
      if (name === "plm") {
        const word = args[0] ?? "";
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      if (name === "l" || name === "l+") return args[1] ?? "";
      if (name === "impropia") return args[0] ?? "";
      return "";
    });
  }
  out = out.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
  out = out.replace(/'{2,}/g, "");
  out = out.replace(/<[^>]+>/g, "");
  return out.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}

/** Read a part-of-speech header, or null when the line is not one. */
function readHeader(line) {
  const match = line.match(/^(={3,5})\s*(.*?)\s*\1\s*$/);
  if (!match) return null;
  const title = match[2];
  const template = title.match(/^\{\{([^|}]+)\|es\b/);
  if (template) return { pos: template[1].trim(), lemma: true };
  if (/^forma\b/i.test(title)) return { pos: title.toLowerCase(), lemma: false };
  return { pos: null, lemma: false };
}

/** Read the unnamed arguments of a label template on its own line. */
function readLabel(line, name) {
  const match = line.match(new RegExp(`^\\{\\{${name}\\|(.*)\\}\\}\\s*$`));
  return match ? positional(`${name}|${match[1]}`).filter(Boolean) : null;
}

/**
 * Read every part of speech in the Spanish section, with its numbered senses.
 * @param {string} wikitext the whole page
 * @returns {{pos: string, lemma: boolean, senses: {number: number, topic: string, text: string, regions: string[], uses: string[]}[]}[]}
 */
export function parseEntries(wikitext) {
  const section = spanishSection(wikitext);
  if (!section) return [];
  const entries = [];
  let entry = null;
  let sense = null;
  for (const line of section.split("\n")) {
    const header = readHeader(line);
    if (header) {
      sense = null;
      entry = header.pos ? { pos: header.pos, lemma: header.lemma, senses: [] } : null;
      if (entry) entries.push(entry);
      continue;
    }
    if (!entry) continue;
    const senseLine = line.match(/^;\s*(\d+)\s*([^:]*?)\s*:\s*(.*)$/);
    if (senseLine) {
      const topic = senseLine[2].match(/\{\{csem\|([^}|]*)/)?.[1] ?? "";
      sense = { number: Number(senseLine[1]), topic, text: cleanDefinition(senseLine[3]), regions: [], uses: [] };
      entry.senses.push(sense);
      continue;
    }
    if (!sense) continue;
    const regions = readLabel(line, "ámbito");
    if (regions) sense.regions.push(...regions);
    const uses = readLabel(line, "uso");
    if (uses) sense.uses.push(...uses.map((use) => use.toLowerCase()));
  }
  return entries;
}

/** True when a sense is one a speaker in Spain would use. */
export function isUsableInSpain(sense) {
  if (sense.regions.length > 0 && !sense.regions.includes(SPAIN)) return false;
  return !sense.uses.some((use) => EXCLUDED_USES.has(use));
}

/** False for a sense whose whole definition was a template this reader drops. */
function hasText(sense) {
  return /\p{L}/u.test(sense.text);
}

/** Every lemma entry, with only the senses usable in Spain; empty entries dropped. */
export function spainEntries(wikitext) {
  return parseEntries(wikitext)
    .filter((entry) => entry.lemma)
    .map((entry) => ({ ...entry, senses: entry.senses.filter((sense) => hasText(sense) && isUsableInSpain(sense)) }))
    .filter((entry) => entry.senses.length > 0);
}

/** True when the part of speech is one the list draws from. */
function isWordPos(pos) {
  return WORD_POS.some((kind) => pos === kind || pos.startsWith(`${kind} `));
}

/** A plural or a feminine form. A verb form is not one: "casa" is also a form of "casar". */
function isNominalForm(entry) {
  return /^forma (sustantiva|adjetiva)/.test(entry.pos);
}

/**
 * True when the word belongs in the list: a noun, adjective, verb, adverb or
 * interjection with at least one sense usable in Spain that is not offensive,
 * and not a plural or a feminine form of another word.
 */
export function isEligibleWord(wikitext) {
  if (parseEntries(wikitext).some(isNominalForm)) return false;
  return spainEntries(wikitext).some(
    (entry) =>
      isWordPos(entry.pos) &&
      entry.senses.some((sense) => !sense.uses.some((use) => OFFENSIVE_USES.has(use))),
  );
}

/** Templates that write "form of the verb X", with X as their first unnamed argument. */
const VERB_FORM_TEMPLATES = new Set(["forma verbo", "f.v", "participio", "gerundio", "infinitivo"]);

/**
 * Name the verbs this page is an inflected form of, in page order, each once.
 * @param {string} wikitext the whole page
 */
export function verbFormsOf(wikitext) {
  const section = spanishSection(wikitext);
  if (!section) return [];
  const verbs = [];
  for (const match of section.matchAll(/^;\s*\d+[^:]*:\s*\{\{([^|}]+)\|([^}]*)\}\}/gm)) {
    if (!VERB_FORM_TEMPLATES.has(match[1].trim())) continue;
    const verb = positional(`${match[1]}|${match[2]}`)[0];
    if (verb && !verbs.includes(verb)) verbs.push(verb);
  }
  return verbs;
}

/**
 * True when people say this word mostly as a form of a verb, because that verb
 * is more frequent than the word. "pongo" is a noun (an ape), but people say it
 * as a form of "poner"; "casa" is a form of "casar", but "casa" is more frequent.
 * @param {string} word the page title
 * @param {string} wikitext the whole page
 * @param {(word: string) => number} rankOf the word's place in the frequency list, 1 = most frequent
 */
export function isFormOfCommonerVerb(word, wikitext, rankOf) {
  return verbFormsOf(wikitext).some((verb) => rankOf(verb) < rankOf(word));
}

/**
 * True when a word from the frequency list is worth looking up at all: plain
 * lower-case letters, three or more, and not an adverb made with "-mente".
 */
export function isCandidate(word) {
  if (word.length < 3 || !/^[a-záéíóúüñ]+$/.test(word)) return false;
  return !(word.endsWith("mente") && word.length > "mente".length);
}
