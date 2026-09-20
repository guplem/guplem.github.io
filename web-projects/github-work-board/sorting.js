// The orders the board can put its list in.
//
// Every comparison ends by falling back to the item's key, so the order is
// total: two items updated in the same second always land the same way round.
// Without that, a list appears to shuffle itself between renders, and the
// reader loses their place while reading it.
//
// An item with no date goes last whichever direction is chosen. A missing date
// is a broken answer from GitHub, not an old item, and burying it at the top of
// "oldest first" would be wrong every time.
//
// **The `id` of an order travels in the address bar** (`urlState.js`), so a
// renamed id silently breaks every link anybody saved. `invariants.test.js`
// pins the set. See ADR 0006.

/** Newest activity first: what a person opening the board usually wants. */
export const DEFAULT_SORT_ID = "updated-desc";

export const SORT_OPTIONS = [
  { id: "updated-desc", label: "Recently updated" },
  { id: "updated-asc", label: "Least recently updated" },
  { id: "created-desc", label: "Newest first" },
  { id: "created-asc", label: "Oldest first" },
  { id: "noted-first", label: "Ones you noted first" },
  { id: "label", label: "Label, A to Z" },
  { id: "repository", label: "Repository, then number" },
  { id: "title", label: "Title, A to Z" },
];

const KNOWN = new Set(SORT_OPTIONS.map((option) => option.id));

/** One of the orders above, whatever was asked for. */
export function readSortId(value) {
  return typeof value === "string" && KNOWN.has(value) ? value : DEFAULT_SORT_ID;
}

/** A date as a number, or null when there is nothing readable to compare. */
function moment(value) {
  const parsed = Date.parse(typeof value === "string" ? value : "");
  return Number.isNaN(parsed) ? null : parsed;
}

/** Compare two dates, putting a missing one last in both directions. */
function byDate(left, right, newestFirst) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (left === right) return 0;
  return newestFirst ? right - left : left - right;
}

function comparatorFor(sortId, hasNote) {
  switch (sortId) {
    case "updated-asc":
      return (a, b) => byDate(moment(a.updatedAt), moment(b.updatedAt), false);
    case "created-desc":
      return (a, b) => byDate(moment(a.createdAt), moment(b.createdAt), true);
    case "created-asc":
      return (a, b) => byDate(moment(a.createdAt), moment(b.createdAt), false);
    case "noted-first":
      return (a, b) => {
        const noted = Number(hasNote(b.key)) - Number(hasNote(a.key));
        return noted !== 0 ? noted : byDate(moment(a.updatedAt), moment(b.updatedAt), true);
      };
    case "repository":
      return (a, b) => {
        const where = String(a.repository).localeCompare(String(b.repository), undefined, { sensitivity: "base" });
        return where !== 0 ? where : Number(a.number) - Number(b.number);
      };
    // By the alphabetically first label it carries. Anything with no label at
    // all goes last: it is not "before A", it is outside the ordering.
    case "label":
      return (a, b) => {
        const first = (item) =>
          (Array.isArray(item?.labels) ? item.labels.map((one) => one?.name ?? "") : [])
            .filter(Boolean)
            .sort((one, two) => one.localeCompare(two, undefined, { sensitivity: "base" }))[0] ?? "";
        const left = first(a);
        const right = first(b);
        if (left === right) return 0;
        if (left === "") return 1;
        if (right === "") return -1;
        return left.localeCompare(right, undefined, { sensitivity: "base" });
      };
    case "title":
      return (a, b) => String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" });
    default:
      return (a, b) => byDate(moment(a.updatedAt), moment(b.updatedAt), true);
  }
}

/**
 * The items in the chosen order. The list handed in is not reordered.
 *
 * @param hasNote answers whether a note is filed against that item's key; only
 *   the "ones you noted first" order asks.
 */
export function sortWorkItems(items, sortId, hasNote = () => false) {
  const list = Array.isArray(items) ? [...items] : [];
  const compare = comparatorFor(readSortId(sortId), hasNote);
  return list.sort((a, b) => {
    const decided = compare(a, b);
    return decided !== 0 ? decided : String(a.key).localeCompare(String(b.key));
  });
}
