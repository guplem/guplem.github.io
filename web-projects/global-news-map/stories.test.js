import { describe, expect, test } from "bun:test";
import { PORTAL_HTML_2026_08_30 } from "./portalFixture.js";
import { decodeEntities, parseCurrentEvents, stripTags } from "./stories.js";

const stories = parseCurrentEvents(PORTAL_HTML_2026_08_30);
const find = (fragment) => stories.find((story) => story.text.includes(fragment));

describe("parseCurrentEvents against a real portal page", () => {
  test("finds the day's stories", () => {
    expect(stories.length).toBeGreaterThan(3);
  });

  test("gives every story text, a category and an id", () => {
    for (const story of stories) {
      expect(story.text.length).toBeGreaterThan(20);
      expect(story.category.length).toBeGreaterThan(0);
      expect(story.id.length).toBeGreaterThan(0);
    }
  });

  test("ids are unique, so a story can be addressed in the URL", () => {
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
  });

  test("reads the category from the bold line above the list", () => {
    expect(stories[0].category).toBe("Armed conflicts and attacks");
  });

  test("keeps only leaf items, never a topic heading, as a story", () => {
    // "2026 Iran war" is a topic that holds stories. It is not a story itself.
    expect(stories.map((s) => s.text)).not.toContain("2026 Iran war");
  });
});

describe("a story's own words", () => {
  const story = find("Larak Island");

  test("carries the sentence", () => {
    expect(story.text).toContain("has launched strikes on two");
    expect(story.text).toContain("Larak Island");
  });

  // The source markers are shown as their own links, so leaving "(Axios)" in the
  // sentence would print every source twice.
  test("leaves the source markers out of the sentence", () => {
    expect(story.text).not.toContain("(Axios)");
    expect(story.text).not.toContain("Axios");
  });

  test("holds no markup", () => {
    expect(story.text).not.toContain("<");
    expect(story.text).not.toContain("&lt;");
  });

  test("records the nesting above it as the topic trail", () => {
    expect(story.topics).toEqual(["2026 Iran war", "2026 Strait of Hormuz crisis"]);
  });
});

describe("sources", () => {
  const story = find("Larak Island");

  test("keeps each source with its link", () => {
    expect(story.sources.length).toBeGreaterThanOrEqual(2);
    expect(story.sources[0].url).toStartWith("https://");
    expect(story.sources[0].label).toBe("Axios");
  });

  test("takes the publication name out of the marker's brackets and italics", () => {
    for (const source of stories.flatMap((s) => s.sources)) {
      expect(source.label).not.toContain("(");
      expect(source.label).not.toContain("<");
      expect(source.label.length).toBeGreaterThan(0);
    }
  });
});

describe("the linked articles, which become the candidate places", () => {
  const story = find("Larak Island");

  test("lists the sentence's wiki links as titles, in reading order", () => {
    expect(story.links).toContain("Larak Island");
    expect(story.links).toContain("Strait of Hormuz");
    expect(story.links.indexOf("Larak Island")).toBeLessThan(story.links.indexOf("Strait of Hormuz"));
  });

  test("keeps the topic trail's links apart from the sentence's own", () => {
    expect(story.topicLinks).toContain("2026 Iran war");
    expect(story.links).not.toContain("2026 Iran war");
  });

  test("turns an underscore title back into its readable form", () => {
    expect(story.links).toContain("United States Central Command");
    expect(story.links.join(" ")).not.toContain("_");
  });

  test("never lists a namespace page such as File: or Category:", () => {
    for (const title of stories.flatMap((s) => [...s.links, ...s.topicLinks])) {
      expect(title).not.toContain(":");
    }
  });

  test("lists a title only once per story", () => {
    for (const story of stories) {
      expect(new Set(story.links).size).toBe(story.links.length);
    }
  });

  test("skips the portal's own edit and history links", () => {
    const all = stories.flatMap((s) => [...s.links, ...s.topicLinks]).join(" ");
    expect(all).not.toContain("action=edit");
    expect(all).not.toContain("Portal");
  });
});

