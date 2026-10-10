import { describe, expect, test } from "bun:test";
import { DEFAULT_RANGE } from "./doneRange.js";
import { DEFAULT_KIND } from "./filters.js";
import { DEFAULT_SECTION } from "./settingsSections.js";
import { DEFAULT_SORT_ID } from "./sorting.js";
import { DEFAULT_VIEW, VIEWS, buildSearch, readStateFromSearch } from "./urlState.js";

const DEFAULTS = {
  sortId: DEFAULT_SORT_ID,
  view: DEFAULT_VIEW,
  kind: DEFAULT_KIND,
  repositories: [],
  labels: [],
  milestones: [],
  fields: [],
  assignees: [],
  reviewers: [],
  doneRange: DEFAULT_RANGE,
  section: DEFAULT_SECTION,
};

describe("the section of Settings", () => {
  // Settings is split into sections, and the open one travels in the link so
  // "Show a column in Settings" can land on the right one (ADR 0048).
  test("round-trips a section", () => {
    expect(buildSearch({ ...DEFAULTS, view: "settings", section: "appearance" })).toBe("?view=settings&section=appearance");
    expect(readStateFromSearch("?view=settings&section=appearance")).toEqual({
      ...DEFAULTS,
      view: "settings",
      section: "appearance",
    });
  });

  test("the default section is left out of the link", () => {
    expect(buildSearch({ ...DEFAULTS, view: "settings", section: DEFAULT_SECTION })).toBe("?view=settings");
  });

  // A section means nothing on the board, so it never rides along there.
  test("a section is only written while Settings is open", () => {
    expect(buildSearch({ ...DEFAULTS, view: "board", section: "appearance" })).toBe("");
    expect(buildSearch({ ...DEFAULTS, view: "cleanup", section: "storage" })).toBe("?view=cleanup");
  });

  test("a section nobody offers opens the default one", () => {
    expect(readStateFromSearch("?view=settings&section=nope").section).toBe(DEFAULT_SECTION);
  });
});

describe("the add-token view", () => {
  // Adding a token is its own screen, so the guide has room to be a
  // numbered walk-through rather than a block inside Settings (ADR 0018).
  // The name travels in the link like every other view.
  test("is a view the link can name", () => {
    expect(readStateFromSearch("?view=add-token").view).toBe("add-token");
    expect(buildSearch({ ...DEFAULTS, view: "add-token" })).toBe("?view=add-token");
  });
});

describe("the cleanup view", () => {
  // The suggested cleanup is its own screen, opened from Settings (ADR 0043).
  test("is a view the link can name", () => {
    expect(readStateFromSearch("?view=cleanup").view).toBe("cleanup");
    expect(buildSearch({ ...DEFAULTS, view: "cleanup" })).toBe("?view=cleanup");
  });
});

describe("readStateFromSearch", () => {
  test("reads the chosen order", () => {
    expect(readStateFromSearch("?sort=title")).toEqual({ ...DEFAULTS, sortId: "title" });
  });

  test("reads the chosen view", () => {
    expect(readStateFromSearch("?view=settings")).toEqual({ ...DEFAULTS, view: "settings" });
  });

  test("an empty address bar is the board, in the default order", () => {
    expect(readStateFromSearch("")).toEqual(DEFAULTS);
    expect(readStateFromSearch(null)).toEqual(DEFAULTS);
    expect(readStateFromSearch(undefined)).toEqual(DEFAULTS);
  });

  test("a view or an order nobody offers falls back to the default", () => {
    expect(readStateFromSearch("?sort=by-vibes")).toEqual(DEFAULTS);
    expect(readStateFromSearch("?view=admin")).toEqual(DEFAULTS);
  });

  test("ignores anything else in the address bar", () => {
    expect(readStateFromSearch("?utm_source=chat&sort=title")).toEqual({ ...DEFAULTS, sortId: "title" });
  });

  test("reads the chosen filters", () => {
    expect(readStateFromSearch("?kind=issue")).toEqual({ ...DEFAULTS, kind: "issue" });
    expect(readStateFromSearch("?repo=me%2Fa&repo=me%2Fb")).toEqual({
      ...DEFAULTS,
      repositories: ["me/a", "me/b"],
    });
    expect(readStateFromSearch("?label=bug&label=urgent")).toEqual({ ...DEFAULTS, labels: ["bug", "urgent"] });
    expect(readStateFromSearch("?milestone=Sprint+12&milestone=Launch")).toEqual({
      ...DEFAULTS,
      milestones: ["Sprint 12", "Launch"],
    });
  });

  // One parameter per milestone, never a comma-joined value (ADR 0009).
  test("writes one parameter per chosen milestone", () => {
    expect(buildSearch({ milestones: ["Sprint 12", "v1, final"] })).toBe("?milestone=Sprint+12&milestone=v1%2C+final");
  });

  // A field value is chosen by its field's name and its words, one parameter
  // each, like a label (ADR 0047).
  test("reads and writes one parameter per chosen field value", () => {
    expect(readStateFromSearch("?field=Effort%3A+3&field=Priority%3A+P1")).toEqual({
      ...DEFAULTS,
      fields: ["Effort: 3", "Priority: P1"],
    });
    expect(buildSearch({ fields: ["Effort: 3"] })).toBe("?field=Effort%3A+3");
  });

  test("a kind nobody offers is everything", () => {
    expect(readStateFromSearch("?kind=issues")).toEqual(DEFAULTS);
  });

  test("the views are exactly these", () => {
    expect(VIEWS).toEqual(["board", "settings", "add-token", "cleanup"]);
    expect(VIEWS).toContain(DEFAULT_VIEW);
  });
});

