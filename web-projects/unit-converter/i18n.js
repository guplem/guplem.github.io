// Every word the page says, in each language it speaks.
//
// The catalogue is one flat table of keys. Each key holds one entry per
// language, so a translation sits next to the text it translates and a missing
// one is easy to spot. `i18n.test.js` fails when a key is missing in any
// language, so the two can never drift apart.
//
// Placeholders are written `{name}` and filled by `t`. The sentences are built
// so that no translation needs its arguments in a different order from the
// English one, which keeps the page free of language rules.
//
// Unit names are not here. They live beside each unit in `units.js`, because a
// unit and what it is called are one thing, and splitting them would mean
// editing two files to add a unit.

export const DEFAULT_LANGUAGE = "en";

/** The languages the page offers, in the order the picker shows them. */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export const MESSAGES = {
  // --- the page itself --------------------------------------------------------
  "ui.title": { en: "Convert anything", es: "Convierte lo que sea" },
  "ui.tagline": {
    en: "Type an amount and a unit. Every answer appears at once.",
    es: "Escribe una cantidad y una unidad. Todas las respuestas aparecen a la vez.",
  },
  "ui.placeholder": { en: "100 km", es: "100 km" },
  "ui.inputLabel": { en: "Amount and unit to convert", es: "Cantidad y unidad a convertir" },
  "ui.clear": { en: "Clear", es: "Borrar" },
  "ui.languageLabel": { en: "Language", es: "Idioma" },

  // --- what the page understood ----------------------------------------------
  "ui.reading": { en: "Reading {amount}", es: "Interpretado como {amount}" },
  "ui.results": { en: "Results", es: "Resultados" },
  "ui.target": { en: "You asked for", es: "Lo que pediste" },
  "ui.showAll": { en: "Show {n} more units", es: "Ver {n} unidades más" },
  "ui.showFewer": { en: "Show fewer", es: "Ver menos" },
  "ui.suggestions": { en: "Matching units", es: "Unidades que coinciden" },
  // The word that goes between an amount and the unit asked for. The page
  // writes it into the input box when a target is chosen, so it has to be a
  // word the parser reads back: see SEPARATORS in `parse.js`.
  "ui.toWord": { en: "to", es: "a" },

  // --- prompts, when there is nothing to show --------------------------------
  "ui.emptyTitle": { en: "What are you converting?", es: "¿Qué quieres convertir?" },
  "ui.emptyHint": {
    en: "Type it however you say it. All of these work:",
    es: "Escríbelo como lo dirías. Todo esto funciona:",
  },
  "ui.categoriesTitle": { en: "Or start from a kind of thing", es: "O empieza por un tipo de medida" },
  "ui.recentsTitle": { en: "Recent", es: "Recientes" },
  "ui.noUnit": {
    en: "No unit is called “{text}”.",
    es: "Ninguna unidad se llama «{text}».",
  },
  "ui.noUnitHint": {
    en: "Try km, kg, °C, GB, mph or USD.",
    es: "Prueba con km, kg, °C, GB, mph o USD.",
  },
  "ui.needUnit": { en: "Now add a unit.", es: "Ahora añade una unidad." },

  // --- copying and sharing ----------------------------------------------------
  "ui.copyValue": { en: "Copy {value}", es: "Copiar {value}" },
  "ui.copied": { en: "Copied {value}", es: "Copiado {value}" },
  "ui.copyFailed": { en: "Could not copy. Select the number instead.", es: "No se pudo copiar. Selecciona el número." },
  "ui.useAsSource": { en: "Convert from {unit}", es: "Convertir desde {unit}" },
  "ui.shareLink": { en: "Copy link", es: "Copiar enlace" },
  "ui.shareCopied": { en: "Link copied", es: "Enlace copiado" },
  "ui.swapped": { en: "Now converting from {unit}", es: "Ahora se convierte desde {unit}" },

  // --- exchange rates ---------------------------------------------------------
  "ui.ratesLoading": { en: "Getting today's exchange rates…", es: "Obteniendo los cambios de hoy…" },
  "ui.ratesLive": { en: "Exchange rates from {date}.", es: "Cambios del {date}." },
  "ui.ratesOffline": {
    en: "Live rates are unavailable, so these come from the copy built into the page on {date}.",
    es: "No hay cambios en directo, así que estos vienen de la copia incluida en la página el {date}.",
  },
  "ui.ratesSource": { en: "Source: {name}", es: "Fuente: {name}" },

  // --- footer -----------------------------------------------------------------
  "ui.privacy": {
    en: "Everything is worked out in your browser. The only thing this page fetches is the exchange-rate table.",
    es: "Todo se calcula en tu navegador. Lo único que esta página descarga es la tabla de cambios.",
  },
  "ui.backToProjects": { en: "All web projects", es: "Todos los proyectos web" },
  "ui.deployed": { en: "Deployed on {date} by pull request {pr}.", es: "Publicado el {date} por la pull request {pr}." },
  "ui.deployedUnknown": {
    en: "This copy carries no deploy stamp. See the {history}.",
    es: "Esta copia no lleva sello de publicación. Consulta el {history}.",
  },
  "ui.deployHistory": { en: "change history", es: "historial de cambios" },
};

/**
 * Look one message up and fill its placeholders.
 *
 * A key with no entry comes back as the key itself. That is deliberate: a
 * visible `ui.something` in the interface is found in one glance, and an empty
 * string is not.
 *
 * @param {string} key a key of MESSAGES
 * @param {string} lang the language to answer in
 * @param {Record<string, string|number>} [params] values for the `{name}` slots
 */
export function t(key, lang = DEFAULT_LANGUAGE, params = {}) {
  const entry = MESSAGES[key];
  const text = entry?.[lang] ?? entry?.[DEFAULT_LANGUAGE] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** A `t` bound to one language, which is what the page passes around. */
export const sayIn = (lang) => (key, params) => t(key, lang, params);

/** The language to start in: the one asked for, else the browser's, else English. */
export function pickLanguage(asked, browserLanguages = []) {
  if (LANGUAGE_CODES.includes(asked)) return asked;
  for (const candidate of browserLanguages) {
    const code = String(candidate).slice(0, 2).toLowerCase();
    if (LANGUAGE_CODES.includes(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
