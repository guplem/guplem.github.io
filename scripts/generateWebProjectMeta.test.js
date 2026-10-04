// Unit tests for the web-project head block (JSON-LD + Open Graph), plus the
// drift guard: CI fails when a project's data changes without regenerating
// the pages, or when a web-project page loses its marker pair
// (fix: bun scripts/generateWebProjectMeta.js).

import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildWebProjectMetaHtml, webProjectPages } from "./generateWebProjectMeta.js";
import { injectBlock } from "./generateSeoBlocks.js";
import { loadInfo, loadWorks } from "./portfolioData.js";

// Resolve relative to this test file, not the working directory.
const repoRoot = join(import.meta.dir, "..");

/**
 * Normalize Windows line endings so drift checks compare content, not EOL.
 * @param {string} text
 * @returns {string}
 */
function normalizeEol(text) {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Pull the JSON-LD object back out of a generated block.
 * @param {string} blockHtml
 * @returns {any}
 */
function parseJsonLd(blockHtml) {
  const match = blockHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return JSON.parse(match[1]);
}

const author = { name: "Guillem Poy" };

const toolProject = {
  types: ["Web"],
  title: "Unit Converter",
  description: ["*Unit Converter* turns **100 km** into every unit at once.", "Second paragraph."],
  image: "resources/images/projects/unitConverter.webp",
  imageAlt: "A box with 100 km typed in",
  links: [{ url: "web-projects/unit-converter/" }, { type: "github", url: "https://github.com/guplem/x/tree/main/web-projects/unit-converter" }],
};

const gameProject = {
  types: ["Web", "Videogame"],
  title: "Mancala",
  description: ["A board game."],
  links: [{ url: "https://triunitystudios.com/web-projects/mancala/" }],
};

describe("buildWebProjectMetaHtml", () => {
  it("describes a tool as a free WebApplication in the utilities category", () => {
    const jsonLd = parseJsonLd(buildWebProjectMetaHtml(toolProject, author));
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("WebApplication");
    expect(jsonLd.name).toBe("Unit Converter");
    expect(jsonLd.url).toBe("https://triunitystudios.com/web-projects/unit-converter/");
    expect(jsonLd.applicationCategory).toBe("UtilitiesApplication");
    expect(jsonLd.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "EUR" });
    expect(jsonLd.author).toEqual({ "@type": "Person", name: "Guillem Poy", url: "https://triunitystudios.com/" });
  });

  it("describes a project typed Videogame as a game", () => {
    expect(parseJsonLd(buildWebProjectMetaHtml(gameProject, author)).applicationCategory).toBe("GameApplication");
  });

  it("uses the first description paragraph as plain text, without markdown", () => {
    const html = buildWebProjectMetaHtml(toolProject, author);
    expect(parseJsonLd(html).description).toBe("Unit Converter turns 100 km into every unit at once.");
    expect(html).toContain('<meta property="og:description" content="Unit Converter turns 100 km into every unit at once." />');
  });

  it("writes the Open Graph tags with an absolute image URL", () => {
    const html = buildWebProjectMetaHtml(toolProject, author);
    expect(html).toContain('<meta property="og:type" content="website" />');
    expect(html).toContain('<meta property="og:title" content="Unit Converter" />');
    expect(html).toContain('<meta property="og:url" content="https://triunitystudios.com/web-projects/unit-converter/" />');
    expect(html).toContain('<meta property="og:image" content="https://triunitystudios.com/resources/images/projects/unitConverter.webp" />');
    expect(html).toContain('<meta property="og:image:alt" content="A box with 100 km typed in" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(parseJsonLd(html).image).toBe("https://triunitystudios.com/resources/images/projects/unitConverter.webp");
  });

  it("leaves out every image tag when the project has no image", () => {
    const html = buildWebProjectMetaHtml(gameProject, author);
    expect(html).not.toContain("og:image");
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
    expect(parseJsonLd(html).image).toBeUndefined();
  });

  it("escapes HTML in attributes and cannot close the script tag early", () => {
    const tricky = { ...gameProject, title: 'Say "hi" & </script>' };
    const html = buildWebProjectMetaHtml(tricky, author);
    expect(html).toContain('content="Say &quot;hi&quot; &amp; &lt;/script&gt;"');
    expect(html.match(/<\/script>/g).length).toBe(1);
    expect(parseJsonLd(html).name).toBe('Say "hi" & </script>');
  });
});

describe("webProjectPages", () => {
  it("maps each local web-project to its page file, and skips other projects", () => {
    const external = { title: "External", links: [{ url: "https://example.com/" }] };
    const pong = { title: "Pong", links: [{ url: "web-projects/ChatGPTPong/pong.html" }] };
    const pages = webProjectPages([toolProject, external, pong]);
    expect(pages.map((page) => page.file)).toEqual(["web-projects/unit-converter/index.html", "web-projects/ChatGPTPong/pong.html"]);
    expect(pages[0].work).toBe(toolProject);
  });
});

describe("web-project head block drift", () => {
  const info = loadInfo(repoRoot);
  for (const { file, work } of webProjectPages(loadWorks(repoRoot))) {
    it(`${file} carries the GENERATED:WEB-PROJECT-META block that matches the data (fix: bun scripts/generateWebProjectMeta.js)`, () => {
      const committed = normalizeEol(readFileSync(join(repoRoot, file), "utf8"));
      expect(injectBlock(committed, "WEB-PROJECT-META", buildWebProjectMetaHtml(work, info))).toBe(committed);
    });
  }
});
