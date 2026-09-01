// The portal's own grouping of the day, turned into an icon and a short name.
//
// The Current Events portal writes a category as a heading above a block of
// stories. Ten of them do nearly all the work. Counted over 710 real portal days
// from 2014 to 2026, these ten head more than 99% of every story:
//
//   Armed conflicts and attacks   88% of days      Health and environment   33%
//   Disasters and accidents       84%              Arts and culture         27%
//   Politics and elections        83%              Business and economy     26%
//   Law and crime                 71%              Science and technology   17%
//   Sports                        53%              International relations  49%
//
// **The set is a convention, not a rule.** Nothing on Wikipedia enforces the
// heading, and the same survey found 27 more: names the portal has retired
// ("Sport", "Health", "Business and economics", "Science") and plain typos
// ("Sience and technology", "Businesses and economy", "Law and Crime"). About one
// new typo appears each year. So this module never assumes the ten: it reads a
// heading, and answers null when it cannot tell. The page then prints the
// portal's own words, which is true of any heading, and shows no icon.
//
// Nothing here touches the DOM. The icons are path data, and `app.js` builds the
// SVG element from them, because a web-project draws its own pictures rather than
// carrying image files.

/** The ten categories, in the order the survey found them by frequency. */
export const CATEGORY_KEYS = [
  "conflicts",
  "disasters",
  "politics",
  "law",
  "sports",
  "relations",
  "health",
  "arts",
  "business",
  "science",
];

/**
 * The heading the portal writes today for each category.
 *
 * Matched first and exactly, so a change to the word lists below can never move
 * one of the ten headings that carry nearly every story.
 */
const CANONICAL = {
  "armed conflicts and attacks": "conflicts",
  "disasters and accidents": "disasters",
  "politics and elections": "politics",
  "law and crime": "law",
  sports: "sports",
  "international relations": "relations",
  "health and environment": "health",
  "arts and culture": "arts",
  "business and economy": "business",
  "science and technology": "science",
};

/**
 * The words that name each category, for every other heading.
 *
 * A heading is read word by word, and a word must match one of these exactly. A
 * word that merely starts the same is a different word: "Lawn care" is not law,
 * and "Departments" is not the arts.
 */
const WORDS = {
  conflicts: ["conflict", "conflicts", "attack", "attacks", "war", "wars", "terrorism", "military"],
  disasters: ["disaster", "disasters", "accident", "accidents", "incident", "incidents", "earthquake", "earthquakes"],
  politics: ["politics", "politic", "political", "election", "elections", "government", "referendum"],
  law: ["law", "laws", "crime", "crimes", "criminal", "justice", "court", "courts", "trial", "trials"],
  sports: ["sport", "sports", "sporting", "athletics", "olympics"],
  relations: ["relations", "relation", "diplomacy", "diplomatic"],
  health: [
    "health",
    "environment",
    "environmental",
    "medicine",
    "medical",
    "disease",
    "diseases",
    "epidemic",
    "pandemic",
    "weather",
    "climate",
  ],
  arts: ["art", "arts", "culture", "cultural", "literature", "entertainment", "music", "film", "cinema"],
  business: [
    "business",
    "businesses",
    "economy",
    "economics",
    "economic",
    "finance",
    "financial",
    "market",
    "markets",
    "trade",
  ],
  science: ["science", "sciences", "scientific", "technology", "technological", "tech", "space"],
};

/** Every word to the category it names, built once. */
const WORD_INDEX = new Map(
  Object.entries(WORDS).flatMap(([key, words]) => words.map((word) => [word, key])),
);

/**
 * One heading, cut into the plain lowercase words it is made of.
 * `&` becomes "and", so "Art & literature" reads the same as "Art and literature".
 */
function words(heading) {
  return String(heading ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Which of the ten a portal heading is.
 *
 * @param {string} heading the portal's own words, for example "Law and crime"
 * @returns {string|null} a key from `CATEGORY_KEYS`, or null when the heading
 *   names none of them or names two at once. Null is not a failure: the caller
 *   prints the heading itself, which is true whatever the editor wrote.
 */
export function classifyCategory(heading) {
  const parts = words(heading);
  if (!parts.length) return null;

  const exact = CANONICAL[parts.join(" ")];
  if (exact) return exact;

  // Every category the heading names. Two of them means the heading is about
  // both, and a chip can only show one, so nothing is claimed.
  const found = new Set();
  for (const word of parts) {
    const key = WORD_INDEX.get(word);
    if (key) found.add(key);
  }
  return found.size === 1 ? [...found][0] : null;
}

/**
 * The picture for each category: the `d` of one or more paths on a 24 by 24 grid.
 *
 * Every icon is drawn as a stroke and never as a fill, so it takes the colour of
 * the text around it and stays legible at the size a chip gives it.
 */
export const CATEGORY_ICONS = {
  // Crossed swords: two blades and the hilts below them.
  conflicts: ["M3.5 4.5V3H5l11 11-1.5 1.5z", "M20.5 4.5V3H19L8 14l1.5 1.5z", "M14 16l4.5 4.5", "M10 16l-4.5 4.5"],
  // A warning triangle.
  disasters: ["M12 4.5 3 20h18z", "M12 10.5v4", "M12 17.4h.01"],
  // A ticked ballot paper.
  politics: ["M5 4h14v16H5z", "M9 12l2.2 2.2L15.5 10"],
  // The scales of justice.
  law: ["M12 4.5v15", "M8.5 19.5h7", "M5 8h14", "M5 8 2.5 13.5h5z", "M19 8l-2.5 5.5h5z", "M12 4.5h.01"],
  // A trophy.
  sports: ["M8 4h8v5a4 4 0 0 1-8 0z", "M8 5.5H5.5V7A3 3 0 0 0 8.5 10", "M16 5.5h2.5V7a3 3 0 0 1-3 3", "M12 13v3.5", "M9 20h6"],
  // Two arrows passing each other: what countries do with each other.
  relations: ["M4 9.5h14", "M15 6.5l3 3-3 3", "M20 15.5H6", "M9 12.5l-3 3 3 3"],
  // A heart, for health, and the living world it shares a category with.
  health: ["M12 20.5S4 15.7 4 10.5A4 4 0 0 1 12 8a4 4 0 0 1 8 2.5c0 5.2-8 10-8 10z"],
  // A painter's palette.
  arts: [
    "M12 3.2a8.8 8.8 0 1 0 0 17.6 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2h2.2A4.8 4.8 0 0 0 22 9.6 8.8 8.8 0 0 0 12 3.2z",
    "M8 8.5h.01",
    "M7 13h.01",
    "M12 6.5h.01",
    "M16 7.5h.01",
  ],
  // A rising line and the arrow that ends it.
  business: ["M3.5 18 9 12.5l3 3 6.5-6.5", "M14.5 9H19v4.5"],
  // A laboratory flask.
  science: ["M10 3.5v6L4.8 19a1.6 1.6 0 0 0 1.4 2.4h11.6A1.6 1.6 0 0 0 19.2 19L14 9.5v-6", "M9 3.5h6", "M7.4 15h9.2"],
};
