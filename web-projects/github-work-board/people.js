// The people on a card, and what the board is waiting on each of them for.
//
// Two cards show two different sets of people, because the reader is asking a
// different question of each (ADR 0028):
//
// - On a **review card**, the people are the pull request's assignees: whose
//   work is this that I am being asked to read.
// - On the reader's **own card**, the people are the ones in the review: who
//   is blocking this, and who can I chase.
//
// **The second set is not "the pending review requests".** GitHub drops
// somebody from `reviewRequests` the moment they review, so a pull request
// held up by one reviewer who asked for changes has no pending request at all.
// Drawing only pending requests leaves that card empty, which is exactly the
// card the reader needs a face on. So the two lists are read together.

/** Asked to review, and has not answered. The board is waiting on them. */
export const ASKED = "asked";

/** Asked for changes. The board is waiting on the reader. */
export const CHANGES_REQUESTED = "changes-requested";

/** Approved. Nothing is waiting on them. */
export const APPROVED = "approved";

// The order the reader reads them in: what blocks them, then what they can
// chase, then what is already done.
const ORDER = [CHANGES_REQUESTED, ASKED, APPROVED];

const VERDICTS = new Map([
  ["CHANGES_REQUESTED", CHANGES_REQUESTED],
  ["APPROVED", APPROVED],
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * One person, or null when what was handed in is not one.
 *
 * A review can be asked of a team, and the query selects only User fields, so
 * a team arrives as an object with nothing in it. The login is the one thing
 * every person has, so it is what decides.
 */
export function readPerson(raw) {
  if (!raw || typeof raw !== "object") return null;
  const login = text(raw.login);
  if (login === "") return null;
  // The picture goes straight into `img.src`, so only a real picture address
  // is kept. Anything else is dropped and the initials are drawn instead
  // (ADR 0001).
  const picture = text(raw.avatarUrl) || text(raw.avatar_url);
  return { login, name: text(raw.name) || login, avatarUrl: picture.startsWith("https://") ? picture : "" };
}

/** Up to two letters, for the circle a picture has not arrived in. */
export function initialsOf(person) {
  const from = text(person?.name) || text(person?.login);
  const words = from.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0][0];
  return letters.toUpperCase();
}

/**
 * Everybody in this pull request's review, in the order the reader needs them.
 *
 * Somebody who asked for changes and was then asked to look again counts as
 * asked: the board reads that pull request as awaiting review for the same
 * reason (ADR 0011).
 *
 * @param requests the `reviewRequests` connection from the graph
 * @param reviews the `latestOpinionatedReviews` connection from the graph
 */
export function reviewPeople(requests, reviews) {
  const byLogin = new Map();

  for (const node of Array.isArray(reviews?.nodes) ? reviews.nodes : []) {
    const state = VERDICTS.get(node?.state);
    const person = readPerson(node?.author);
    // A comment is not an opinion about whether the work can land.
    if (!state || !person) continue;
    byLogin.set(person.login, { ...person, state });
  }

  // After the reviews, so that being asked again wins over the older verdict.
  for (const node of Array.isArray(requests?.nodes) ? requests.nodes : []) {
    const person = readPerson(node?.requestedReviewer);
    if (!person) continue;
    byLogin.set(person.login, { ...person, state: ASKED });
  }

  const found = [...byLogin.values()];
  return ORDER.flatMap((state) => found.filter((one) => one.state === state));
}

/** What the reader sees when they rest on a face. */
export function personLabel(person, state = "") {
  const who = text(person?.name) || text(person?.login);
  if (who === "") return "";
  if (state === CHANGES_REQUESTED) return `${who} asked for changes`;
  if (state === ASKED) return `${who} has not reviewed yet`;
  if (state === APPROVED) return `${who} approved`;
  return who;
}
