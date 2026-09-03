// Laying out a caption: where each line goes, and where its background sits.
//
// The captions people add to stickers are the kind Instagram made familiar: a
// few words in a heavy face, sometimes on a coloured bar, sometimes outlined
// so they read against anything. That look is mostly a layout problem rather
// than a drawing one, and layout is arithmetic, so it lives here and is
// covered by tests. `app.js` only draws what this file works out.
//
// The one thing this file cannot do is measure text: how wide "hello" is
// depends on the font the device actually has. So the caller passes a
// `measure` function in, the canvas provides the real one, and the tests
// provide a simple one where every character is ten wide. That keeps the whole
// layout testable with no browser, and it is the same trick the sudoku project
// uses to keep its vision pipeline out of the DOM.
//
// Coordinates are relative to the caption's own block, with 0,0 at its top
// left corner. The editor then places that block on the sticker, so dragging a
// caption never re-runs the layout.

/** A line is this many times its font size tall, by default. */
const DEFAULT_LINE_HEIGHT = 1.25;

/**
 * The looks a caption can wear. `background` says how the boxes come out:
 *
 *   none    no background at all
 *   lines   one bar per line, each as wide as its own line
 *   block   one bar around the whole caption
 *
 * `labelKey` names a message in `i18n.js`, so the list reads in either
 * language. The colours are defaults the person can change.
 */
export const TEXT_STYLES = [
  {
    id: "plain",
    labelKey: "text.plain",
    background: "none",
    colour: "#ffffff",
    outline: 0,
  },
  {
    id: "outlined",
    labelKey: "text.outlined",
    background: "none",
    colour: "#ffffff",
    outlineColour: "#000000",
    // An outline is what lets white text read on a white background, which is
    // the case a sticker meets most often.
    outline: 0.09,
  },
  {
    id: "shadow",
    labelKey: "text.shadow",
    background: "none",
    colour: "#ffffff",
    shadow: 0.06,
    outline: 0,
  },
  {
    id: "highlight",
    labelKey: "text.highlight",
    background: "lines",
    colour: "#141422",
    backgroundColour: "#ffffff",
    radius: 0.16,
    outline: 0,
  },
  {
    id: "marker",
    labelKey: "text.marker",
    background: "lines",
    colour: "#ffffff",
    backgroundColour: "#dc5a00",
    radius: 0.16,
    outline: 0,
  },
  {
    id: "card",
    labelKey: "text.card",
    background: "block",
    colour: "#141422",
    backgroundColour: "#ffffff",
    radius: 0.2,
    outline: 0,
  },
  {
    id: "night",
    labelKey: "text.night",
    background: "block",
    colour: "#ffffff",
    backgroundColour: "#101017",
    radius: 0.2,
    outline: 0,
  },
];

/**
 * Find a style by id.
 *
 * @param {string} id
 * @returns {object} The plain style for a name this version does not know, so
 *   a sticker saved by an older version loses its look rather than failing to
 *   open.
 */
export function styleById(id) {
  return TEXT_STYLES.find((style) => style.id === id) ?? TEXT_STYLES[0];
}

/**
 * Break text into lines that fit a width.
 *
 * @param {string} text What the person typed. A line break they typed is kept.
 * @param {number} maxWidth The widest a line may be.
 * @param {(text: string) => number} measure How wide a piece of text is.
 * @returns {string[]} At least one line, possibly empty.
 */
export function wrapText(text, maxWidth, measure) {
  const paragraphs = String(text ?? "").split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    // A run of spaces between words carries no meaning once the text wraps.
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      // An empty typed line is a gap the person asked for, so keep it.
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      lines.push(line);
      line = word;
    }

    // A word with no spaces cannot be wrapped between words. Letting it run
    // off the sticker is worse than breaking it, so break it by character.
    for (const piece of lines.splice(0).concat(line)) {
      if (measure(piece) <= maxWidth || piece.length <= 1) {
        lines.push(piece);
        continue;
      }
      lines.push(...breakWord(piece, maxWidth, measure));
    }
    // `splice` above emptied the list, so put the finished lines back in one
    // place rather than tracking two lists.
  }
  return lines.length > 0 ? lines : [""];
}