describe("entities and stray markup", () => {
  test("decodes the entities the portal really uses", () => {
    // A non-breaking space decodes to a real U+00A0, faithfully.
    expect(decodeEntities("August&#160;30")).toBe("August\u00a030");
    expect(decodeEntities("Bar&amp;Grill")).toBe("Bar&Grill");
    expect(decodeEntities("&lt;b&gt;")).toBe("<b>");
    expect(decodeEntities("caf&eacute;")).toBe("café");
    expect(decodeEntities("&quot;quoted&quot;")).toBe('"quoted"');
  });

  test("leaves an unknown entity alone rather than dropping it", () => {
    expect(decodeEntities("&notarealentity;")).toBe("&notarealentity;");
  });

  // The portal is full of non-breaking spaces. They must not reach a title we
  // later match against the API, so the story text normalises them to spaces.
  test("story text turns a non-breaking space into a normal one", () => {
    const html = `<div class="current-events-content description"><p><b>Business</b></p>
      <ul><li>A price rose by 5&#160;per cent across the whole of the region today.</li></ul></div>`;
    const [story] = parseCurrentEvents(html);
    expect(story.text).toBe("A price rose by 5 per cent across the whole of the region today.");
    expect(story.text).not.toContain("\u00a0");
  });

  test("stripTags removes a tag but keeps the words around it", () => {
    expect(stripTags("a <i>b</i> c")).toBe("a b c");
  });
});

describe("markup the parser must survive", () => {
  test("returns nothing for an empty or contentless page, rather than throwing", () => {
    expect(parseCurrentEvents("")).toEqual([]);
    expect(parseCurrentEvents("<p>nothing here</p>")).toEqual([]);
    expect(parseCurrentEvents(null)).toEqual([]);
  });

  test("reads a story that has no links at all", () => {
    const html = `<div class="current-events-content description"><p><b>Business</b></p>
      <ul><li>A plain sentence with no links whatsoever in it.</li></ul></div>`;
    const [story] = parseCurrentEvents(html);
    expect(story.text).toBe("A plain sentence with no links whatsoever in it.");
    expect(story.links).toEqual([]);
    expect(story.category).toBe("Business");
  });

  // A day before about 2019 writes its category as `;Armed conflicts and attacks`
  // in the portal's source, which the wiki renders as a div and not as bold. Read
  // only the bold form and every story on those days loses its category.
  test("reads the category from the older heading div as well as from bold", () => {
    const html = `<div class="current-events-content description">
      <div class="current-events-content-heading" role="heading">Armed conflicts and attacks</div>
      <ul><li>Forces launch an offensive in the north of the country overnight.</li></ul>
      <div class="current-events-content-heading" role="heading">Law and crime</div>
      <ul><li>A court sentences three people over a robbery committed last year.</li></ul></div>`;
    const parsed = parseCurrentEvents(html);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].category).toBe("Armed conflicts and attacks");
    expect(parsed[1].category).toBe("Law and crime");
  });

  // The same div class also names the day itself, above the news. Reading that
  // one would file the day's first stories under "8 March 2015".
  test("ignores a heading div that stands inside a story", () => {
    const html = `<div class="current-events-content description"><p><b>Sports</b></p>
      <ul><li>A team wins the final after a <div class="current-events-content-heading">late</div> goal.</li></ul></div>`;
    const [story] = parseCurrentEvents(html);
    expect(story.category).toBe("Sports");
  });

  test("treats a topic with one story as a topic, not two stories", () => {
    const html = `<div class="current-events-content description"><p><b>Disasters</b></p>
      <ul><li><a href="/wiki/Flood">Flood</a>
      <ul><li>Water rose in the valley overnight and people left their homes.</li></ul>
      </li></ul></div>`;
    const parsed = parseCurrentEvents(html);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].topics).toEqual(["Flood"]);
    expect(parsed[0].text).toStartWith("Water rose");
  });
});
