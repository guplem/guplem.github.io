// Telling one saved token from another.
//
// This is harder than it looks, and the board got it wrong twice.
//
// It first named a token by the owners it had found work in. That is a status,
// not a name: a token holding only the board repository found nothing, so it
// had no name at all.
//
// It then asked `GET /user/repos` and named the token by the owners of what
// came back. That answer is not the token's resource owner: it lists what the
// **person** is affiliated with, as far as the token can see, one page at a
// time. Two different tokens came back with overlapping owner lists and the
// same capped count, so the board showed a confident wrong name.
//
// GitHub does not expose a token's resource owner. So the reader names it, the
// board suggests a name from what it found, and the masked token is always
// shown so a name can be matched against GitHub's own list. See ADR 0007.

/** The part of a token that is never shown. */
export const MASK = "••••";

/** A token with almost all of it removed. Obviously a secret, so it needs no label. */
export function maskToken(token) {
  const clean = typeof token === "string" ? token.trim() : "";
  if (clean === "") return "";
  return clean.length <= 4 ? MASK : `${MASK}${clean.slice(-4)}`;
}

/**
 * A name to start from, which the reader can change.
 *
 * @param entry the saved token
 * @param index where it sits in the list, so a token that found nothing still
 *   gets a name a person can say out loud
 */
export function suggestedTokenName(entry, index = 0) {
  const owners = Array.isArray(entry?.owners) ? entry.owners.filter((one) => typeof one === "string" && one !== "") : [];
  return owners.length > 0 ? owners.join(", ") : `Token ${index + 1}`;
}

/**
 * The line under the name: which token this is, what it found, what it does.
 *
 * Finding nothing is a fact, not a fault. The token holding the notes
 * repository usually has no work assigned in it at all.
 */
export function describeTokenReach({ token, itemCount = 0 } = {}) {
  const count = Number.isFinite(itemCount) ? itemCount : 0;
  const found = count === 0 ? "no work found" : `${count} ${count === 1 ? "item" : "items"}`;
  return [maskToken(token), found, "reads your work"].filter((part) => part !== "").join(" · ");
}
