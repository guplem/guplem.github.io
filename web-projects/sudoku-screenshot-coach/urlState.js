// The puzzle lives in the address bar, so any grid can be shared as a link.
// Root ADR 0006 sets this convention for shareable web-projects.
//
//   ?p=53..7....6..195...   81 characters, a digit or a dot per cell
//   &m=solution             the view mode, left out when it is the default
//   &lang=es                the language, left out when it is the default

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "./i18n.js";

/** The view the page opens in when the link does not say otherwise. */
export const DEFAULT_MODE = "hint";
const MODES = ["hint", "solution"];

/** True when the text is exactly 81 cells of digits and dots. */
function isPuzzleText(text) {
  return typeof text === "string" && /^[1-9.]{81}$/.test(text);
}

/**
 * Read the state out of a query string.
 * @param {string} search the part of the URL from `?` onwards
 * @returns {{puzzle: string|null, mode: string, lang: string|null}}
 *   `puzzle` uses dots for empty cells. `lang` is null when the link does not
 *   name one, which lets the page follow the browser instead.
 */
export function parseUrlState(search) {
  const params = new URLSearchParams(search);
  const raw = (params.get("p") ?? "").replace(/0/g, ".");
  const mode = params.get("m");
  const lang = params.get("lang");
  return {
    puzzle: isPuzzleText(raw) ? raw : null,
    mode: MODES.includes(mode) ? mode : DEFAULT_MODE,
    lang: LANGUAGE_CODES.includes(lang) ? lang : null,
  };
}

/**
 * Write the state as a query string. An empty grid and the default mode are left
 * out, so a shared link stays as short as it can be.
 * @returns {string} a string starting with `?`, or `""` when there is nothing to share
 */
export function serializeUrlState({ puzzle, mode = DEFAULT_MODE, lang = null }) {
  const cleaned = typeof puzzle === "string" ? puzzle.replace(/0/g, ".") : "";
  const params = [];
  if (isPuzzleText(cleaned) && /[1-9]/.test(cleaned)) params.push(`p=${cleaned}`);
  if (params.length > 0 && MODES.includes(mode) && mode !== DEFAULT_MODE) params.push(`m=${mode}`);
  if (LANGUAGE_CODES.includes(lang) && lang !== DEFAULT_LANGUAGE) params.push(`lang=${lang}`);
  return params.length > 0 ? `?${params.join("&")}` : "";
}
