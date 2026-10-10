// The fields GitHub shows beside an issue: the effort, the priority, a target
// date, whatever the organisation defined.
//
// The values arrive inside the graph answer the board already asks for, so a
// field on a card costs no call of its own (ADR 0010, ADR 0047). This module
// reads them, says each one in words, and narrows the board by them.
//
// A field filter follows ADR 0009 with each field as its own kind: two values
// of one field widen ("Effort 3 or 5"), two fields narrow ("Effort 3 and
// Priority P1"). Only numbers and options are offered as chips. A date or a free
// text has a value per card, and a chip per card filters nothing.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FILTERABLE = new Set(["number", "select"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readColour(option) {
  return typeof option?.color === "string" ? option.color : "";
}

function readOne(raw) {
  if (!isPlainObject(raw)) return [];
  const name = typeof raw.issue_field_name === "string" ? raw.issue_field_name : "";
  if (name === "") return [];
  const at = (kind, value, color = "") => ({ name, kind, value, color });
  switch (raw.data_type) {
    case "number": {
      if (raw.value === null || raw.value === "" || typeof raw.value === "boolean") return [];
      const number = Number(raw.value);
      return Number.isFinite(number) ? [at("number", number)] : [];
    }
    case "date": {
      const day = /^\d{4}-\d{2}-\d{2}/.exec(String(raw.value ?? ""));
      return day ? [at("date", day[0])] : [];
    }
    case "text":
      return typeof raw.value === "string" && raw.value !== "" ? [at("text", raw.value)] : [];
    case "single_select": {
      // `value` may be the option's id; the option itself carries the name.
      const option = isPlainObject(raw.single_select_option) ? raw.single_select_option : null;
      const words = typeof option?.name === "string" ? option.name : typeof raw.value === "string" ? raw.value : "";
      return words !== "" ? [at("select", words, readColour(option))] : [];
    }
    case "multi_select":
      return (Array.isArray(raw.multi_select_options) ? raw.multi_select_options : [])
        .filter((option) => typeof option?.name === "string" && option.name !== "")
        .map((option) => at("select", option.name, readColour(option)));
    default:
      // A kind this build does not know is left out rather than drawn wrong.
      return [];
  }
}

/**
 * The fields set on one issue, out of `issue_field_values` in the issues
 * answer, in name order. A field with no value is not set, so it is left out.
 * This never throws: one odd entry must not cost the others.
 */
export function readFieldValues(raw) {
  const fields = (Array.isArray(raw) ? raw : []).flatMap(readOne);
  // Stable, so the options of one multi-select keep GitHub's order.
  return fields.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
}

/** A field's value in words, the way the card and the chip both say it. */
export function fieldText(field) {
  if (!isPlainObject(field)) return "";
  if (field.kind === "number") {
    const number = Number(field.value);
    if (!Number.isFinite(number)) return "";
    return String(Math.round(number * 100) / 100);
  }
  if (field.kind === "date") {
    // Read as written, never through `Date`: "2026-10-01" is a day, and a
    // time zone west of London would turn it into the 30th of September.
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(field.value ?? ""));
    if (!parts) return String(field.value ?? "");
    const month = MONTHS[Number(parts[2]) - 1];
    return month ? `${Number(parts[3])} ${month} ${parts[1]}` : String(field.value);
  }
  return typeof field.value === "string" ? field.value : "";
}

/** Whether the filters offer a chip for this field's values. */
export function isFilterableField(field) {
  return isPlainObject(field) && FILTERABLE.has(field.kind) && fieldText(field) !== "";
}

/**
 * The key one value is chosen by. It travels in the link (`field=Effort: 3`),
 * so its shape is permanent, like a label name.
 */
export function fieldFilterKey(field) {
  return `${field?.name ?? ""}: ${fieldText(field)}`;
}

/** The field a chosen key names: everything before the first ": ". */
function fieldNameOf(key) {
  const at = key.indexOf(": ");
  return at === -1 ? key : key.slice(0, at);
}

function fieldsOf(item) {
  return Array.isArray(item?.fields) ? item.fields.filter(isPlainObject) : [];
}

/**
 * One group per field the list carries, and each value once, so the filters can
 * draw one row of chips per field. Numbers read in number order.
 */
export function availableFieldFilters(items) {
  const byName = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    for (const field of fieldsOf(item)) {
      if (!isFilterableField(field) || typeof field.name !== "string" || field.name === "") continue;
      const values = byName.get(field.name) ?? new Map();
      const key = fieldFilterKey(field);
      if (!values.has(key)) values.set(key, { key, text: fieldText(field), order: field.kind === "number" ? Number(field.value) : null });
      byName.set(field.name, values);
    }
  }
  const words = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return [...byName.entries()]
    .sort(([a], [b]) => words(a, b))
    .map(([name, values]) => ({
      name,
      values: [...values.values()]
        .sort((a, b) => (a.order !== null && b.order !== null ? a.order - b.order : 0) || words(a.text, b.text))
        .map(({ key, text }) => ({ key, text })),
    }));
}

/**
 * The items that carry every chosen field, in any of the values chosen for it.
 * The list handed in is not changed or reordered.
 */
export function filterByFields(items, chosen) {
  const list = Array.isArray(items) ? items : [];
  const keys = (Array.isArray(chosen) ? chosen : []).filter((one) => typeof one === "string" && one !== "");
  if (keys.length === 0) return [...list];
  const wanted = new Map();
  for (const key of keys) {
    const name = fieldNameOf(key);
    wanted.set(name, (wanted.get(name) ?? new Set()).add(key));
  }
  return list.filter((item) => {
    const carried = new Set(fieldsOf(item).map(fieldFilterKey));
    return [...wanted.values()].every((values) => [...values].some((key) => carried.has(key)));
  });
}
