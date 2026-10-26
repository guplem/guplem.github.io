import { describe, expect, test } from "bun:test";
import {
  COPY_ICONS,
  DEFAULT_COPY_ICON,
  EXAMPLE_ACTIONS,
  PLACEHOLDERS,
  canFillTemplate,
  fillCopyTemplate,
  moveCopyAction,
  offeredIn,
  orderCopyActions,
  STARTING_ACTIONS,
  withStartingActions,
  writtenByReader,
  pickEmoji,
  placeholdersIn,
  readCopyIcon,
} from "./copyActions.js";

const pull = {
  key: "PR_1",
  kind: "pull-request",
  number: 214,
  title: "Read the notes back",
  repository: "me/work",
  url: "https://github.com/me/work/pull/214",
  headRefName: "claude/read-the-notes",
};

const issue = {
  key: "I_1",
  kind: "issue",
  number: 87,
  title: "The board forgets a note",
  repository: "me/work",
  url: "https://github.com/me/work/issues/87",
};

describe("fillCopyTemplate", () => {
  test("puts the card's own values where the placeholders are", () => {
    expect(fillCopyTemplate("/implement-issue #{N}", issue)).toBe("/implement-issue #87");
    expect(fillCopyTemplate("Please review {URL}", pull)).toBe("Please review https://github.com/me/work/pull/214");
    expect(fillCopyTemplate("{REPO} {TITLE} {BRANCH}", pull)).toBe(
      "me/work Read the notes back claude/read-the-notes",
    );
  });

  test("fills the same placeholder every time it appears", () => {
    expect(fillCopyTemplate("#{N} then #{N}", issue)).toBe("#87 then #87");
  });

  // The reader types the template by hand, and a board that quietly drops what
  // it did not recognise would hand back text with a hole in it. Left as it
  // was, the mistake is in the clipboard where the reader can see it.
  test("leaves a placeholder nobody offers exactly as it was typed", () => {
    expect(fillCopyTemplate("{N} {AUTHOR}", issue)).toBe("87 {AUTHOR}");
  });

  test("the case of a placeholder does not matter", () => {
    expect(fillCopyTemplate("{url}", issue)).toBe("https://github.com/me/work/issues/87");
  });

  test("never throws, whatever it is handed", () => {
    expect(fillCopyTemplate("{N}", null)).toBe("");
    expect(fillCopyTemplate(null, issue)).toBe("");
    expect(fillCopyTemplate("{BRANCH}", issue)).toBe("");
  });
});

describe("placeholdersIn", () => {
  test("names the placeholders a template uses, once each", () => {
    expect(placeholdersIn("#{N} {URL} {N}")).toEqual(["{N}", "{URL}"]);
    expect(placeholdersIn("nothing to fill")).toEqual([]);
    expect(placeholdersIn("{AUTHOR}")).toEqual([]);
  });
});

describe("canFillTemplate", () => {
  // The same answer the menu already gives for "Copy branch name": an issue
  // has no branch, so a row that would copy an empty one is not offered at all
  // (ADR 0022).
  test("a template asking for something the card has not is not offered", () => {
    expect(canFillTemplate("checkout {BRANCH}", pull)).toBe(true);
    expect(canFillTemplate("checkout {BRANCH}", issue)).toBe(false);
  });

  test("a template with nothing to fill is always offered", () => {
    expect(canFillTemplate("hello", issue)).toBe(true);
  });

  test("never throws, whatever it is handed", () => {
    expect(canFillTemplate("{N}", null)).toBe(false);
    expect(canFillTemplate(null, issue)).toBe(false);
  });
});

