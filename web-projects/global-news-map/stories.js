// The day's stories, read out of the Wikipedia Current Events portal.
//
// The portal gives one page per day. Its shape is a bold category line, then a
// nested list: an outer item names a running topic, and the item that holds no
// list of its own is a single story. So the leaves of the list are the stories,
// and the items above a leaf are its topic trail.
//
//   <p><b>Armed conflicts and attacks</b></p>
//   <ul><li><a href="/wiki/2026_Iran_war">2026 Iran war</a>
//     <ul><li>A spokesperson for <a href="/wiki/...">CENTCOM</a> reports ...
//            <a class="external text" href="https://...">(<i>Axios</i>)</a></li></ul>
//   </li></ul>
//
// The parser is a small tag scanner rather than a DOM call, for one reason: it
// has to be pure so `bun test` can run it against a real saved page with no
// browser. `portalFixture.js` holds that page and is the spec.
//
// The links inside a sentence matter as much as the words. Wikipedia geotags a
// place article and does not geotag an idea, so the links are the candidate
// locations for the story, and `places.js` picks between them. Nothing here
// tries to understand the sentence.

/** Named entities the portal actually produces. Numeric ones are handled too. */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ntilde: "ñ",
  iacute: "í",
  oacute: "ó",
  aacute: "á",
  uacute: "ú",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

/**
 * Turn HTML entities into the characters they stand for.
 * An entity this does not know is left exactly as it was, because dropping it
 * would quietly damage a name.
 */
export function decodeEntities(text) {
  return String(text ?? "").replace(/&(#\d+|#[xX][0-9a-fA-F]+|\w+);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** Drop every tag, keep every word. */
export function stripTags(html) {
  return String(html ?? "").replace(/<[^>]*>/g, "");
}

/** One run of whitespace becomes one plain space. Non-breaking spaces included. */
function tidy(text) {
  return text.replace(/[\s ]+/g, " ").trim();
}

/**
 * The article title behind a `/wiki/...` link, in readable form.
 * @returns {string|null} null for anything that is not a plain article: a
 *   namespace page (`File:`, `Portal:`), an anchor, or an outside address
 */
function articleTitle(href) {
  if (!href || !href.startsWith("/wiki/")) return null;
  let title = href.slice("/wiki/".length).split("#")[0];
  if (!title) return null;
  try {
    title = decodeURIComponent(title);
  } catch {
    // A malformed escape is not worth losing the link over.
  }
  title = decodeEntities(title).replace(/_/g, " ").trim();
  // A colon means a namespace page, which is never a place.
  return title && !title.includes(":") ? title : null;
}

/** A source marker reads `(<i>Axios</i>)`. The name is what is inside. */
function sourceLabel(raw) {
  return tidy(decodeEntities(stripTags(raw))).replace(/^\(+/, "").replace(/\)+$/, "").trim();
}

const ATTRIBUTE = (attributes, name) =>
  attributes.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ??
  attributes.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"))?.[1] ??
  "";

/** A short, stable, readable handle for a story, used in the address bar. */
function slugify(text) {
  return tidy(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
}

/**
 * Cut the page down to the part that holds the news.
 *
 * The portal's heading carries an "edit / history / watch" list whose items look
 * exactly like story items, so parsing the whole page invents stories called
 * "edit". Removing that list and starting at the content block is what keeps
 * them out.
 */
function contentOnly(html) {
  const withoutNoise = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<ul[^>]*class="[^"]*current-events-navbar[^"]*"[\s\S]*?<\/ul>/gi, "");
  const start = withoutNoise.search(/<div[^>]*class="[^"]*current-events-content/i);
  return start === -1 ? "" : withoutNoise.slice(start);
}

/**
 * Every story on one day's portal page.
 * @param {string} html the `action=parse` HTML for a portal day
 * @returns {Array<{id: string, category: string, topics: string[], text: string,
 *   sources: Array<{label: string, url: string}>, links: string[], topicLinks: string[]}>}
 */
export function parseCurrentEvents(html) {
  const content = contentOnly(String(html ?? ""));
  if (!content) return [];

  const stories = [];
  /** @type {Array<{label: string, links: string[], text: string, sources: any[], storyLinks: string[], closed: boolean}>} */
  const stack = [];
  let category = "";
  let inBold = false;
  let boldText = "";
  /** Set while inside a source link, so its words go to the label and not the story. */
  let source = null;

  const top = () => stack[stack.length - 1];

  const addText = (raw) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    if (source) {
      source.raw += raw;
      return;
    }
    if (inBold) {
      boldText += text;
      return;
    }
    const frame = top();
    if (frame) frame.text += text;
  };

  const tagPattern = /<(\/?)([a-zA-Z0-9]+)([^>]*?)\/?>/g;
  let cursor = 0;
  let match;
  while ((match = tagPattern.exec(content)) !== null) {
    addText(content.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const attributes = match[3] ?? "";

    if (tag === "b" || tag === "strong") {
      if (closing) {
        // A bold line directly in the content block is a category heading.
        if (!stack.length && tidy(boldText)) category = tidy(boldText);
        inBold = false;
      } else {
        inBold = true;
        boldText = "";
      }
      continue;
    }

    if (tag === "li") {
      if (closing) {
        const frame = stack.pop();
        if (!frame) continue;
        // A leaf item, meaning one with no list inside it, is a story.
        if (!frame.closed) {
          const text = tidy(frame.text);
          if (text) {
            stories.push({
              category,
              topics: stack.map((parent) => tidy(parent.label)).filter(Boolean),
              text,
              sources: frame.sources,
              links: frame.storyLinks,
              topicLinks: stack.flatMap((parent) => parent.links),
            });
          }
        }
      } else {
        stack.push({ label: "", links: [], text: "", sources: [], storyLinks: [], closed: false });
      }
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      const frame = top();
      // The item owning this list is a topic, and its label is the text it had
      // before the list opened.
      if (!closing && frame) {
        frame.closed = true;
        frame.label = tidy(frame.text);
        frame.links = [...frame.storyLinks];
      }
      continue;
    }

    if (tag === "a") {
      if (closing) {
        if (source) {
          const label = sourceLabel(source.raw);
          if (label && source.url) source.frame?.sources.push({ label, url: source.url });
          source = null;
        }
        continue;
      }
      const href = decodeEntities(ATTRIBUTE(attributes, "href"));
      const classes = ATTRIBUTE(attributes, "class");
      const frame = top();
      if (/\bexternal\b/.test(classes) || /^https?:/i.test(href)) {
        // A source marker. Its words belong to the source, not to the sentence.
        if (frame) source = { raw: "", url: href, frame };
        continue;
      }
      const title = articleTitle(href);
      if (title && frame && !frame.storyLinks.includes(title)) frame.storyLinks.push(title);
      continue;
    }
  }
  addText(content.slice(cursor));

  // Ids have to be unique: the address bar points at one story by id.
  const used = new Map();
  for (const story of stories) {
    const base = slugify(story.text) || "story";
    const seen = (used.get(base) ?? 0) + 1;
    used.set(base, seen);
    story.id = seen === 1 ? base : `${base}-${seen}`;
  }
  return stories;
}
