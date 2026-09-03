import { describe, expect, test } from "bun:test";
import { DROP, KEEP } from "./mask.js";
import {
  addOutline,
  alphaBounds,
  applyMask,
  defringe,
  hasTransparency,
  readAlphaMask,
} from "./compose.js";

/** An RGBA image built from a paint function. */
function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = paint(x, y);
      const at = (y * width + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = a;
    }
  }
  return data;
}

const pixelAt = (rgba, width, x, y) => {
  const at = (y * width + x) * 4;
  return [rgba[at], rgba[at + 1], rgba[at + 2], rgba[at + 3]];
};

describe("applyMask", () => {
  test("copies the mask into the alpha channel", () => {
    const rgba = image(2, 1, () => [10, 20, 30]);
    const mask = new Uint8Array([KEEP, DROP]);
    const out = applyMask(rgba, mask);
    expect(pixelAt(out, 2, 0, 0)).toEqual([10, 20, 30, 255]);
    expect(out[7]).toBe(0);
  });

  test("keeps a part-way mask value as part-way alpha", () => {
    // A feathered edge only survives if the value is carried over as it is.
    const rgba = image(1, 1, () => [10, 20, 30]);
    expect(applyMask(rgba, new Uint8Array([137]))[3]).toBe(137);
  });

  test("leaves the colours alone", () => {
    const rgba = image(1, 1, () => [200, 30, 40]);
    expect([...applyMask(rgba, new Uint8Array([64])).subarray(0, 3)]).toEqual([200, 30, 40]);
  });

  test("takes the lower of the mask and the alpha already there", () => {
    // A picture that arrived with holes must keep them. Writing the mask
    // straight in would fill a transparent pixel back up.
    const rgba = image(1, 1, () => [10, 20, 30, 40]);
    expect(applyMask(rgba, new Uint8Array([KEEP]))[3]).toBe(40);
  });

  test("does not write over the picture it was given", () => {
    const rgba = image(1, 1, () => [10, 20, 30]);
    applyMask(rgba, new Uint8Array([DROP]));
    expect(rgba[3]).toBe(255);
  });
});

describe("readAlphaMask", () => {
  test("reads transparency out of a picture as a mask", () => {
    const rgba = image(2, 1, (x) => [0, 0, 0, x === 0 ? 255 : 0]);
    expect([...readAlphaMask(rgba, 2, 1)]).toEqual([255, 0]);
  });

  test("round-trips through applyMask", () => {
    const rgba = image(3, 1, (x) => [1, 2, 3, x * 100]);
    const mask = readAlphaMask(rgba, 3, 1);
    const out = applyMask(image(3, 1, () => [1, 2, 3]), mask);
    expect([out[3], out[7], out[11]]).toEqual([0, 100, 200]);
  });
});

describe("hasTransparency", () => {
  test("is false for a fully opaque picture", () => {
    expect(hasTransparency(image(4, 4, () => [1, 2, 3, 255]))).toBe(false);
  });

  test("is true when one pixel is see-through", () => {
    expect(hasTransparency(image(4, 4, (x, y) => [1, 2, 3, x === 2 && y === 2 ? 200 : 255]))).toBe(
      true,
    );
  });

  test("ignores a difference no eye could see", () => {
    // A lossy encoder can leave alpha at 254 across a solid picture. Calling
    // that a cut-out would silence the "this has no transparency" warning
    // exactly when it is needed.
    expect(hasTransparency(image(4, 4, () => [1, 2, 3, 254]))).toBe(false);
  });
});

describe("alphaBounds", () => {
  test("finds the box around what is visible", () => {
    const rgba = image(6, 6, (x, y) => [0, 0, 0, x >= 2 && x <= 3 && y >= 1 && y <= 4 ? 255 : 0]);
    expect(alphaBounds(rgba, 6, 6)).toEqual({ x: 2, y: 1, width: 2, height: 4 });
  });

  test("returns nothing for a fully transparent picture", () => {
    expect(alphaBounds(image(4, 4, () => [0, 0, 0, 0]), 4, 4)).toBeNull();
  });
});