describe("orderCopyActions", () => {
  const now = "2026-09-22T10:00:00.000Z";
  const later = "2026-09-22T11:00:00.000Z";

  test("oldest first, so the list holds still as the reader adds to it", () => {
    const stored = {
      b: { label: "Second", template: "{N}", createdAt: later, updatedAt: later },
      a: { label: "First", template: "{URL}", createdAt: now, updatedAt: now },
    };
    expect(orderCopyActions(stored).map((one) => one.label)).toEqual(["First", "Second"]);
  });

  // Two devices can write an action in the same second. The id breaks the tie,
  // so both read the same order on both machines.
  test("two actions made in the same moment are ordered by their id", () => {
    const stored = {
      b: { label: "B", template: "{N}", createdAt: now, updatedAt: now },
      a: { label: "A", template: "{N}", createdAt: now, updatedAt: now },
    };
    expect(orderCopyActions(stored).map((one) => one.id)).toEqual(["a", "b"]);
  });

  // A removed action keeps its key with an empty template, the same way a
  // cleared note keeps its key: the other device has to tell "removed just now"
  // from "never seen" (ADR 0002).
  test("an action with no template left is one the reader removed", () => {
    const stored = {
      a: { label: "Gone", template: "", createdAt: now, updatedAt: later },
      b: { label: "Here", template: "{N}", createdAt: now, updatedAt: now },
    };
    expect(orderCopyActions(stored).map((one) => one.id)).toEqual(["b"]);
  });

  // The reader picks where a line is offered. Nothing picked is everywhere, so
  // every line saved before this choice existed keeps its rows.
  test("carries the parts of the board a line is offered in, and none means everywhere", () => {
    const stored = {
      a: { label: "Implement", template: "#{N}", areas: ["todo", "todo", 7, " ", "ongoing"], createdAt: now },
      b: { label: "Link", template: "{URL}", createdAt: later },
      c: { label: "Broken", template: "{URL}", areas: "todo", createdAt: later },
    };
    expect(orderCopyActions(stored).map((one) => one.areas)).toEqual([["todo", "ongoing"], [], []]);
  });

  test("an action with no label is named by what it copies", () => {
    const stored = { a: { label: "  ", template: "/implement-issue #{N}", createdAt: now, updatedAt: now } };
    expect(orderCopyActions(stored)[0].label).toBe("/implement-issue #{N}");
  });

  test("the text is trimmed, because a stray space is not a name", () => {
    const stored = { a: { label: " Implement ", template: " #{N} ", createdAt: now, updatedAt: now } };
    expect(orderCopyActions(stored)[0]).toEqual({
      id: "a",
      label: "Implement",
      template: "#{N}",
      icon: "",
      areas: [],
      position: null,
      createdAt: now,
    });
  });

  test("never throws, whatever is in the file", () => {
    expect(orderCopyActions(null)).toEqual([]);
    expect(orderCopyActions({ a: 7, b: null, c: { template: "{N}" } })).toEqual([
      { id: "c", label: "{N}", template: "{N}", icon: "", areas: [], position: null, createdAt: "" },
    ]);
  });
});

