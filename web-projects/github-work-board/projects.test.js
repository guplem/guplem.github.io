import { describe, expect, test } from "bun:test";
import {
  PROJECT_PATHS,
  applyProjects,
  normalizeProjects,
  projectFilterTip,
  projectLinkTip,
  readProjects,
  readProjectsAnswer,
} from "./projects.js";

const project = (title, extra = {}) => ({
  id: `P_${title}`,
  title,
  url: `https://github.com/orgs/acme/projects/${title.length}`,
  closed: false,
  ...extra,
});
const node = (id, ...projects) => ({ id, projectItems: { nodes: projects.map((one) => ({ project: one })) } });

describe("readProjects", () => {
  test("reads the name and the link of every project an item is in", () => {
    expect(readProjects(node("I_1", project("Iteration board"), project("Roadmap")))).toEqual([
      { title: "Iteration board", url: "https://github.com/orgs/acme/projects/15" },
      { title: "Roadmap", url: "https://github.com/orgs/acme/projects/7" },
    ]);
  });

  // A closed project is history, like a closed blocker (ADR 0051).
  test("leaves out a closed project", () => {
    expect(readProjects(node("I_1", project("Old", { closed: true }), project("Now")))).toEqual([
      { title: "Now", url: "https://github.com/orgs/acme/projects/3" },
    ]);
  });

  // GitHub answers null for a project item the token may not read, so a
  // partial answer must not throw.
  test("skips an entry GitHub refused, and never throws", () => {
    const answer = { id: "I_1", projectItems: { nodes: [null, { project: null }, { project: project("Ok") }] } };
    expect(readProjects(answer).map((one) => one.title)).toEqual(["Ok"]);
    expect(readProjects(null)).toEqual([]);
    expect(readProjects({ id: "I_1" })).toEqual([]);
  });

  test("names one project once, even when GitHub lists it twice", () => {
    expect(readProjects(node("I_1", project("Board"), project("Board"))).length).toBe(1);
  });

  // The link goes straight into `a.href`.
  test("keeps only a link to a page on GitHub", () => {
    expect(readProjects(node("I_1", project("Board", { url: "javascript:alert(1)" })))).toEqual([
      { title: "Board", url: "" },
    ]);
  });
});

describe("normalizeProjects", () => {
  test("keys the projects by the item's node id", () => {
    const byId = normalizeProjects([node("I_1", project("Board")), null, node("I_2")]);
    expect(Object.keys(byId)).toEqual(["I_1", "I_2"]);
    expect(byId.I_2).toEqual([]);
  });
});

describe("readProjectsAnswer", () => {
  test("a clean answer is a granted one", () => {
    const answer = readProjectsAnswer({ data: { nodes: [node("I_1", project("Board"))] } });
    expect(answer.granted).toBe(true);
    expect(answer.nodes.length).toBe(1);
  });

  // The permission is optional. A token without it is told so, and is not
  // reported as broken (ADR 0051).
  test("a refusal and no project read means the permission is missing", () => {
    const answer = readProjectsAnswer({
      data: { nodes: [{ id: "I_1", projectItems: { nodes: [null] } }] },
      errors: [{ type: "FORBIDDEN", message: "Resource not accessible by personal access token" }],
    });
    expect(answer.granted).toBe(false);
  });

  test("a refusal named only in the message counts too", () => {
    const answer = readProjectsAnswer({
      data: null,
      errors: [{ message: "Resource not accessible by personal access token" }],
    });
    expect(answer.granted).toBe(false);
    expect(answer.nodes).toEqual([]);
  });

  // One project refused beside one read means the permission is there: the
  // refused one belongs to an owner the token does not reach.
  test("a refusal beside a project that was read keeps what came back", () => {
    const answer = readProjectsAnswer({
      data: { nodes: [node("I_1", project("Board")), { id: "I_2", projectItems: { nodes: [null] } }] },
      errors: [{ type: "FORBIDDEN", message: "Resource not accessible by personal access token" }],
    });
    expect(answer.granted).toBe(true);
    expect(answer.nodes.length).toBe(2);
  });

  test("never throws on nonsense", () => {
    expect(readProjectsAnswer(null)).toEqual({ granted: true, nodes: [] });
    expect(readProjectsAnswer("x")).toEqual({ granted: true, nodes: [] });
  });
});

describe("applyProjects", () => {
  test("puts the projects on each item, and none on an item nobody asked about", () => {
    const items = [{ key: "I_1" }, { key: "I_2" }];
    const result = applyProjects(items, { I_1: [{ title: "Board", url: "" }] });
    expect(result).toEqual([{ key: "I_1", projects: [{ title: "Board", url: "" }] }, { key: "I_2", projects: [] }]);
    expect(items[0].projects).toBeUndefined();
  });
});

describe("the words and the icon", () => {
  test("the link half says where it goes", () => {
    expect(projectLinkTip({ title: "Board" })).toBe("Board. Open the project on GitHub");
  });

  test("the name half says what a press does", () => {
    expect(projectFilterTip({ title: "Board" }, false)).toBe("Show only the work in the project Board");
    expect(projectFilterTip({ title: "Board" }, true)).toBe("Show everything again, not only the project Board");
  });

  test("the icon is a list of paths", () => {
    expect(PROJECT_PATHS.length).toBeGreaterThan(0);
    for (const path of PROJECT_PATHS) expect(path).toMatch(/^M/);
  });
});