/**
 * Work out where every line and every background box goes.
 *
 * @param {object} options
 * @param {string} options.text
 * @param {number} options.fontSize In pixels.
 * @param {number} options.maxWidth The widest the caption may be.
 * @param {(text: string) => number} options.measure
 * @param {string} [options.style] A style id.
 * @param {"left"|"centre"|"right"} [options.align] Centred by default, which
 *   is what a caption on a sticker almost always wants.
 * @param {number} [options.padding] Space between the letters and their box.
 * @param {number} [options.lineHeight] A multiple of the font size.
 * @returns {{
 *   width: number,
 *   height: number,
 *   lines: { text: string, x: number, y: number, width: number, baseline: number }[],
 *   boxes: { x: number, y: number, width: number, height: number, radius: number }[],
 * }} Sizes and positions inside the caption's own block.
 */
export function layoutText({
  text,
  fontSize,
  maxWidth,
  measure,
  style = "plain",
  align = "centre",
  padding = 0,
  lineHeight = DEFAULT_LINE_HEIGHT,
}) {
  const chosen = styleById(style);
  const boxed = chosen.background !== "none";
  // A box needs its padding inside the block, so the text has that much less
  // room to wrap into.
  const inset = boxed ? padding : 0;
  const textWidth = Math.max(1, maxWidth - inset * 2);

  const rows = wrapText(text, textWidth, measure);
  const stepHeight = fontSize * lineHeight;
  const widths = rows.map((row) => measure(row));
  const widest = Math.max(...widths, 0);

  const blockWidth = widest + inset * 2;
  const blockHeight = stepHeight * rows.length + inset * 2;

  const lines = rows.map((row, index) => {
    const width = widths[index];
    const y = inset + stepHeight * index;
    return {
      text: row,
      x: inset + offsetFor(align, widest, width),
      y,
      width,
      // Canvas draws from the baseline, not the top of the line. Sitting the
      // baseline a little above the bottom of the line box leaves room for
      // the parts of letters that hang below, like a "g".
      baseline: y + fontSize,
    };
  });

  return {
    width: blockWidth,
    height: blockHeight,
    lines,
    boxes: buildBoxes(chosen, lines, {
      blockWidth,
      blockHeight,
      padding,
      stepHeight,
      fontSize,
      inset,
    }),
  };
}

/** Where a line of a given width starts, inside a block of the full width. */
function offsetFor(align, widest, width) {
  if (align === "left") return 0;
  if (align === "right") return widest - width;
  return (widest - width) / 2;
}

/** The background boxes a style asks for. */
function buildBoxes(style, lines, { blockWidth, blockHeight, padding, stepHeight, fontSize, inset }) {
  const radius = (style.radius ?? 0) * fontSize;

  if (style.background === "block") {
    return [{ x: 0, y: 0, width: blockWidth, height: blockHeight, radius }];
  }
  if (style.background === "lines") {
    return (
      lines
        // A bar behind an empty line is a floating rectangle, so skip it.
        .filter((line) => line.text !== "")
        .map((line) => ({
          x: Math.max(0, line.x - padding),
          y: Math.max(0, line.y - padding / 2),
          // Clamp to the block: a bar wider than the block the editor placed
          // would be clipped on one side.
          width: Math.min(blockWidth, line.width + padding * 2),
          height: Math.min(blockHeight, stepHeight + padding),
          radius,
        }))
        .map((box) => ({
          ...box,
          // Keep the bottom bar inside the block too, for the same reason.
          height: Math.min(box.height, blockHeight - box.y),
        }))
    );
  }
  return [];
}

/** Split one long word into pieces that each fit the width. */
function breakWord(word, maxWidth, measure) {
  const pieces = [];
  let piece = "";
  for (const character of word) {
    const candidate = piece + character;
    // Keep at least one character per piece, or a width narrower than a
    // single character would loop for ever.
    if (piece && measure(candidate) > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}