// The reader puts the lines in the order the menu shows them. A line they
// moved carries a position; one they never moved sorts by when it was made, on
// the same scale, so the lines saved before a move existed keep their order.
describe("the order the reader picked", () => {
  const first = "2026-09-22T10:00:00.000Z";
  const second = "2026-09-22T11:00:00.000Z";
  const third = "2026-09-22T12:00:00.000Z";
  const stored = {
    a: { label: "A", template: "{N}", createdAt: first },
    b: { label: "B", template: "{N}", createdAt: second },
    c: { label: "C", template: "{N}", createdAt: third },
  };
  const order = (map) => orderCopyActions(map).map((one) => one.id);
  const apply = (map, writes) => {
    const next = { ...map };
    for (const { id, position } of writes) next[id] = { ...next[id], position };
    return next;
  };

  test("a position wins over when the line was made", () => {
    const moved = { ...stored, c: { ...stored.c, position: Date.parse(first) - 1 } };
    expect(order(moved)).toEqual(["c", "a", "b"]);
  });

  test("a position that is not a number reads as none", () => {
    const broken = { ...stored, c: { ...stored.c, position: "0" }, b: { ...stored.b, position: Number.NaN } };
    expect(order(broken)).toEqual(["a", "b", "c"]);
  });

  test("moving a line up or down swaps it with its neighbour", () => {
    const up = apply(stored, moveCopyAction(orderCopyActions(stored), "c", -1));
    expect(order(up)).toEqual(["a", "c", "b"]);
    const down = apply(stored, moveCopyAction(orderCopyActions(stored), "a", 1));
    expect(order(down)).toEqual(["b", "a", "c"]);
    const top = apply(stored, moveCopyAction(orderCopyActions(stored), "b", -1));
    expect(order(top)).toEqual(["b", "a", "c"]);
    const bottom = apply(stored, moveCopyAction(orderCopyActions(stored), "b", 1));
    expect(order(bottom)).toEqual(["a", "c", "b"]);
  });

  // One record per move, when there is room between the neighbours. Writing
  // every line on each move would make two devices that each move a different
  // line overwrite each other (ADR 0002).
  test("a move writes only the line that moved", () => {
    expect(moveCopyAction(orderCopyActions(stored), "c", -1).map((one) => one.id)).toEqual(["c"]);
  });

  test("a line at the edge does not move past it, and an unknown line does nothing", () => {
    expect(moveCopyAction(orderCopyActions(stored), "a", -1)).toEqual([]);
    expect(moveCopyAction(orderCopyActions(stored), "c", 1)).toEqual([]);
    expect(moveCopyAction(orderCopyActions(stored), "zz", 1)).toEqual([]);
    expect(moveCopyAction(null, "a", 1)).toEqual([]);
  });

  // Two lines made in the same moment leave no room between them. The move
  // then numbers every line again, which is rare and still lands right.
  test("with no room between two neighbours, every line is numbered again", () => {
    const tied = {
      a: { label: "A", template: "{N}", createdAt: first },
      b: { label: "B", template: "{N}", createdAt: first },
      c: { label: "C", template: "{N}", createdAt: first },
    };
    const writes = moveCopyAction(orderCopyActions(tied), "c", -1);
    expect(order(apply(tied, writes))).toEqual(["a", "c", "b"]);
  });

  test("many moves in the same place still land right", () => {
    let map = stored;
    for (let i = 0; i < 80; i += 1) {
      const id = order(map)[2];
      map = apply(map, moveCopyAction(orderCopyActions(map), id, -1));
    }
    expect(order(map)).toHaveLength(3);
    const before = order(map);
    const after = order(apply(map, moveCopyAction(orderCopyActions(map), before[2], -1)));
    expect(after).toEqual([before[0], before[2], before[1]]);
  });

  // The starting line has a `createdAt` from 1970, and a line with none at all
  // sorts first. Moving a line above either must still work.
  test("a line moves above the starting line and above a line with no date", () => {
    const withStart = withStartingActions({ a: { label: "A", template: "{N}", createdAt: first }, z: { label: "Z", template: "{N}" } });
    const before = order(withStart);
    expect(before).toEqual(["z", "branch-name", "a"]);
    const once = apply(withStart, moveCopyAction(orderCopyActions(withStart), "a", -1));
    expect(order(once)).toEqual(["z", "a", "branch-name"]);
    const twice = apply(once, moveCopyAction(orderCopyActions(once), "a", -1));
    expect(order(twice)).toEqual(["a", "z", "branch-name"]);
  });
});

