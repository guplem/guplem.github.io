import { describe, it, expect } from "bun:test";
import {
  localWebProjectPath,
  teaserMarkdown,
  sortByDateDescending,
  selectWebProjects,
  projectMatchesQuery,
  filterProjectsByText,
} from "./discovery.js";

describe("localWebProjectPath", () => {
  it("returns the folder path for a relative web-projects link", () => {
    const work = { links: [{ url: "web-projects/rps-mind-reader/" }] };
    expect(localWebProjectPath(work)).toBe("rps-mind-reader/");
  });

  it("strips our own origin from an absolute web-projects link", () => {
    const work = { links: [{ url: "https://triunitystudios.com/web-projects/photo-editor/" }] };
    expect(localWebProjectPath(work)).toBe("photo-editor/");
  });

  it("keeps a deep path such as a specific HTML entry file", () => {
    const work = { links: [{ url: "https://triunitystudios.com/web-projects/ChatGPTPong/pong.html" }] };
    expect(localWebProjectPath(work)).toBe("ChatGPTPong/pong.html");
  });

  it("ignores the github source link and uses the live demo link", () => {
    const work = {
      links: [
        { url: "web-projects/taboo-game/" },
        { type: "github", url: "https://github.com/guplem/guplem.github.io/tree/main/web-projects/taboo-game" },
      ],
    };
    expect(localWebProjectPath(work)).toBe("taboo-game/");
  });

  it("returns null when the only link is a github source link (even though it contains web-projects/)", () => {
    const work = {
      links: [{ type: "github", url: "https://github.com/guplem/guplem.github.io/tree/main/web-projects/rps-mind-reader" }],
    };
    expect(localWebProjectPath(work)).toBeNull();
  });

  it("returns null for a project whose only link is an external (non-web-projects) github repo", () => {
    const work = { links: [{ type: "github", url: "https://github.com/guplem/trmnl-cal-weather" }] };
    expect(localWebProjectPath(work)).toBeNull();
  });

  it("returns null for a demo link hosted on a different domain", () => {
    const work = { links: [{ url: "https://example.com/some-app/" }] };
    expect(localWebProjectPath(work)).toBeNull();
  });

  it("returns null when there are no links", () => {
    expect(localWebProjectPath({})).toBeNull();
    expect(localWebProjectPath({ links: [] })).toBeNull();
    expect(localWebProjectPath(null)).toBeNull();
  });
});

describe("teaserMarkdown", () => {
  it("returns the first description paragraph", () => {
    const project = { description: ["First paragraph.", "Second paragraph."] };
    expect(teaserMarkdown(project)).toBe("First paragraph.");
  });

  it("returns an empty string when there is no description", () => {
    expect(teaserMarkdown({})).toBe("");
    expect(teaserMarkdown({ description: [] })).toBe("");
  });
});

