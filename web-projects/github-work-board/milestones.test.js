import { describe, expect, test } from "bun:test";
import { MILESTONE_PATHS, milestoneFilterTip, milestoneLinkTip, milestoneProgress, readMilestone } from "./milestones.js";

// The shape GitHub's issues and search endpoints both answer with.
const RAW_MILESTONE = {
  title: "Sprint 12",
  html_url: "https://github.com/guplem/guplem.github.io/milestone/3",
  open_issues: 8,
  closed_issues: 12,
  state: "open",
};

describe("readMilestone", () => {
  test("keeps the name, the link and the two counts", () => {
    expect(readMilestone(RAW_MILESTONE)).toEqual({
      title: "Sprint 12",
      url: "https://github.com/guplem/guplem.github.io/milestone/3",
      openCount: 8,
      closedCount: 12,
    });
  });

  // Most work is in no milestone, and GitHub says so with null.
  test("no milestone is null", () => {
    expect(readMilestone(null)).toBe(null);
    expect(readMilestone(undefined)).toBe(null);
    expect(readMilestone({})).toBe(null);
    expect(readMilestone({ title: "" })).toBe(null);
    expect(readMilestone("Sprint 12")).toBe(null);
  });

  // The link is a value from GitHub's answer that the page puts straight into
  // `a.href`. Only a GitHub page is kept, so nothing else can be linked
  // through it (ADR 0001).
  test("only a GitHub link is kept", () => {
    expect(readMilestone({ ...RAW_MILESTONE, html_url: "javascript:alert(1)" }).url).toBe("");
    expect(readMilestone({ ...RAW_MILESTONE, html_url: "https://example.com/milestone/3" }).url).toBe("");
    expect(readMilestone({ ...RAW_MILESTONE, html_url: 7 }).url).toBe("");
  });

  test("a count that is not a whole number reads as zero", () => {
    const read = readMilestone({ ...RAW_MILESTONE, open_issues: "8", closed_issues: -1 });
    expect(read.openCount).toBe(0);
    expect(read.closedCount).toBe(0);
  });
});

describe("milestoneProgress", () => {
  test("is the share of the milestone that is closed", () => {
    expect(milestoneProgress({ openCount: 8, closedCount: 12 })).toEqual({ percent: 60, label: "60%" });
  });

  // GitHub's own counts carry issues and pull requests together, and so does
  // its milestone page, so the number reads the same in both places.
  test("everything closed is the whole milestone", () => {
    expect(milestoneProgress({ openCount: 0, closedCount: 5 }).label).toBe("100%");
  });

  // Rounded down, so the pill says 100% only when nothing is left. One open
  // item out of three hundred is still work to do.
  test("one open item keeps it under a hundred", () => {
    expect(milestoneProgress({ openCount: 1, closedCount: 299 }).label).toBe("99%");
  });

  // An empty milestone has no share to give. Saying 0% would invent one.
  test("a milestone with nothing counted says no number", () => {
    expect(milestoneProgress({ openCount: 0, closedCount: 0 })).toEqual({ percent: null, label: "" });
    expect(milestoneProgress(null)).toEqual({ percent: null, label: "" });
  });
});

describe("the words on the pill", () => {
  const milestone = readMilestone(RAW_MILESTONE);

  test("the link says how far the milestone is and where it goes", () => {
    expect(milestoneLinkTip(milestone)).toBe("Sprint 12: 12 of 20 closed. Open it on GitHub");
  });

  test("an empty milestone still says where the link goes", () => {
    expect(milestoneLinkTip({ ...milestone, openCount: 0, closedCount: 0 })).toBe("Sprint 12. Open it on GitHub");
  });

  // The name is a filter, and a pressed filter has to say how to undo it.
  test("the name says what pressing it does", () => {
    expect(milestoneFilterTip(milestone, false)).toBe("Show only the work in Sprint 12");
    expect(milestoneFilterTip(milestone, true)).toBe("Show everything again, not only Sprint 12");
  });
});

test("the icon is drawn from paths, like every icon on the page (ADR 0001)", () => {
  expect(MILESTONE_PATHS.length).toBeGreaterThan(0);
  for (const d of MILESTONE_PATHS) expect(typeof d).toBe("string");
});