// "Copy branch name" was a fixed row in the card menu (ADR 0021). It is a line
// the board starts with now, so the reader can rename it, limit it to some
// parts of the board, or remove it, like any line they wrote (ADR 0031).
describe("the line the board starts with", () => {
  const now = "2026-10-23T10:00:00.000Z";

  test("a board with no lines starts with one that copies the branch", () => {
    expect(orderCopyActions(withStartingActions(null))).toEqual([
      {
        id: "branch-name",
        label: "Copy branch name",
        template: "{BRANCH}",
        icon: "branch",
        areas: [],
        position: null,
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ]);
  });

  // It is read in, never written: a board that saved it on every device would
  // need a merge rule for the same line arriving twice. Nothing is in the file
  // until the reader changes it.
  test("the starting line is added to what is read, and the map handed in is not changed", () => {
    const stored = {};
    withStartingActions(stored);
    expect(stored).toEqual({});
  });

  // It sorts first because the fixed row sat above every line the reader wrote.
  test("it comes before the lines the reader wrote", () => {
    const stored = { a: { label: "Ask", template: "{URL}", createdAt: now, updatedAt: now } };
    expect(orderCopyActions(withStartingActions(stored)).map((one) => one.id)).toEqual(["branch-name", "a"]);
  });

  test("a starting line the reader edited reads as the reader wrote it", () => {
    const stored = {
      "branch-name": { label: "Branch", template: "git checkout {BRANCH}", createdAt: "1970-01-01T00:00:00.000Z", updatedAt: now },
    };
    expect(orderCopyActions(withStartingActions(stored))[0]).toMatchObject({ label: "Branch", template: "git checkout {BRANCH}" });
  });

  // A removed line keeps its key with an empty template (ADR 0002). That key is
  // what keeps the starting line from coming back on the next read.
  test("a starting line the reader removed stays removed", () => {
    const stored = { "branch-name": { label: "Copy branch name", template: "", createdAt: now, updatedAt: now } };
    expect(orderCopyActions(withStartingActions(stored))).toEqual([]);
  });

  test("never throws, whatever is in the file", () => {
    expect(orderCopyActions(withStartingActions([1, 2]))).toHaveLength(STARTING_ACTIONS.length);
    expect(orderCopyActions(withStartingActions("text"))).toHaveLength(STARTING_ACTIONS.length);
  });

  test("every starting line uses a placeholder this board fills and an icon it draws", () => {
    for (const one of STARTING_ACTIONS) {
      expect(placeholdersIn(one.template).length).toBeGreaterThan(0);
      expect(COPY_ICONS.map((icon) => icon.id)).toContain(one.icon);
    }
  });

  // Settings lists the examples until the reader writes a line. The starting
  // line is not one they wrote, so it must not hide the examples from a new
  // reader, who would then never see what a line can be.
  test("the starting line is not a line the reader wrote", () => {
    const own = { a: { label: "Ask", template: "{URL}", createdAt: now, updatedAt: now } };
    expect(writtenByReader(orderCopyActions(withStartingActions(null)))).toEqual([]);
    expect(writtenByReader(orderCopyActions(withStartingActions(own))).map((one) => one.id)).toEqual(["a"]);
    expect(writtenByReader(null)).toEqual([]);
  });

  test("the examples show the branch too, so a reader who removed it can write it again", () => {
    expect(EXAMPLE_ACTIONS.map((one) => one.template)).toContain("{BRANCH}");
  });
});

describe("the icon on a line", () => {
  test("the icon the reader picked travels with the line", () => {
    const stored = { a: { label: "Ask", template: "{URL}", icon: " eye ", createdAt: "", updatedAt: "" } };
    expect(orderCopyActions(stored)[0].icon).toBe("eye");
  });

  test("a line from before icons existed reads with no icon", () => {
    const stored = { a: { label: "Ask", template: "{URL}", createdAt: "", updatedAt: "" } };
    expect(orderCopyActions(stored)[0].icon).toBe("");
  });
});

// An icon is optional. A line with none, or with one this build does not know,
// draws the plain copy icon, so every row in the menu lines up (ADR 0031).
describe("readCopyIcon", () => {
  test("an icon from the list is drawn from its own paths", () => {
    const eye = COPY_ICONS.find((one) => one.id === "eye");
    expect(readCopyIcon("eye")).toEqual({ kind: "icon", id: "eye", paths: eye.paths });
  });

  test("one emoji is drawn as the emoji", () => {
    expect(readCopyIcon("🚀")).toEqual({ kind: "emoji", text: "🚀" });
    expect(readCopyIcon(" 🐛 ")).toEqual({ kind: "emoji", text: "🐛" });
  });

  // These are one emoji to the reader, and several code points to JavaScript.
  test("an emoji built from several code points is still one emoji", () => {
    expect(readCopyIcon("👩‍💻").kind).toBe("emoji");
    expect(readCopyIcon("🇬🇭").kind).toBe("emoji");
    expect(readCopyIcon("👍🏽").kind).toBe("emoji");
  });

  test("no icon, or anything that is not one icon, is the plain copy icon", () => {
    const plain = readCopyIcon("");
    expect(plain.kind).toBe("icon");
    expect(plain.id).toBe(DEFAULT_COPY_ICON);
    for (const other of [null, 7, "Rocket", "ab", "🚀🚀", "someday"]) expect(readCopyIcon(other)).toEqual(plain);
  });
});

// The box under the icon list takes whatever the keyboard sends. A second
// emoji typed after the first replaces it, because a line has one icon.
describe("pickEmoji", () => {
  test("keeps the last emoji typed", () => {
    expect(pickEmoji("🚀")).toBe("🚀");
    expect(pickEmoji("🚀🐛")).toBe("🐛");
    expect(pickEmoji("go 👩‍💻")).toBe("👩‍💻");
  });

  test("text with no emoji in it gives nothing", () => {
    expect(pickEmoji("")).toBe("");
    expect(pickEmoji("rocket")).toBe("");
    expect(pickEmoji(null)).toBe("");
  });
});

describe("what the reader is offered", () => {
  // An icon id is written into board.json, so the list carries one entry per
  // id, each with a name for the picker and something to draw.
  test("every icon in the list has its own id, a name and paths", () => {
    const ids = COPY_ICONS.map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_COPY_ICON);
    for (const one of COPY_ICONS) {
      expect(one.id).toMatch(/^[a-z-]+$/);
      expect(one.label.length).toBeGreaterThan(0);
      expect(one.paths.length).toBeGreaterThan(0);
    }
  });

  // A token is written into board.json the moment the reader saves a template,
  // so renaming one breaks every template already saved. The list is also what
  // Settings shows, so it carries its own words for each one.
  test("every placeholder is one word in braces, said once, with an explanation", () => {
    const tokens = PLACEHOLDERS.map((one) => one.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const one of PLACEHOLDERS) {
      expect(one.token).toMatch(/^\{[A-Z]+\}$/);
      expect(one.describe.length).toBeGreaterThan(0);
    }
  });

  // The shortest line there is: one placeholder and nothing around it. Both
  // other examples wrap words around a placeholder, so without this one a
  // reader could read the boxes as asking for a sentence.
  test("one example is a placeholder and nothing else", () => {
    expect(EXAMPLE_ACTIONS.map((one) => one.template)).toContain("{URL}");
  });

  // The examples are what an empty Settings shows, so a placeholder that is no
  // longer offered would be suggested to every new reader.
  test("each example uses only placeholders the board fills", () => {
    expect(EXAMPLE_ACTIONS.length).toBeGreaterThanOrEqual(2);
    for (const one of EXAMPLE_ACTIONS) {
      expect(one.label.length).toBeGreaterThan(0);
      expect(placeholdersIn(one.template).length).toBeGreaterThan(0);
      expect(one.template.match(/\{[A-Za-z]+\}/g)).toEqual(placeholdersIn(one.template));
    }
  });
});