describe("addOutline", () => {
  /** A small opaque square in the middle of a transparent picture. */
  const square = () =>
    image(11, 11, (x, y) =>
      x >= 4 && x <= 6 && y >= 4 && y <= 6 ? [200, 30, 40, 255] : [0, 0, 0, 0],
    );

  test("puts a ring of the chosen colour around the drawing", () => {
    // WhatsApp: "we recommend you add a 8px #FFFFFF stroke to the outside of
    // each sticker", because a sticker lands on light and dark chats alike.
    const out = addOutline(square(), 11, 11, { radius: 2, colour: [255, 255, 255] });
    // Two pixels out from the square's edge is now white and opaque.
    expect(pixelAt(out, 11, 2, 5)).toEqual([255, 255, 255, 255]);
  });

  test("leaves the drawing itself untouched", () => {
    const out = addOutline(square(), 11, 11, { radius: 2, colour: [255, 255, 255] });
    expect(pixelAt(out, 11, 5, 5)).toEqual([200, 30, 40, 255]);
  });

  test("leaves the far background transparent", () => {
    const out = addOutline(square(), 11, 11, { radius: 2, colour: [255, 255, 255] });
    expect(pixelAt(out, 11, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  test("grows the visible area by the radius", () => {
    const out = addOutline(square(), 11, 11, { radius: 2, colour: [255, 255, 255] });
    expect(alphaBounds(out, 11, 11)).toEqual({ x: 2, y: 2, width: 7, height: 7 });
  });

  test("changes nothing at radius zero", () => {
    const before = square();
    expect([...addOutline(before, 11, 11, { radius: 0, colour: [255, 255, 255] })]).toEqual([
      ...before,
    ]);
  });

  test("takes any colour, not only white", () => {
    const out = addOutline(square(), 11, 11, { radius: 1, colour: [0, 0, 0] });
    expect(pixelAt(out, 11, 3, 5)).toEqual([0, 0, 0, 255]);
  });

  test("shows through the soft rim a real cut-out has", () => {
    // The shape that actually comes out of the background remover: a solid
    // middle with a feathered rim one pixel wide. Behind that rim the stroke
    // is solid, because it grew from the solid middle, so the rim ends up
    // fully opaque and tinted towards the stroke colour. That is what closes
    // the faint gap a hard stroke leaves around a feathered edge.
    const soft = image(11, 11, (x, y) => {
      const ring = Math.max(Math.abs(x - 5), Math.abs(y - 5));
      if (ring <= 1) return [0, 0, 0, 255];
      if (ring === 2) return [0, 0, 0, 128];
      return [0, 0, 0, 0];
    });
    const out = addOutline(soft, 11, 11, { radius: 2, colour: [255, 255, 255] });
    const [r, , , a] = pixelAt(out, 11, 3, 5);
    expect(a).toBe(255);
    // Black at half alpha over solid white lands in the middle.
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
  });

  test("gives a see-through drawing a see-through stroke", () => {
    // The stroke grows from the drawing's own shape, so it inherits its
    // alpha. A ghostly subject gets a ghostly outline rather than a solid
    // ring that looks painted on behind it.
    const ghost = image(11, 11, (x, y) =>
      x >= 4 && x <= 6 && y >= 4 && y <= 6 ? [0, 0, 0, 128] : [0, 0, 0, 0],
    );
    const out = addOutline(ghost, 11, 11, { radius: 2, colour: [255, 255, 255] });
    // Half over half: 0.5 + 0.5 * 0.5 = 0.75 of the way to solid.
    expect(pixelAt(out, 11, 2, 5)[3]).toBe(128);
    expect(pixelAt(out, 11, 5, 5)[3]).toBe(192);
  });
});

describe("defringe", () => {
  test("replaces the colour of a half-transparent pixel with its neighbour's", () => {
    // After a cut, the pixels along the edge still hold a mix of the subject
    // and the wall behind it. Left alone they draw a pale ring round the
    // sticker. Taking the colour from the confident interior removes it,
    // while the alpha, which is what makes the edge soft, is kept.
    const rgba = image(5, 1, (x) => {
      if (x <= 1) return [200, 30, 40, 255];
      if (x === 2) return [230, 140, 150, 128];
      return [0, 0, 0, 0];
    });
    const out = defringe(rgba, 5, 1, { radius: 2 });
    expect(pixelAt(out, 5, 2, 0)).toEqual([200, 30, 40, 128]);
  });

  test("keeps the alpha exactly as it was", () => {
    const rgba = image(5, 1, (x) => {
      if (x <= 1) return [200, 30, 40, 255];
      if (x === 2) return [230, 140, 150, 77];
      return [0, 0, 0, 0];
    });
    expect(defringe(rgba, 5, 1, { radius: 2 })[2 * 4 + 3]).toBe(77);
  });

  test("leaves a fully opaque pixel alone", () => {
    const rgba = image(3, 1, () => [200, 30, 40, 255]);
    expect([...defringe(rgba, 3, 1, { radius: 1 })]).toEqual([...rgba]);
  });

  test("leaves a fully transparent pixel alone", () => {
    const rgba = image(3, 1, () => [90, 90, 90, 0]);
    expect([...defringe(rgba, 3, 1, { radius: 1 })]).toEqual([...rgba]);
  });

  test("leaves a soft pixel alone when no confident neighbour is near", () => {
    // Nothing to copy from, so guessing would be worse than doing nothing.
    const rgba = image(3, 1, () => [90, 90, 90, 100]);
    expect([...defringe(rgba, 3, 1, { radius: 1 })]).toEqual([...rgba]);
  });

  test("changes nothing at radius zero", () => {
    const rgba = image(5, 1, (x) => (x === 2 ? [1, 2, 3, 128] : [200, 30, 40, 255]));
    expect([...defringe(rgba, 5, 1, { radius: 0 })]).toEqual([...rgba]);
  });
});
