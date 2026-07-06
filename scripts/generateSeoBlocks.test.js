// Unit tests for the static SEO block builders, plus the drift guards: CI
// fails when data/ changes without regenerating the committed HTML
// (fix: bun scripts/generateSeoBlocks.js).

import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  escapeHtml,
  markdownToInlineHtml,
  markdownToBlockHtml,
  injectBlock,
  buildHeroHtml,
  buildAboutHtml,
  buildWorksHtml,
  buildWebProjectsIndexHtml,
  buildAdditionalSectionsHtml,
} from "./generateSeoBlocks.js";
import { loadInfo, loadWorks } from "./portfolioData.js";

// Resolve relative to this test file, not the working directory, so the test
// passes no matter where `bun test` is invoked from.
const repoRoot = join(import.meta.dir, "..");

/**
 * Normalize Windows line endings so drift checks compare content, not EOL
 * (a checkout with core.autocrlf=true may smudge committed files to CRLF).
 * @param {string} text
 * @returns {string}
 */
function normalizeEol(text) {
  return text.replace(/\r\n/g, "\n");
}

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

describe("markdownToInlineHtml", () => {
  it("converts bold, italic, and newlines to their HTML equivalents", () => {
    expect(markdownToInlineHtml("a **bold** and *italic* word\nnext line")).toBe("a <strong>bold</strong> and <em>italic</em> word<br />next line");
  });

  it("converts links to real anchors", () => {
    expect(markdownToInlineHtml("see [my profile](https://example.com)")).toBe('see <a href="https://example.com">my profile</a>');
  });

  it("escapes HTML before converting", () => {
    expect(markdownToInlineHtml("**Drink & Play** <b>")).toBe("<strong>Drink &amp; Play</strong> &lt;b&gt;");
  });
});

describe("markdownToBlockHtml", () => {
  it("splits heading lines and paragraph lines into h-tags and p-tags", () => {
    expect(markdownToBlockHtml("####  Get to know me\nI enjoy learning.")).toBe("<h4>Get to know me</h4>\n<p>I enjoy learning.</p>");
  });

  it("separates paragraphs on blank lines and keeps single newlines as br", () => {
    expect(markdownToBlockHtml("first line\nsecond line\n\nnew paragraph")).toBe("<p>first line<br />second line</p>\n<p>new paragraph</p>");
  });

  it("maps the number of # to the heading level, clamped to 6", () => {
    expect(markdownToBlockHtml("## Two")).toBe("<h2>Two</h2>");
    expect(markdownToBlockHtml("####### Seven")).toBe("<h6>Seven</h6>");
  });

  it("converts inline markdown inside headings and paragraphs", () => {
    expect(markdownToBlockHtml("#### The **plan**\nsee [docs](https://example.com)")).toBe(
      '<h4>The <strong>plan</strong></h4>\n<p>see <a href="https://example.com">docs</a></p>'
    );
  });

  it("escapes HTML", () => {
    expect(markdownToBlockHtml("a <b> & c")).toBe("<p>a &lt;b&gt; &amp; c</p>");
  });
});

describe("buildHeroHtml", () => {
  it("renders a single h1 mirroring the dynamic markdown render", () => {
    const info = { introduction: "Hi! I'm **Guillem**\nI build *things*." };
    expect(buildHeroHtml(info)).toBe("<h1>Hi! I'm <strong>Guillem</strong><br />I build <em>things</em>.</h1>");
  });
});

describe("buildAboutHtml", () => {
  it("renders each entry as structured blocks: headings, paragraphs, links, bold", () => {
    const info = { aboutMe: ["#### Title\nFirst **bold** line", "See [my profile](https://example.com)"] };
    expect(buildAboutHtml(info)).toBe(
      '<h4>Title</h4>\n<p>First <strong>bold</strong> line</p>\n<p>See <a href="https://example.com">my profile</a></p>'
    );
  });
});