// A line meant for work not started yet, such as a prompt that asks an agent
// to implement an issue, is noise on a card already in review. The reader
// picks the parts of the board where each line is offered.
describe("offeredIn", () => {
  test("a line with no parts picked is offered everywhere", () => {
    expect(offeredIn({ areas: [] }, "todo")).toBe(true);
    expect(offeredIn({ areas: [] }, "reviews")).toBe(true);
    expect(offeredIn({}, "done")).toBe(true);
    expect(offeredIn({ areas: [] }, "")).toBe(true);
  });

  test("a line with parts picked is offered only there", () => {
    const line = { areas: ["todo", "reviews"] };
    expect(offeredIn(line, "todo")).toBe(true);
    expect(offeredIn(line, "reviews")).toBe(true);
    expect(offeredIn(line, "ongoing")).toBe(false);
  });

  // A card the board cannot place belongs to no part, so only a line meant
  // for everywhere is offered on it.
  test("a card in no known part takes only the lines meant for everywhere", () => {
    expect(offeredIn({ areas: ["todo"] }, "")).toBe(false);
    expect(offeredIn({ areas: ["todo"] }, undefined)).toBe(false);
  });

  test("never throws on something that is not a line", () => {
    expect(offeredIn(null, "todo")).toBe(false);
  });
});
