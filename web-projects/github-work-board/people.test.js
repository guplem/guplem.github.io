import { describe, expect, test } from "bun:test";
import { APPROVED, ASKED, CHANGES_REQUESTED, initialsOf, personLabel, readPerson, reviewPeople } from "./people.js";

const user = (login, name = null, avatarUrl = `https://avatars.githubusercontent.com/${login}`) => ({
  login,
  name,
  avatarUrl,
});

describe("readPerson", () => {
  test("keeps the three things a face needs", () => {
    expect(readPerson(user("ivan03hdez", "Ivan Hernandez"))).toEqual({
      login: "ivan03hdez",
      name: "Ivan Hernandez",
      avatarUrl: "https://avatars.githubusercontent.com/ivan03hdez",
    });
  });

  // GitHub leaves `name` null for anybody who never filled it in, which is
  // common. The login is the one thing everybody has.
  test("a person with no name is known by their login", () => {
    expect(readPerson(user("PaulNdrei")).name).toBe("PaulNdrei");
  });

  // A review can be asked of a team, and the query only selects User fields,
  // so a team arrives as an object with nothing in it.
  test("anything without a login is nobody", () => {
    expect(readPerson({})).toBe(null);
    expect(readPerson(null)).toBe(null);
    expect(readPerson({ login: "" })).toBe(null);
    expect(readPerson("ivan")).toBe(null);
  });

  // The picture is a value from GitHub's answer that the page puts straight
  // into `img.src`. Only a real picture address is kept, so nothing else can
  // ever be loaded through it (ADR 0001).
  test("only an https picture is kept", () => {
    expect(readPerson({ login: "a", avatarUrl: "https://avatars.githubusercontent.com/u/1" }).avatarUrl).toBe(
      "https://avatars.githubusercontent.com/u/1",
    );
    expect(readPerson({ login: "a", avatarUrl: "http://example.com/x.png" }).avatarUrl).toBe("");
    expect(readPerson({ login: "a", avatarUrl: "javascript:alert(1)" }).avatarUrl).toBe("");
    expect(readPerson({ login: "a", avatarUrl: "data:image/png;base64,AAAA" }).avatarUrl).toBe("");
  });

  test("a person with no picture is still a person", () => {
    expect(readPerson({ login: "someone" })).toEqual({ login: "someone", name: "someone", avatarUrl: "" });
  });
});

describe("initialsOf", () => {
  test("two letters from a name, one from a single word", () => {
    expect(initialsOf({ login: "ivan03hdez", name: "Ivan Hernandez" })).toBe("IH");
    expect(initialsOf({ login: "paul", name: "Paul" })).toBe("P");
  });

  test("falls back to the login when there is no name", () => {
    expect(initialsOf({ login: "PaulNdrei", name: "PaulNdrei" })).toBe("P");
  });

  test("never throws, and never returns nothing to draw", () => {
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf({ login: "", name: "" })).toBe("?");
  });
});

describe("reviewPeople", () => {
  const asked = (...logins) => ({ nodes: logins.map((login) => ({ requestedReviewer: user(login) })) });
  const reviewed = (...pairs) => ({ nodes: pairs.map(([login, state]) => ({ state, author: user(login) })) });

  test("says who was asked and has not answered", () => {
    const people = reviewPeople(asked("ana"), reviewed());
    expect(people).toEqual([{ login: "ana", name: "ana", avatarUrl: "https://avatars.githubusercontent.com/ana", state: ASKED }]);
  });

  // The case that decided the whole feature, from a real pull request: it had
  // no pending request left and one reviewer who had asked for changes.
  // Showing only the pending requests would have drawn an empty card exactly
  // where the reader most needs a face (ADR 0028).
  test("says who asked for changes, even though they are no longer a pending request", () => {
    const people = reviewPeople(asked(), reviewed(["ivan", "CHANGES_REQUESTED"]));
    expect(people.map((one) => [one.login, one.state])).toEqual([["ivan", CHANGES_REQUESTED]]);
  });

  test("says who approved", () => {
    const people = reviewPeople(asked(), reviewed(["ana", "APPROVED"]));
    expect(people.map((one) => one.state)).toEqual([APPROVED]);
  });

  // Somebody asked to look again is waiting on, not blocking: the board reads
  // the same pull request as "awaiting review" for the same reason (ADR 0011).
  test("somebody asked again is waiting on, not blocking", () => {
    const people = reviewPeople(asked("ivan"), reviewed(["ivan", "CHANGES_REQUESTED"]));
    expect(people.map((one) => [one.login, one.state])).toEqual([["ivan", ASKED]]);
  });

  // The reader looks at this to decide what to do next. What blocks them comes
  // first, then what they can chase, then what is already done.
  test("blocking first, then waiting on, then finished", () => {
    const people = reviewPeople(asked("ana"), reviewed(["ivan", "CHANGES_REQUESTED"], ["leo", "APPROVED"]));
    expect(people.map((one) => one.login)).toEqual(["ivan", "ana", "leo"]);
  });

  test("nobody is counted twice", () => {
    const people = reviewPeople(asked("ana", "ana"), reviewed(["ana", "APPROVED"]));
    expect(people.map((one) => one.login)).toEqual(["ana"]);
  });

  // A review asked of a team has no User fields, and a comment is not an
  // opinion about whether the work can land.
  test("skips a team, and skips anything that is not a verdict", () => {
    expect(reviewPeople({ nodes: [{ requestedReviewer: {} }] }, reviewed())).toEqual([]);
    expect(reviewPeople(asked(), reviewed(["ana", "COMMENTED"]))).toEqual([]);
  });

  test("never throws, whatever it is handed", () => {
    expect(reviewPeople(null, null)).toEqual([]);
    expect(reviewPeople({}, {})).toEqual([]);
    expect(reviewPeople({ nodes: "no" }, { nodes: 7 })).toEqual([]);
  });
});

describe("personLabel", () => {
  test("says who, and what the board is waiting on them for", () => {
    const ivan = { login: "ivan03hdez", name: "Ivan Hernandez" };
    expect(personLabel(ivan, CHANGES_REQUESTED)).toBe("Ivan Hernandez asked for changes");
    expect(personLabel(ivan, ASKED)).toBe("Ivan Hernandez has not reviewed yet");
    expect(personLabel(ivan, APPROVED)).toBe("Ivan Hernandez approved");
  });

  // On a review card the people are assignees, and there is no review state to
  // report about them.
  test("with no state it is only the name", () => {
    expect(personLabel({ login: "ana", name: "Ana" })).toBe("Ana");
  });

  test("never throws", () => {
    expect(personLabel(null)).toBe("");
  });
});