describe("buildAdditionalSectionsHtml", () => {
  const info = {
    additionalSections: [
      {
        title: "About Triunity & Co",
        image: "resources/images/miscellany/Triunity-Studios.webp",
        imageAlt: "Triunity Studios Logo",
        content: ["#### What is it?\nThe name I use to sign most of my **projects**."],
      },
    ],
  };

  it("renders a section with container, escaped h2 title, image, and structured content", () => {
    const html = buildAdditionalSectionsHtml(info);
    expect(html).toContain('<section class="section">');
    expect(html).toContain('<div class="container">');
    expect(html).toContain('<div class="section-label"><h2>About Triunity &amp; Co</h2></div>');
    expect(html).toContain('<img src="resources/images/miscellany/Triunity-Studios.webp" alt="Triunity Studios Logo" />');
    expect(html).toContain("<h4>What is it?</h4>");
    expect(html).toContain("<p>The name I use to sign most of my <strong>projects</strong>.</p>");
  });

  it("reuses the existing layout classes so the fallback is styled before JS runs", () => {
    const html = buildAdditionalSectionsHtml(info);
    expect(html).toContain('<div class="additional-grid">');
    expect(html).toContain('<div class="additional-text">');
  });

  it("falls back to a generated alt text and sets no element ids", () => {
    const noAlt = { additionalSections: [{ title: "Story", image: "img.webp", content: ["text"] }] };
    const html = buildAdditionalSectionsHtml(noAlt);
    expect(html).toContain('alt="Image of Story"');
    expect(html).not.toContain(" id=");
  });

  it("returns an empty string when there are no additional sections", () => {
    expect(buildAdditionalSectionsHtml({})).toBe("");
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
  const works = [
    {
      title: "Local",
      date: "2025",
      description: ["A **local** demo."],
      skills: ["JS/TS"],
      image: "resources/images/projects/local.webp",
      links: [{ url: "web-projects/local/" }],
    },
    { title: "External", date: "2024", description: ["Elsewhere."], skills: [], links: [{ url: "https://example.com/" }] },
  ];

  it("renders only local web-projects, mirroring the app.js card markup", () => {
    const html = buildWebProjectsIndexHtml(works);
    expect(html).toContain(`<article class="project-card" style="animation-delay: 0ms">`);
    expect(html).toContain(`<h3 class="project-title"><a class="project-title-link" href="local/">Local</a></h3>`);
    expect(html).toContain(`<div class="project-teaser"><p>A <strong>local</strong> demo.</p></div>`);
    expect(html).toContain(`<span class="project-skill">JS/TS</span>`);
    expect(html).not.toContain("External");
  });

  it("prefixes site-root image paths with ../ like app.js does", () => {
    expect(buildWebProjectsIndexHtml(works)).toContain(`<img class="project-image" src="../resources/images/projects/local.webp"`);
  });
});

describe("static SEO blocks drift", () => {
  // Re-injecting freshly built blocks into the committed files must be a
  // no-op; any difference means data/ changed without regenerating.
  it("index.html blocks match the data (fix: bun scripts/generateSeoBlocks.js)", () => {
    const committed = normalizeEol(readFileSync(join(repoRoot, "index.html"), "utf8"));
    const info = loadInfo(repoRoot);
    const works = loadWorks(repoRoot);
    let regenerated = injectBlock(committed, "HERO", buildHeroHtml(info));
    regenerated = injectBlock(regenerated, "ABOUT", buildAboutHtml(info));
    regenerated = injectBlock(regenerated, "WORKS", buildWorksHtml(works));
    regenerated = injectBlock(regenerated, "ADDITIONAL", buildAdditionalSectionsHtml(info));
    expect(regenerated).toBe(committed);
  });

  it("web-projects/index.html block matches the data (fix: bun scripts/generateSeoBlocks.js)", () => {
    const committed = normalizeEol(readFileSync(join(repoRoot, "web-projects", "index.html"), "utf8"));
    const regenerated = injectBlock(committed, "WEB-PROJECTS", buildWebProjectsIndexHtml(loadWorks(repoRoot)));
    expect(regenerated).toBe(committed);
  });
});

describe("static head metadata mirror", () => {
  // The static title/description in index.html must stay identical to
  // info.json's web-title/web-description: JS rewrites them from the JSON at
  // load time, and a mismatch would show crawlers different metadata than
  // users. Enforced here instead of by the generator (the head is hand-written).
  it("index.html title and meta description match info.json", () => {
    const committed = normalizeEol(readFileSync(join(repoRoot, "index.html"), "utf8"));
    const info = loadInfo(repoRoot);
    expect(committed).toContain(`<title id="page-title">${escapeHtml(info["web-title"])}</title>`);
    expect(committed).toContain(`<meta id="page-description" name="description" content="${escapeHtml(info["web-description"])}" />`);
  });
});