describe("sortByDateDescending", () => {
  it("orders newest year first", () => {
    const sorted = sortByDateDescending([{ date: "2022" }, { date: "2026" }, { date: "2025" }]);
    expect(sorted.map((entry) => entry.date)).toEqual(["2026", "2025", "2022"]);
  });

  it("keeps original order for equal dates (stable)", () => {
    const sorted = sortByDateDescending([
      { date: "2026", id: "a" },
      { date: "2026", id: "b" },
      { date: "2026", id: "c" },
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("pushes entries with an unparseable date to the end", () => {
    const sorted = sortByDateDescending([{ date: "not-a-date" }, { date: "2026" }]);
    expect(sorted.map((entry) => entry.date)).toEqual(["2026", "not-a-date"]);
  });
});

describe("selectWebProjects", () => {
  const works = [
    {
      title: "RPS Mind Reader",
      date: "2026",
      description: ["*RPS* teaser."],
      skills: ["Vibe Coded", "AI Integration"],
      links: [{ url: "web-projects/rps-mind-reader/" }, { type: "github", url: "https://github.com/x/web-projects/rps-mind-reader" }],
    },
    {
      title: "TRMNL Calendar + Weather",
      date: "2026",
      description: ["External plugin."],
      skills: ["Frontend"],
      links: [{ type: "github", url: "https://github.com/guplem/trmnl-cal-weather" }],
    },
    {
      title: "ChatGPT Pong",
      date: "2022",
      description: ["Classic Pong."],
      image: "resources/images/projects/chatGPTPong.webp",
      imageAlt: "Pong screenshot",
      skills: ["Vibe Coded"],
      links: [{ url: "https://triunitystudios.com/web-projects/ChatGPTPong/pong.html" }],
    },
  ];

  it("keeps only locally hosted web-projects", () => {
    const titles = selectWebProjects(works).map((card) => card.title);
    expect(titles).toEqual(["RPS Mind Reader", "ChatGPT Pong"]);
  });

  it("sorts the selected projects newest-first", () => {
    const dates = selectWebProjects(works).map((card) => card.date);
    expect(dates).toEqual(["2026", "2022"]);
  });

  it("builds a view-model with the path relative to web-projects/", () => {
    const pong = selectWebProjects(works).find((card) => card.title === "ChatGPT Pong");
    expect(pong).toMatchObject({
      path: "ChatGPTPong/pong.html",
      image: "resources/images/projects/chatGPTPong.webp",
      imageAlt: "Pong screenshot",
      teaser: "Classic Pong.",
      skills: ["Vibe Coded"],
    });
  });

  it("uses null for a project without an image", () => {
    const rps = selectWebProjects(works).find((card) => card.title === "RPS Mind Reader");
    expect(rps.image).toBeNull();
  });

  it("returns an empty array for invalid input", () => {
    expect(selectWebProjects(null)).toEqual([]);
    expect(selectWebProjects(undefined)).toEqual([]);
  });
});

describe("projectMatchesQuery", () => {
  const project = {
    title: "RPS Mind Reader",
    teaser: "A rock-paper-scissors game where an AI learns your habits.",
    skills: ["Vibe Coded", "AI Integration"],
  };

  it("matches everything for an empty or whitespace query", () => {
    expect(projectMatchesQuery(project, "")).toBe(true);
    expect(projectMatchesQuery(project, "   ")).toBe(true);
    expect(projectMatchesQuery(project, undefined)).toBe(true);
  });

  it("matches on the title, case-insensitively", () => {
    expect(projectMatchesQuery(project, "mind reader")).toBe(true);
    expect(projectMatchesQuery(project, "RPS")).toBe(true);
  });

  it("matches on a word from the teaser", () => {
    expect(projectMatchesQuery(project, "habits")).toBe(true);
  });

  it("matches on a skill tag", () => {
    expect(projectMatchesQuery(project, "vibe")).toBe(true);
  });

  it("requires every whitespace-separated token to match (AND)", () => {
    expect(projectMatchesQuery(project, "rps ai")).toBe(true);
    expect(projectMatchesQuery(project, "rps chess")).toBe(false);
  });

  it("returns false when nothing matches", () => {
    expect(projectMatchesQuery(project, "spreadsheet")).toBe(false);
  });
});

describe("filterProjectsByText", () => {
  const projects = [
    { title: "RPS Mind Reader", teaser: "Adaptive AI opponent.", skills: ["AI Integration"] },
    { title: "Gravity Sandbox", teaser: "N-body simulation.", skills: ["Vibe Coded"] },
    { title: "Taboo Game", teaser: "Deterministic multiplayer party game.", skills: ["Vibe Coded"] },
  ];

  it("returns every project for an empty query", () => {
    expect(filterProjectsByText(projects, "").length).toBe(3);
  });

  it("returns only the matching projects", () => {
    const titles = filterProjectsByText(projects, "game").map((p) => p.title);
    expect(titles).toEqual(["Taboo Game"]);
  });

  it("returns an empty array for invalid input", () => {
    expect(filterProjectsByText(null, "game")).toEqual([]);
  });
});
