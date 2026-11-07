// The message the organiser copies or shares together with the link.
//
// The organiser picks the language of the message on the share screen, which
// can differ from the language of the page. The link sits alone on the last
// line, because chat apps turn a line that is only a URL into a link.

import { translate } from "./i18n.js";

/** The message to send to the group, in `lang`. */
export function shareMessage(lang, { title, url }) {
  const name = title?.trim() || translate(lang, "app.name");
  return `${translate(lang, "share.message", { title: name })}\n${url}`;
}

/** A link that opens WhatsApp with `text` already written. */
export function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
