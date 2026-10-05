// The words the "deployed at" line uses, and the two helpers it needs.
//
// `deployStamp.js` takes a message lookup and an HTML escaper rather than
// holding text of its own, so a page with several languages can feed it a
// catalogue. This page has one language, so the catalogue is this table.
//
// It lives in its own file, and not inside `app.js`, so the tests can read it.
// A renamed key then fails here instead of showing up as a raw key on the page.

/** Every line the deploy footer can show, with the slots it fills in. */
export const DEPLOY_MESSAGES = {
  "ui.deployed": "Deployed {date} by pull request {pr}.",
  "ui.deployedUnknown": "This build carries no pull request stamp yet. See the {history}.",
  "ui.deployHistory": "change history",
};

/**
 * Look a message up and fill its slots.
 * An unknown key comes back as itself, which shows up loudly on the page.
 */
export function say(key, params = {}) {
  const template = DEPLOY_MESSAGES[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Make a string safe to put inside HTML. */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
