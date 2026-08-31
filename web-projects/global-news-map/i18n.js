// Every word the page says, in each language it speaks.
//
// One flat table of keys, each holding one entry per language, so a translation
// sits next to the text it translates. `i18n.test.js` fails when a key is missing
// in a language, or when the two versions of a sentence do not carry the same
// `{slots}`, so the two can never drift apart.

export const DEFAULT_LANGUAGE = "en";

/**
 * The languages the page speaks.
 *
 * The page shows no language picker. It follows the `lang` parameter in the
 * address bar, then the browser's own languages, then English. So a code needs
 * no label: nothing on screen ever names a language.
 */
export const LANGUAGE_CODES = ["en", "es"];

export const MESSAGES = {
  "app.title": { en: "Global News Map", es: "Mapa mundial de noticias" },
  "app.tagline": {
    en: "The day's news, pinned where it happened.",
    es: "Las noticias del día, marcadas donde ocurrieron.",
  },

  // --- the day being shown ---------------------------------------------------
  "day.previous": { en: "Previous day", es: "Día anterior" },
  "day.next": { en: "Next day", es: "Día siguiente" },
  "day.latest": { en: "Latest", es: "Lo último" },
  "day.showing": { en: "Showing {date}", es: "Mostrando {date}" },
  "day.pick": { en: "Choose a day", es: "Elegir un día" },

  // --- what the map found ---------------------------------------------------
  "status.loading": { en: "Reading the day's news…", es: "Leyendo las noticias del día…" },
  "status.locating": { en: "Looking up where it happened…", es: "Buscando dónde ocurrió…" },
  "status.counts": {
    en: "{placed} stories on the map, {unplaced} without a place.",
    es: "{placed} noticias en el mapa, {unplaced} sin lugar.",
  },
  "status.empty": {
    en: "Wikipedia has no news written for this day yet. Try the day before.",
    es: "Wikipedia todavía no tiene noticias de este día. Prueba el día anterior.",
  },
  "status.failed": {
    en: "Could not reach Wikipedia. Check your connection and try again.",
    es: "No se pudo conectar con Wikipedia. Revisa tu conexión e inténtalo de nuevo.",
  },
  "status.retry": { en: "Try again", es: "Intentar de nuevo" },

  // --- the map --------------------------------------------------------------
  "map.label": { en: "World map of the day's news", es: "Mapa mundial de las noticias del día" },
  "map.zoomIn": { en: "Zoom in", es: "Acercar" },
  "map.zoomOut": { en: "Zoom out", es: "Alejar" },
  "map.reset": { en: "Whole world", es: "Todo el mundo" },

  // --- a story --------------------------------------------------------------
  "story.sources": { en: "Sources", es: "Fuentes" },
  "story.readMore": { en: "Read {title} on Wikipedia", es: "Leer {title} en Wikipedia" },
  "story.close": { en: "Close", es: "Cerrar" },
  "story.listHeading": { en: "All the day's stories", es: "Todas las noticias del día" },
  "story.unplacedHeading": { en: "Named no place", es: "Sin lugar indicado" },
  "story.unplacedWhy": {
    en: "Wikipedia geotags places, not ideas. These stories link to neither a town nor a country.",
    es: "Wikipedia geolocaliza lugares, no ideas. Estas noticias no enlazan ni un pueblo ni un país.",
  },
  "story.selectHint": { en: "Pick a pin to read a story.", es: "Elige un marcador para leer una noticia." },
  // The panel above the day's list, holding every story at the chosen location.
  "selected.label": { en: "Selected location", es: "Lugar seleccionado" },
  "selected.count": { en: "{count} stories here", es: "{count} noticias aquí" },
  // One marker can cover more than one place. Without this the other places on
  // a pin are unreachable in practice, because nothing hints that they exist.
  "selected.alsoOnPin": {
    en: "This pin also covers {count} more at other places. Choose it again to see them.",
    es: "Este marcador también cubre {count} más en otros lugares. Elígelo otra vez para verlas.",
  },

  // --- credit ---------------------------------------------------------------
  "credit.wikipedia": {
    en: "News text from the {portal} on Wikipedia, used under {licence}.",
    es: "Texto de noticias del {portal} de Wikipedia, usado bajo {licence}.",
  },
  "credit.portal": { en: "Current events portal", es: "portal de actualidad" },
  "credit.licence": { en: "CC BY-SA 4.0", es: "CC BY-SA 4.0" },
  "credit.coastlines": {
    en: "Coastlines from Natural Earth, public domain.",
    es: "Costas de Natural Earth, dominio público.",
  },
  "credit.privacy": {
    en: "The page talks only to Wikipedia and Wikidata. Nothing about you is stored or sent anywhere else.",
    es: "La página solo habla con Wikipedia y Wikidata. Nada sobre ti se guarda ni se envía a otro sitio.",
  },

  // --- the deployed-at line (root ADR 0013) ---------------------------------
  "ui.deployed": {
    en: "Deployed {date} by pull request {pr}.",
    es: "Desplegado el {date} por la pull request {pr}.",
  },
  // Shown when the page carries no stamp, which happens only when it is opened
  // straight from the repository rather than from the published site.
  "ui.deployedUnknown": {
    en: "Published from the main branch. See {history}.",
    es: "Publicado desde la rama main. Ver {history}.",
  },
  "ui.deployHistory": { en: "what changed", es: "qué cambió" },
  "ui.backToProjects": { en: "All web projects", es: "Todos los proyectos web" },
};

/**
 * Fill a message's `{slots}` from `params`.
 * A slot with no value is left as it was, so a missing one shows up on screen
 * instead of turning into an empty gap nobody notices.
 */
export function fill(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole));
}

/**
 * Look one message up.
 * Falls back to the default language, then to the key itself, so a missing
 * translation is visible rather than blank.
 */
export function translate(key, params = {}, lang = DEFAULT_LANGUAGE) {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return fill(entry[lang] ?? entry[DEFAULT_LANGUAGE] ?? key, params);
}

/** A `t`-style lookup bound to one language. */
export function makeSay(lang) {
  return (key, params) => translate(key, params, lang);
}

/** The language to start in: the one asked for, else the browser's, else English. */
export function pickLanguage(requested, browserLanguages = []) {
  if (LANGUAGE_CODES.includes(requested)) return requested;
  for (const tag of browserLanguages) {
    const code = String(tag ?? "")
      .toLowerCase()
      .split("-")[0];
    if (LANGUAGE_CODES.includes(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
