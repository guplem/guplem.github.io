// The page's messages.
//
// The page speaks Spanish only, because it shows Spanish words to Spanish
// speakers. The catalogue still keeps the `{ en, es }` shape that the copied
// `deployStamp.js` and its test expect, so the file stays a plain copy.

export const MESSAGES = {
  "ui.deployed": { en: "Deployed {date} by pull request {pr}.", es: "Desplegado el {date} por la pull request {pr}." },
  "ui.deployedUnknown": { en: "Published from the main branch. See {history}.", es: "Publicado desde la rama main. Ver {history}." },
  "ui.deployHistory": { en: "what changed", es: "qué cambió" },
};

/** Look up a message and fill its `{name}` slots. An unknown key comes back as itself. */
export function t(key, lang = "es", params = {}) {
  const text = MESSAGES[key]?.[lang] ?? MESSAGES[key]?.es ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** A lookup bound to one language, in the shape `renderDeployLine` takes. */
export const sayIn = (lang) => (key, params) => t(key, lang, params);
