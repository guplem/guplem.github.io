// The promises this project must not break by accident.
//
// Every test here guards a decision that is cheap to undo without noticing and
// expensive to discover later: a second file that quietly starts calling the
// network with the key, a renamed storage key that loses the saved one, a CDN
// import on a page that holds a credential. A normal unit test says "this
// function works". These say "this decision still holds". When one fails, read
// the ADR it names before you change the test.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { DEFAULT_DECISION_MODEL, DEFAULT_NARRATIVE_MODEL } from "./models.js";
import { ORDER_STRATEGIES } from "./orderStrategies.js";
import { STORAGE_KEYS } from "./settings.js";
import { VISUAL_TAGS } from "./tileset.js";
import { VIEWS } from "./urlState.js";
import { VOCABULARY_SCHEMA } from "./vocabulary.js";

const FOLDER = import.meta.dir;
const sourceFiles = readdirSync(FOLDER).filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
const read = (name) => readFileSync(join(FOLDER, name), "utf8");

describe("the key lives in this browser and goes to OpenRouter only (ADR 0001)", () => {
  test("only openRouterClient.js calls the network", () => {
    const callers = sourceFiles.filter((name) => name !== "openRouterClient.js" && /\bfetch\s*\(/.test(read(name)));
    expect(callers).toEqual([]);
  });

  test("openRouterClient.js talks to openrouter.ai and nowhere else", () => {
    const hosts = [...read("openRouterClient.js").matchAll(/https?:\/\/([a-z0-9.-]+)/g)].map((match) => match[1]);
    expect([...new Set(hosts)].sort()).toEqual(["openrouter.ai", "triunitystudios.com"]);
    // triunitystudios.com appears once, as the HTTP-Referer header value, not as a host that is called.
    expect(read("openRouterClient.js")).toContain('const API = "https://openrouter.ai"');
  });

  test("only settings.js touches localStorage", () => {
    const callers = sourceFiles.filter((name) => name !== "settings.js" && /localStorage/.test(read(name)));
    expect(callers).toEqual([]);
  });

  test("the storage keys are exactly these, because renaming one loses the saved key", () => {
    expect(STORAGE_KEYS).toEqual({ apiKey: "ai-world-gen.apiKey", models: "ai-world-gen.models" });
  });

  test("no module writes the key into the address bar", () => {
    for (const name of sourceFiles) {
      expect(read(name)).not.toMatch(/(searchParams|URLSearchParams)[\s\S]{0,120}apiKey/i);
    }
    expect(read("urlState.js")).not.toContain("apiKey");
  });

  test("nothing is imported from outside this folder or from a CDN", () => {
    for (const name of sourceFiles) {
      expect(read(name)).not.toMatch(/from\s+["']\.\.\//);
      expect(read(name)).not.toMatch(/from\s+["']https?:/);
    }
    expect(read("index.html")).not.toMatch(/<script[^>]+src=["']https?:/);
  });

  test("the page tells the reader where the key lives, next to the input", () => {
    const page = read("index.html");
    expect(page).toContain('id="api-key"');
    expect(page).toContain("The key stays in this browser and is sent only to openrouter.ai");
    expect(page).toContain('id="forget-key"');
  });
});

describe("two kinds of model, two kinds of call (ADR 0002)", () => {
  test("the client has a generate() for text and a decide() for typed decisions", () => {
    const source = read("openRouterClient.js");
    expect(source).toContain("export async function generate(");
    expect(source).toContain("export function decide(");
    expect(source).toContain("/api/v1/chat/completions");
    expect(source).toContain("/api/alpha/decisions");
  });

  test("the defaults are Jev for decisions and Claude Sonnet for narrative", () => {
    expect(DEFAULT_DECISION_MODEL).toBe("~typesafe/jev-latest");
    expect(DEFAULT_NARRATIVE_MODEL).toMatch(/^anthropic\/claude-sonnet/);
  });

  test("the vocabulary schema makes every type declare its own instanceFields", () => {
    const fields = VOCABULARY_SCHEMA.properties.elements.items.properties;
    expect(fields.instanceFields.type).toBe("array");
    expect(VOCABULARY_SCHEMA.properties.elements.items.required).toContain("instanceFields");
  });

  test("the generation loop never names the network", () => {
    expect(read("generation.js")).not.toMatch(/fetch|openrouter/i);
    expect(read("cellDecision.js")).not.toMatch(/fetch|openrouter/i);
  });
});

describe("the vocabulary names tags, never tiles (ADR 0003)", () => {
  test("no sheet coordinate is written outside tileset.js", () => {
    const others = sourceFiles.filter((name) => name !== "tileset.js" && /TILE_PITCH\s*\*|\*\s*TILE_PITCH/.test(read(name)));
    expect(others).toEqual([]);
  });

  test("the fallback tag exists, so an unknown tag draws something visible", () => {
    expect(VISUAL_TAGS.unknown).toBeDefined();
  });
});

describe("names that travel in links never change (root ADR 0006)", () => {
  test("the views", () => {
    expect(VIEWS).toEqual(["setup", "ai", "map"]);
  });

  test("the generation orders", () => {
    expect(ORDER_STRATEGIES.map((one) => one.id)).toEqual(["spiral", "random", "clustered", "branching", "frontier"]);
  });
});

describe("the page itself", () => {
  test("carries the deploy stamp block the generator looks for (root ADR 0013)", () => {
    const page = read("index.html");
    expect(page).toContain("<!-- BEGIN GENERATED:DEPLOY -->");
    expect(page).toContain("<!-- END GENERATED:DEPLOY -->");
    expect(page).toContain('id="deploy-line"');
  });

  test("app.js writes no innerHTML of its own; the deploy line carries its escaper", () => {
    expect(read("app.js")).not.toMatch(/\.innerHTML\s*=/);
  });

  test("credits the tileset, whose licence asks for nothing but deserves it", () => {
    expect(read("index.html")).toContain("Urizen");
    expect(read("README.md")).toContain("Urizen");
  });

  test("every control answers the pointer and the keyboard", () => {
    const css = read("style.css");
    for (const variant of ["button-primary", "button-outline", "button-danger"]) expect(css).toContain(`.${variant}:hover`);
    expect(css).toContain(".button:active");
    expect(css).toContain(".button:focus-visible");
    expect(css).toContain(".input:hover");
    expect(css).toContain(".input:focus");
    expect(css).toContain(".chip:hover");
    expect(css).toContain(".chip:focus-visible");
    expect(css).toContain(".view-tab:focus-visible");
  });
});
