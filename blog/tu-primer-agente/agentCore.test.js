// Tests for the logic behind the tutorial's extras: the app picker, the
// address that remembers the reader's choices, and the folder check.
//
// The page works without any of this (every variant is text in the HTML).
// These functions only decide what the extras show, so the tests pin the
// decisions: which app a set of subscriptions leads to, which address a
// choice writes, and which part of a folder is right or wrong.

import { describe, expect, test } from "bun:test";
import { APP_IDS, EXAMPLE_IDS, animationEnd, animationSteps, checkFolder, parseFrontmatter, readState, recommendApps, stepAfter, stepBefore, writeQuery } from "./agentCore.js";

describe("recommendApps", () => {
  test("returns null when the reader has ticked nothing", () => {
    expect(recommendApps([])).toBeNull();
  });

  test("sends a Claude subscriber to the Claude app", () => {
    expect(recommendApps(["claude"])).toEqual({ best: "claude", alternatives: [], warnings: [] });
  });

  test("sends a ChatGPT user to Codex, with the open app as the alternative", () => {
    expect(recommendApps(["chatgpt"])).toEqual({ best: "codex", alternatives: ["goose"], warnings: [] });
  });

  test("sends a Gemini subscriber to Antigravity, says it is made for code, and offers Goose with a Gemini key", () => {
    expect(recommendApps(["gemini"])).toEqual({ best: "antigravity", alternatives: ["goose"], warnings: ["made-for-code"] });
  });

  test("warns that Goose cannot use a Claude subscription when Goose leads", () => {
    expect(recommendApps(["api", "claude"]).warnings).toContain("no-claude-in-goose");
    expect(recommendApps(["claude"]).warnings).not.toContain("no-claude-in-goose");
  });

  test("puts the open app first when the reader has an API key", () => {
    expect(recommendApps(["api", "chatgpt"]).best).toBe("goose");
    expect(recommendApps(["api", "chatgpt"]).alternatives).toEqual(["codex"]);
  });

  test("warns that no app uses a ChatGPT and a Claude subscription together", () => {
    const result = recommendApps(["chatgpt", "claude"]);
    expect(result.best).toBe("claude");
    expect(result.alternatives).toEqual(["codex", "goose"]);
    expect(result.warnings).toContain("no-app-uses-both");
  });

  test("starts a reader with nothing on the free ChatGPT app, and ignores other ticks next to 'nothing'", () => {
    // The ChatGPT app is the simplest start and Codex works on the free plan; Antigravity is the free fallback.
    expect(recommendApps(["none"])).toEqual({ best: "codex", alternatives: ["antigravity", "goose"], warnings: [] });
    expect(recommendApps(["none", "claude"]).best).toBe("codex");
  });

  test("never names an app twice, and names only known apps", () => {
    for (const subs of [["chatgpt"], ["api"], ["chatgpt", "claude", "gemini", "api"]]) {
      const { best, alternatives } = recommendApps(subs);
      const all = [best, ...alternatives];
      expect(new Set(all).size).toBe(all.length);
      for (const app of all) expect(APP_IDS).toContain(app);
    }
  });

  test("ignores a subscription it does not know", () => {
    expect(recommendApps(["myspace"])).toBeNull();
  });
});

describe("readState and writeQuery", () => {
  test("reads a known app and example from the address", () => {
    expect(readState("?app=goose&ejemplo=salud")).toEqual({ app: "goose", example: "salud" });
  });

  test("accepts the English parameter name for the example", () => {
    expect(readState("?app=codex&example=diario")).toEqual({ app: "codex", example: "diario" });
  });

  test("drops values it does not know, so a broken link cannot break the page", () => {
    expect(readState("?app=<script>&ejemplo=zzz")).toEqual({ app: null, example: null });
    expect(readState("")).toEqual({ app: null, example: null });
  });

  test("writes only the choices that are set, with the page's own parameter name", () => {
    expect(writeQuery({ app: "claude", example: "docente" }, "ejemplo")).toBe("?app=claude&ejemplo=docente");
    expect(writeQuery({ app: null, example: "reforma" }, "example")).toBe("?example=reforma");
    expect(writeQuery({ app: null, example: null }, "ejemplo")).toBe("");
  });

  test("knows the five examples", () => {
    expect(EXAMPLE_IDS).toEqual(["estudiante", "docente", "salud", "diario", "reforma"]);
  });
});

