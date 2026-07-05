// Unit tests for the static SEO block builders, plus the drift guards: CI
// fails when data/ changes without regenerating the committed HTML
// (fix: bun scripts/generateSeoBlocks.js).

import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { escapeHtml, injectBlock, buildHeroHtml, buildAboutHtml, buildWorksHtml, buildWebProjectsIndexHtml } from "./generateSeoBlocks.js";
import { loadInfo, loadWorks } from "./portfolioData.js";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");

describe("escapeHtml", () => {
  it("escapes the HTML-significant characters", () => {
    expect(escapeHtml(`Drink & Play <b> "quoted"`)).toBe("Drink &amp; Play &lt;b&gt; &quot;quoted&quot;");
  });

  it("passes plain text through unchanged", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });
});

describe("injectBlock", () => {
  const document = `<div>\n  <!-- BEGIN GENERATED:HERO -->\nold\n  <!-- END GENERATED:HERO -->\n</div>`;

  it("replaces the content between the markers", () => {
    const result = injectBlock(document, "HERO", "<h1>new</h1>");
    expect(result).toContain("<h1>new</h1>");
    expect(result).not.toContain("old");
    expect(result).toContain("<!-- BEGIN GENERATED:HERO -->");
    expect(result).toContain("<!-- END GENERATED:HERO -->");
  });

  it("is idempotent for the same content", () => {
    const once = injectBlock(document, "HERO", "<h1>new</h1>");
    expect(injectBlock(once, "HERO", "<h1>new</h1>")).toBe(once);
  });

  it("throws when the marker pair is missing", () => {
    expect(() => injectBlock(document, "ABOUT", "<p>x</p>")).toThrow("GENERATED:ABOUT");
  });
});

describe("buildHeroHtml", () => {
  it("renders one h1 per introduction line, markdown stripped", () => {
    const info = { introduction: "Hi! I'm **Guillem**\nI build *things*." };
    expect(buildHeroHtml(info)).toBe("<h1>Hi! I'm Guillem</h1>\n<h1>I build things.</h1>");
  });
});

describe("buildAboutHtml", () => {
  it("renders one paragraph per entry, markdown stripped and newlines collapsed", () => {
    const info = { aboutMe: ["#### Title\nFirst **bold** line", "See [my profile](https://example.com)"] };
    expect(buildAboutHtml(info)).toBe("<p>Title First bold line</p>\n<p>See my profile</p>");
  });
});

describe("buildWorksHtml", () => {
  const work = {
    title: "Drink & Play",
    date: "2020",
    description: ["*Drink & Play* is a **party game**."],
    skills: ["Unity", "C#"],
    links: [{ url: "https://example.com/play" }, { type: "github", url: "https://github.com/guplem/drink" }],
  };

  it("links the title to the primary link and escapes entities", () => {
    const html = buildWorksHtml([work]);
    expect(html).toContain(`<h3><a href="https://example.com/play">Drink &amp; Play</a></h3>`);
  });

  it("renders date, plain-text description, and skills", () => {
    const html = buildWorksHtml([work]);
    expect(html).toContain("<p>2020</p>");
    expect(html).toContain("<p>Drink &amp; Play is a party game.</p>");
    expect(html).toContain("<p>Skills: Unity, C#</p>");
  });

  it("renders the remaining links with a typed label", () => {
    expect(buildWorksHtml([work])).toContain(`<a href="https://github.com/guplem/drink">Drink &amp; Play on Github</a>`);
  });

  it("renders an unlinked heading when a work has no links", () => {
    const html = buildWorksHtml([{ title: "No Links", date: "2019", description: ["Text."], skills: ["Design"] }]);
    expect(html).toContain("<h3>No Links</h3>");
  });

  it("orders works newest first and sets no element ids", () => {
    const older = { ...work, title: "Older", date: "2010", links: [] };
    const html = buildWorksHtml([older, work]);
    expect(html.indexOf("Drink &amp; Play")).toBeLessThan(html.indexOf("Older"));
    expect(html).not.toContain(" id=");
  });
});

describe("buildWebProjectsIndexHtml", () => {
  it("renders only local web-projects, with paths relative to web-projects/", () => {
    const works = [
      { title: "Local", date: "2025", description: ["A **local** demo."], skills: ["JS/TS"], links: [{ url: "web-projects/local/" }] },
      { title: "External", date: "2024", description: ["Elsewhere."], skills: [], links: [{ url: "https://example.com/" }] },
    ];
    const html = buildWebProjectsIndexHtml(works);
    expect(html).toContain(`<h3><a href="local/">Local</a></h3>`);
    expect(html).toContain("<p>A local demo.</p>");
    expect(html).not.toContain("External");
  });
});

describe("static SEO blocks drift", () => {
  // Re-injecting freshly built blocks into the committed files must be a
  // no-op; any difference means data/ changed without regenerating.
  it("index.html blocks match the data (fix: bun scripts/generateSeoBlocks.js)", () => {
    const committed = readFileSync(join(repoRoot, "index.html"), "utf8");
    const info = loadInfo(repoRoot);
    const works = loadWorks(repoRoot);
    let regenerated = injectBlock(committed, "HERO", buildHeroHtml(info));
    regenerated = injectBlock(regenerated, "ABOUT", buildAboutHtml(info));
    regenerated = injectBlock(regenerated, "WORKS", buildWorksHtml(works));
    expect(regenerated).toBe(committed);
  });

  it("web-projects/index.html block matches the data (fix: bun scripts/generateSeoBlocks.js)", () => {
    const committed = readFileSync(join(repoRoot, "web-projects", "index.html"), "utf8");
    const regenerated = injectBlock(committed, "WEB-PROJECTS", buildWebProjectsIndexHtml(loadWorks(repoRoot)));
    expect(regenerated).toBe(committed);
  });
});