describe("buildSearch", () => {
  // A link is shared and read by a person. A default that is spelled out adds
  // noise and implies a choice nobody made (root ADR 0006).
  test("leaves the defaults out of the link", () => {
    expect(buildSearch({ sortId: DEFAULT_SORT_ID, view: DEFAULT_VIEW })).toBe("");
    expect(buildSearch({})).toBe("");
  });

  test("writes a chosen order and a chosen view", () => {
    expect(buildSearch({ sortId: "title" })).toBe("?sort=title");
    expect(buildSearch({ view: "settings" })).toBe("?view=settings");
    expect(buildSearch({ view: "settings", sortId: "title" })).toBe("?view=settings&sort=title");
  });

  // Root ADR 0006: one parameter per item in a list, never one comma-separated
  // value, so a repository name carrying a comma cannot break the link.
  test("writes one parameter per chosen repository and label", () => {
    expect(buildSearch({ repositories: ["me/a", "me/b"] })).toBe("?repo=me%2Fa&repo=me%2Fb");
    expect(buildSearch({ labels: ["bug", "needs review"] })).toBe("?label=bug&label=needs+review");
  });

  test("leaves an empty filter out of the link", () => {
    expect(buildSearch({ kind: DEFAULT_KIND, repositories: [], labels: [] })).toBe("");
  });

  test("round-trips a filtered board", () => {
    const state = {
      sortId: "title",
      view: "board",
      kind: "issue",
      repositories: ["me/a"],
      labels: ["bug"],
      milestones: ["Sprint 12"],
      fields: ["Effort: 3", "Priority: P1"],
      assignees: ["ana"],
      reviewers: ["leo"],
      doneRange: "2026-09-15..2026-09-19",
      section: DEFAULT_SECTION,
    };
    expect(readStateFromSearch(buildSearch(state))).toEqual(state);
  });

  test("round-trips through the address bar", () => {
    for (const sortId of ["title", "repository", "created-asc", DEFAULT_SORT_ID]) {
      for (const view of VIEWS) {
        expect(readStateFromSearch(buildSearch({ sortId, view }))).toEqual({ ...DEFAULTS, sortId, view });
      }
    }
  });

  // The token is the one thing that must never reach the address bar
  // (root ADR 0006, ADR 0001).
  test("writes nothing it was not asked for", () => {
    expect(buildSearch({ sortId: "title", token: "github_pat_11SECRET" })).toBe("?sort=title");
  });
});

describe("the two person filters travel in the link (ADR 0009, ADR 0028)", () => {
  // Two filters over two different lists, so two names. A reader with both
  // chosen has both in one link, and the code, not a guess, says which list
  // each one narrows.
  test("the assignee narrows the review row, the reviewer narrows the board", () => {
    const search = buildSearch({ ...DEFAULTS, assignees: ["ana"], reviewers: ["leo"] });
    expect(search).toContain("assignee=ana");
    expect(search).toContain("reviewer=leo");
  });

  test("round-trips, one parameter per person", () => {
    const read = readStateFromSearch("?assignee=ana&assignee=leo&reviewer=sam");
    expect(read.assignees).toEqual(["ana", "leo"]);
    expect(read.reviewers).toEqual(["sam"]);
  });

  test("nobody chosen says nothing", () => {
    expect(buildSearch({ ...DEFAULTS, assignees: [], reviewers: [] })).toBe("");
    expect(readStateFromSearch("").assignees).toEqual([]);
    expect(readStateFromSearch("").reviewers).toEqual([]);
  });

  // A login cannot hold a comma today, and the board still never joins values
  // into one parameter: the rule is the encoder's, not the value's (ADR 0009).
  test("a person is encoded like every other value", () => {
    expect(buildSearch({ ...DEFAULTS, assignees: ["a b"] })).toContain("assignee=a+b");
  });
});

// The days the last column is about travel in the link, so a "what did we do
// yesterday" board is one paste in the standup chat (ADR 0034).
describe("the range of the Done column", () => {
  test("a range that is not today is written, and today is left out", () => {
    expect(buildSearch({ doneRange: "yesterday" })).toBe("?done=yesterday");
    expect(buildSearch({ doneRange: "2026-09-15..2026-09-19" })).toBe("?done=2026-09-15..2026-09-19");
    expect(buildSearch({ doneRange: "today" })).toBe("");
    expect(buildSearch({})).toBe("");
  });

  test("the link is read back, and anything unreadable is today", () => {
    expect(readStateFromSearch("?done=last-7-days").doneRange).toBe("last-7-days");
    expect(readStateFromSearch("?done=2026-09-19").doneRange).toBe("2026-09-19..2026-09-19");
    expect(readStateFromSearch("?done=whenever").doneRange).toBe("today");
    expect(readStateFromSearch("").doneRange).toBe("today");
  });
});