describe("parseFrontmatter", () => {
  test("reads name and description from the block between the two --- lines", () => {
    const text = "---\nname: preparar-examen\ndescription: Prepara un examen de práctica.\n---\n\n# Pasos\n";
    expect(parseFrontmatter(text)).toEqual({ name: "preparar-examen", description: "Prepara un examen de práctica." });
  });

  test("strips quotes and accepts Windows line ends", () => {
    expect(parseFrontmatter('---\r\nname: "repasar"\r\ndescription: \'Repasa un tema.\'\r\n---\r\n')).toEqual({ name: "repasar", description: "Repasa un tema." });
  });

  test("returns null when the file has no frontmatter", () => {
    expect(parseFrontmatter("# Solo un título\n")).toBeNull();
  });
});

// Paths are relative to the agent's folder, as the page passes them.
const goodFolder = [
  { path: "AGENTS.md", text: "# Mi tutor\n\nEres mi tutor de Biología. Guardas mis apuntes en datos/." },
  { path: "datos/temas.md", text: "# Temas\n" },
  { path: "exportaciones/examen.md", text: "" },
  { path: "scripts/progreso.py", text: "" },
  { path: ".agents/skills/preparar-examen/SKILL.md", text: "---\nname: preparar-examen\ndescription: Prepara un examen.\n---\n" },
];
const names = { dataDir: "datos", exportsDir: "exportaciones" };
const statusOf = (results, id) => results.find((result) => result.id === id)?.status;

describe("checkFolder", () => {
  test("passes a complete folder for an app that reads .agents/skills", () => {
    const results = checkFolder(goodFolder, { app: "goose", ...names });
    expect(results.every((result) => result.status === "ok")).toBe(true);
  });

  test("finds the skills folder of the chosen app, and points at the other one", () => {
    const results = checkFolder(goodFolder, { app: "claude", ...names });
    expect(statusOf(results, "skills")).toBe("warn");
    expect(results.find((result) => result.id === "skills").detail).toBe(".agents/skills");
  });

  test("checks every app's skills folder when no app is chosen", () => {
    expect(statusOf(checkFolder(goodFolder, { app: null, ...names }), "skills")).toBe("ok");
  });

  test("spots an AGENTS.md saved as a .txt file, a common slip on Windows", () => {
    const folder = goodFolder.map((file) => (file.path.endsWith("AGENTS.md") ? { ...file, path: "AGENTS.md.txt" } : file));
    const results = checkFolder(folder, { app: "goose", ...names });
    expect(statusOf(results, "agents-md")).toBe("missing");
    expect(results.find((result) => result.id === "agents-md").detail).toBe("AGENTS.md.txt");
  });

  test("spots an AGENTS.md with the wrong capital letters", () => {
    const folder = goodFolder.map((file) => (file.path.endsWith("AGENTS.md") ? { ...file, path: "agents.md" } : file));
    expect(checkFolder(folder, { app: "goose", ...names }).find((result) => result.id === "agents-md")).toEqual({ id: "agents-md", status: "warn", detail: "agents.md" });
  });

  test("warns about an AGENTS.md that is almost empty", () => {
    const folder = goodFolder.map((file) => (file.path.endsWith("AGENTS.md") ? { ...file, text: "hola" } : file));
    expect(statusOf(checkFolder(folder, { app: "goose", ...names }), "agents-md-content")).toBe("warn");
  });

  test("reports a missing data folder, and an exports folder it cannot see as unknown", () => {
    const folder = goodFolder.filter((file) => !file.path.startsWith("datos/") && !file.path.startsWith("exportaciones/"));
    const results = checkFolder(folder, { app: "goose", ...names });
    expect(statusOf(results, "data")).toBe("missing");
    // A browser lists files, not folders, so an empty folder is invisible.
    expect(statusOf(results, "exports")).toBe("unknown");
  });

  test("says it cannot see the skills when the browser hides folders that start with a dot", () => {
    // Safari's folder picker leaves out .agents and .claude, so "no skills" would be a false alarm there.
    const folder = goodFolder.filter((file) => !file.path.includes("SKILL.md"));
    expect(statusOf(checkFolder(folder, { app: "goose", ...names, seesHiddenFolders: false }), "skills")).toBe("unknown");
    expect(statusOf(checkFolder(folder, { app: "goose", ...names }), "skills")).toBe("missing");
  });

  test("treats the scripts folder as optional", () => {
    const folder = goodFolder.filter((file) => !file.path.startsWith("scripts/"));
    expect(statusOf(checkFolder(folder, { app: "goose", ...names }), "scripts")).toBe("optional");
  });

  test("flags a skill whose name does not match its folder, or that lacks a description", () => {
    const folder = [
      ...goodFolder.filter((file) => !file.path.includes("SKILL.md")),
      { path: ".agents/skills/repasar/SKILL.md", text: "---\nname: repaso\ndescription: Repasa.\n---\n" },
      { path: ".agents/skills/resumir/SKILL.md", text: "---\nname: resumir\n---\n" },
    ];
    const results = checkFolder(folder, { app: "goose", ...names });
    expect(results.find((result) => result.id === "skill-format")).toEqual({ id: "skill-format", status: "warn", detail: "repasar, resumir" });
  });

  test("says the folder is empty when there is nothing to check", () => {
    expect(checkFolder([], { app: "goose", ...names })).toEqual([{ id: "empty", status: "missing" }]);
  });
});

