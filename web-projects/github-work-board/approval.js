// Whether a token may be waiting for an organisation to approve it, and the
// page where that organisation's owners approve it.
//
// An organisation can ask its owners to approve each fine-grained token made
// for it. Until an owner does, the token signs in and reads public data only.
// Every call answers 200, so the board found nothing and said nothing, and the
// reader had no route from an empty board to the cause (ADR 0041).
//
// **GitHub has no call that says "pending".** The list of requests needs an
// owner's credential, and `GET /user/orgs` answers an empty list to every
// fine-grained token. So the board reads the one thing a pending token cannot
// hide: it reaches no private repository. A personal token always reaches the
// reader's own private repositories, and an approved organisation token reaches
// the organisation's. The answer is a "may", never a "does".
//
// **GitHub does not say which organisation the token is for either.** A
// membership is private by default, so the public list of organisations is
// often empty. The reader then types the name once, and `settings.js` keeps it
// beside the token.

/** The reader's own list of fine-grained tokens, where GitHub shows each owner and request. */
export const TOKEN_STATUS_URL = "https://github.com/settings/personal-access-tokens";

/** GitHub's rule for a login: letters, digits and single inner hyphens, at most 39 characters. */
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/**
 * Whether the board spends one more call to ask about approval.
 *
 * Only a token that found no work of any kind. A token that found work reaches
 * where the work lives, so it is approved or needs no approval.
 */
export function shouldAskAboutApproval({ openCount = 0, finishedCount = 0, reviewCount = 0 } = {}) {
  return !(openCount > 0) && !(finishedCount > 0) && !(reviewCount > 0);
}

/**
 * Whether the answer to "one private repository" came back empty.
 *
 * A failed call proves nothing, so it is never read as "pending": the failure
 * already says what went wrong on its own row in Settings.
 */
export function readsOnlyPublicData(answer) {
  return answer?.ok === true && Array.isArray(answer.data) && answer.data.length === 0;
}

/** Whether a text can be an organisation's login on GitHub. */
export function isOrganisationName(text) {
  return typeof text === "string" && LOGIN.test(text.trim());
}

/** The page where the organisation's owners approve a token, or an empty string for a bad name. */
export function approvalPageUrl(organisation) {
  if (!isOrganisationName(organisation)) return "";
  return `https://github.com/organizations/${organisation.trim()}/settings/personal-access-token-requests`;
}

/**
 * The organisations the token may wait on, best guess first.
 *
 * The name the reader typed wins, because they know it is right. Otherwise the
 * organisations the person belongs to in public, without the person's own
 * login, without repeats and without names that are not logins.
 */
export function approvalOrganisations({ saved = "", publicOrganisations = [], login = "" } = {}) {
  if (isOrganisationName(saved)) return [saved.trim()];
  const own = typeof login === "string" ? login.toLowerCase() : "";
  const seen = new Set();
  const found = [];
  for (const name of Array.isArray(publicOrganisations) ? publicOrganisations : []) {
    if (!isOrganisationName(name)) continue;
    const key = name.toLowerCase();
    if (key === own || seen.has(key)) continue;
    seen.add(key);
    found.push(name);
  }
  return found;
}
