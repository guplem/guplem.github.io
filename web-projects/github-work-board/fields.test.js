import { describe, expect, test } from "bun:test";
import {
  availableFieldFilters,
  fieldFilterKey,
  fieldText,
  filterByFields,
  isFilterableField,
  readFieldValues,
} from "./fields.js";

const effort = (value) => ({ name: "Effort", kind: "number", value });
const priority = (value) => ({ name: "Priority", kind: "select", value, color: "" });
const item = (key, fields) => ({ key, fields });

describe("the words a field shows", () => {
  test("a whole number reads as itself, and a fraction keeps what it says", () => {
    expect(fieldText(effort(3))).toBe("3");
    expect(fieldText(effort(2.5))).toBe("2.5");
    expect(fieldText(effort(0))).toBe("0");
  });

  // GitHub sends a float, and 0.1 + 0.2 style noise must not reach the card.
  test("a long fraction is cut to two places", () => {
    expect(fieldText(effort(1 / 3))).toBe("0.33");
  });

  test("a date reads as a day, a month and a year, in no time zone", () => {
    expect(fieldText({ name: "Target date", kind: "date", value: "2026-10-01" })).toBe("1 Oct 2026");
    expect(fieldText({ name: "Start", kind: "date", value: "not a date" })).toBe("not a date");
  });

  test("text and an option read as they were written", () => {
    expect(fieldText(priority("P1"))).toBe("P1");
    expect(fieldText({ name: "Notes", kind: "text", value: "ask Ana" })).toBe("ask Ana");
  });
});

describe("which fields a filter can offer", () => {
  // A number and an option have a handful of values, so a chip per value is a
  // short row. A date or a free text has one value per card, and a chip per
  // card filters nothing (ADR 0047).
  test("numbers and options, never dates or text", () => {
    expect(isFilterableField(effort(3))).toBe(true);
    expect(isFilterableField(priority("P1"))).toBe(true);
    expect(isFilterableField({ name: "Due", kind: "date", value: "2026-10-01" })).toBe(false);
    expect(isFilterableField({ name: "Notes", kind: "text", value: "x" })).toBe(false);
  });

  // The key travels in the link (`field=Effort: 3`), so its shape is permanent.
  test("the key is the name and the words, as the chip reads", () => {
    expect(fieldFilterKey(effort(3))).toBe("Effort: 3");
    expect(fieldFilterKey(priority("P1"))).toBe("Priority: P1");
  });

  test("one group per field, values once each, numbers in number order", () => {
    const items = [
      item("a", [effort(8), priority("P2")]),
      item("b", [effort(2), priority("P1")]),
      item("c", [effort(8), { name: "Due", kind: "date", value: "2026-10-01" }]),
      item("d", []),
      { key: "e" },
    ];
    expect(availableFieldFilters(items)).toEqual([
      { name: "Effort", values: [{ key: "Effort: 2", text: "2" }, { key: "Effort: 8", text: "8" }] },
      { name: "Priority", values: [{ key: "Priority: P1", text: "P1" }, { key: "Priority: P2", text: "P2" }] },
    ]);
  });

  test("ten sorts after two, which a sort by words gets wrong", () => {
    const values = availableFieldFilters([item("a", [effort(10)]), item("b", [effort(2)])])[0].values;
    expect(values.map((one) => one.text)).toEqual(["2", "10"]);
  });
});

describe("narrowing by fields", () => {
  const items = [
    item("a", [effort(3), priority("P1")]),
    item("b", [effort(5), priority("P1")]),
    item("c", [effort(3), priority("P2")]),
    item("d", []),
  ];
  const keys = (list) => list.map((one) => one.key);

  test("nothing chosen keeps everything, in order", () => {
    expect(keys(filterByFields(items, []))).toEqual(["a", "b", "c", "d"]);
    expect(keys(filterByFields(items, undefined))).toEqual(["a", "b", "c", "d"]);
  });

  // ADR 0009: two values of one field widen, like two labels.
  test("two values of one field mean either", () => {
    expect(keys(filterByFields(items, ["Effort: 3", "Effort: 5"]))).toEqual(["a", "b", "c"]);
  });

  // ADR 0009: two fields narrow, like a label and a repository.
  test("two fields mean both", () => {
    expect(keys(filterByFields(items, ["Effort: 3", "Priority: P1"]))).toEqual(["a"]);
  });

  test("work that does not carry the field is left out once it is chosen", () => {
    expect(keys(filterByFields(items, ["Priority: P2"]))).toEqual(["c"]);
  });
});

describe("reading GitHub's answer", () => {
  // The shape `GET /issues` sends inline, as `issue_field_values` (ADR 0047).
  test("reads each kind GitHub sends", () => {
    expect(
      readFieldValues([
        { issue_field_name: "Effort", data_type: "number", value: 5 },
        { issue_field_name: "Effort points", data_type: "number", value: "2.5" },
        { issue_field_name: "Due", data_type: "date", value: "2026-10-01" },
        { issue_field_name: "Notes", data_type: "text", value: "ask Ana" },
        { issue_field_name: "Priority", data_type: "single_select", value: "id-1", single_select_option: { id: 1, name: "P1", color: "red" } },
      ]),
    ).toEqual([
      { name: "Due", kind: "date", value: "2026-10-01", color: "" },
      { name: "Effort", kind: "number", value: 5, color: "" },
      { name: "Effort points", kind: "number", value: 2.5, color: "" },
      { name: "Notes", kind: "text", value: "ask Ana", color: "" },
      { name: "Priority", kind: "select", value: "P1", color: "red" },
    ]);
  });

  // Each chosen option is a value of its own, so each one can be a chip.
  test("a field with several options reads as one value per option", () => {
    expect(
      readFieldValues([
        {
          issue_field_name: "Area",
          data_type: "multi_select",
          multi_select_options: [{ name: "Front", color: "blue" }, { name: "Back", color: "green" }],
        },
      ]),
    ).toEqual([
      { name: "Area", kind: "select", value: "Front", color: "blue" },
      { name: "Area", kind: "select", value: "Back", color: "green" },
    ]);
  });

  // A date with a time on it is still a day, and the card says the day.
  test("a date keeps the day only", () => {
    expect(readFieldValues([{ issue_field_name: "Due", data_type: "date", value: "2026-10-01T00:00:00Z" }])).toEqual([
      { name: "Due", kind: "date", value: "2026-10-01", color: "" },
    ]);
  });

  // An empty field is not set, and a kind this build does not know is left
  // out rather than drawn wrong. One odd entry never costs the others.
  test("leaves out what is empty, unknown or unreadable", () => {
    expect(
      readFieldValues([
        null,
        { data_type: "number", value: 3 },
        { issue_field_name: "Effort", data_type: "number", value: null },
        { issue_field_name: "Effort", data_type: "number", value: "lots" },
        { issue_field_name: "Notes", data_type: "text", value: "" },
        { issue_field_name: "Who", data_type: "user", value: "ana" },
        { issue_field_name: "Priority", data_type: "single_select", value: "" },
      ]),
    ).toEqual([]);
    expect(readFieldValues(undefined)).toEqual([]);
  });
});
