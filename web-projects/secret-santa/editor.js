// The list editor: the pure changes the create screen makes to a draft.
//
// A draft is { title, names, forbidden }. Each function returns a new draft and
// never changes the one it is given, so the screen can redraw from the result.
// Forbidden pairs point at people by their place in the list, so a removal
// renumbers every pair after the removed person.

import { cleanNames } from "./urlState.js";

/** Add the names in `text` (one, or a pasted list) at the end of the list. */
export function addPeople(draft, text) {
  return { ...draft, names: [...draft.names, ...cleanNames(text, draft.names)] };
}

/** Remove the person at `index`, with every pair that names them. */
export function removePerson(draft, index) {
  const shift = (i) => (i > index ? i - 1 : i);
  return {
    ...draft,
    names: draft.names.filter((_, i) => i !== index),
    forbidden: draft.forbidden
      .filter(([g, r]) => g !== index && r !== index)
      .map(([g, r]) => [shift(g), shift(r)]),
  };
}

/** True when `giver` may not give to `receiver`. */
export function isForbidden(draft, giver, receiver) {
  return draft.forbidden.some(([g, r]) => g === giver && r === receiver);
}

/**
 * Switch the pair "giver may not give to receiver" on or off. When `mutual` is
 * true, the mirror pair takes the same new state.
 */
export function toggleForbidden(draft, giver, receiver, mutual) {
  if (giver === receiver) return draft;
  const turnOn = !isForbidden(draft, giver, receiver);
  const pairs = mutual ? [[giver, receiver], [receiver, giver]] : [[giver, receiver]];
  const touched = (g, r) => pairs.some(([pg, pr]) => pg === g && pr === r);
  const forbidden = draft.forbidden.filter(([g, r]) => !touched(g, r));
  if (turnOn) forbidden.push(...pairs);
  return { ...draft, forbidden };
}

/** The people `giver` may not give to, in list order. */
export function forbiddenFor(draft, giver) {
  return draft.forbidden
    .filter(([g]) => g === giver)
    .map(([, r]) => r)
    .sort((a, b) => a - b);
}