// A drawing's timing as the page reads it from its CSS animations: a delay in
// ms, one cycle in ms, and the opacity at each keyframe offset.
const fadeIn = (delay, from, to) => ({ delay, duration: 10000, keyframes: [{ offset: 0, opacity: 0 }, { offset: from, opacity: 0 }, { offset: to, opacity: 1 }, { offset: 0.95, opacity: 1 }, { offset: 1, opacity: 0 }] });

describe("animationSteps", () => {
  test("lists, in order, the moment each piece is fully shown", () => {
    expect(animationSteps([fadeIn(0, 0.3, 0.33), fadeIn(0, 0.1, 0.13)])).toEqual([1300, 3300]);
  });

  test("adds the delay of a piece that starts later", () => {
    expect(animationSteps([fadeIn(400, 0.1, 0.13)])).toEqual([1700]);
  });

  test("counts a piece that brightens from dim to full, and ignores one that only fades out", () => {
    const brighten = { delay: 0, duration: 10000, keyframes: [{ offset: 0, opacity: 0.35 }, { offset: 0.55, opacity: 0.35 }, { offset: 0.62, opacity: 1 }, { offset: 1, opacity: 0.35 }] };
    const fadeOut = { delay: 0, duration: 10000, keyframes: [{ offset: 0, opacity: 1 }, { offset: 0.4, opacity: 1 }, { offset: 0.42, opacity: 0 }, { offset: 1, opacity: 0 }] };
    expect(animationSteps([brighten, fadeOut])).toEqual([6200]);
  });

  test("ignores an animation that never changes the opacity", () => {
    const draw = { delay: 0, duration: 10000, keyframes: [{ offset: 0 }, { offset: 0.5 }, { offset: 1 }] };
    expect(animationSteps([draw])).toEqual([]);
  });

  test("merges pieces that show at the same moment", () => {
    expect(animationSteps([fadeIn(0, 0.1, 0.13), fadeIn(0, 0.1, 0.13)])).toEqual([1300]);
  });
});

describe("stepAfter and stepBefore", () => {
  const steps = [1000, 2000, 3000];
  test("move to the next and the previous step", () => {
    expect(stepAfter(steps, 1000)).toBe(2000);
    expect(stepAfter(steps, 1500)).toBe(2000);
    expect(stepBefore(steps, 2000)).toBe(1000);
    expect(stepBefore(steps, 2500)).toBe(2000);
  });

  test("start again from the empty drawing at either end", () => {
    expect(stepAfter(steps, 3000)).toBe(0);
    expect(stepBefore(steps, 1000)).toBe(0);
    expect(stepBefore(steps, 0)).toBe(0);
  });
});

describe("animationEnd", () => {
  test("ends where the finished picture starts to clear", () => {
    expect(animationEnd([fadeIn(0, 0.1, 0.13), fadeIn(0, 0.3, 0.33)])).toBe(9500);
  });

  test("ignores a piece that leaves on purpose before the last step", () => {
    const cover = { delay: 0, duration: 10000, keyframes: [{ offset: 0, opacity: 0 }, { offset: 0.2, opacity: 1 }, { offset: 0.25, opacity: 1 }, { offset: 0.27, opacity: 0 }, { offset: 1, opacity: 0 }] };
    expect(animationEnd([cover, fadeIn(0, 0.3, 0.33)])).toBe(9500);
  });

  test("takes the earliest clear, so no piece is already fading", () => {
    const early = { delay: 0, duration: 10000, keyframes: [{ offset: 0, opacity: 0 }, { offset: 0.5, opacity: 1 }, { offset: 0.92, opacity: 1 }, { offset: 0.97, opacity: 0 }, { offset: 1, opacity: 0 }] };
    expect(animationEnd([early, fadeIn(0, 0.3, 0.33)])).toBe(9200);
  });

  test("returns null for a drawing with no steps", () => {
    expect(animationEnd([])).toBeNull();
  });
});
