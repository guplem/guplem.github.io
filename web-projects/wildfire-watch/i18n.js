// The page's message catalogue. English only for now, except the deploy line,
// which the shared deploy-stamp tests also read in Spanish.

export const MESSAGES = {
  "ui.deployed": { en: "Deployed on {date} by pull request {pr}.", es: "Publicado el {date} por la pull request {pr}." },
  "ui.deployedUnknown": {
    en: "This copy carries no deploy stamp. See the {history}.",
    es: "Esta copia no lleva sello de publicación. Mira el {history}.",
  },
  "ui.deployHistory": { en: "change history", es: "historial de cambios" },
};

/** Look up a message and fill its `{name}` slots. */
export function say(key, params = {}, lang = "en") {
  const text = MESSAGES[key]?.[lang] ?? MESSAGES[key]?.en ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
