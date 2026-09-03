// Colour, measured the way a person sees it.
//
// Background removal has to answer one question over and over: are these two
// pixels the same colour? Plain RGB answers it badly. The distance from
// rgb(10,10,40) to rgb(10,10,70) is the same number as the distance from black
// to a mid grey, but a person sees the first pair as one dark blue and the
// second pair as two clearly different tones. A tolerance slider built on RGB
// therefore feels broken: it leaks into the subject in dark areas and refuses
// to spread in bright ones.
//
// CIELAB fixes that. It is a colour space built so that equal steps look like
// equal steps, which is exactly what a tolerance needs to mean. The conversion
// runs sRGB -> linear light -> CIEXYZ -> CIELAB, under the D65 white point that
// sRGB itself is defined against.
//
// Distance here is plain straight-line distance in CIELAB, which is the CIE76
// deltaE. Later formulas (CIE94, CIEDE2000) are more accurate near the edges
// of the space, and much slower. This code runs over every pixel of a 512 by
// 512 image on every drag of a slider, and CIE76 is close enough to guide a
// flood fill, so the simple formula is the right trade here.

/** The D65 white point, the reference sRGB is defined against. */
const WHITE_X = 0.95047;
const WHITE_Y = 1.0;
const WHITE_Z = 1.08883;

/** The cut-off and slope of the CIELAB cube root, kept as exact fractions. */
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 841 / 108;
const LAB_OFFSET = 4 / 29;

/** Undo the sRGB gamma curve, so light adds up the way physics says it does. */
const GAMMA_CUTOFF = 0.04045;

/** A lookup table for the gamma curve: 256 inputs, so it is worth caching. */
const LINEAR = new Float32Array(256);
for (let value = 0; value < 256; value += 1) {
  const channel = value / 255;
  LINEAR[value] =
    channel <= GAMMA_CUTOFF ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * Convert one sRGB colour to CIELAB.
 *
 * @param {number} r 0 to 255.
 * @param {number} g 0 to 255.
 * @param {number} b 0 to 255.
 * @returns {{ L: number, a: number, b: number }} Lightness 0 to 100, then the
 *   two colour axes, which run either side of zero.
 */
export function rgbToLab(r, g, b) {
  const red = LINEAR[r & 0xff];
  const green = LINEAR[g & 0xff];
  const blue = LINEAR[b & 0xff];

  // The sRGB to CIEXYZ matrix, for a D65 white point.
  const x = red * 0.4124564 + green * 0.3575761 + blue * 0.1804375;
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z = red * 0.0193339 + green * 0.119192 + blue * 0.9503041;

  const fx = pivot(x / WHITE_X);
  const fy = pivot(y / WHITE_Y);
  const fz = pivot(z / WHITE_Z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Convert a whole RGBA image to CIELAB.
 *
 * The result is one flat array with three numbers per pixel, rather than an
 * array of objects. A 512 by 512 image is 262144 pixels, and 262144 small
 * objects would cost far more memory and time than the conversion itself.
 * Alpha is ignored: what matters here is what colour a pixel is.
 *
 * @param {Uint8ClampedArray} rgba Four bytes per pixel.
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array} Three numbers per pixel: L, a, b.
 */
export function toLab(rgba, width, height) {
  const count = width * height;
  const lab = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const { L, a, b } = rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    lab[i * 3] = L;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }
  return lab;
}

/**
 * How far apart two pixels of a CIELAB image look.
 *
 * @param {Float32Array} lab From `toLab`.
 * @param {number} indexA Pixel index, not byte offset.
 * @param {number} indexB
 * @returns {number} Roughly: 1 is invisible, 2 to 3 is just noticeable, over
 *   100 is as far apart as black and white.
 */
export function labDelta(lab, indexA, indexB) {
  const a = indexA * 3;
  const b = indexB * 3;
  const dL = lab[a] - lab[b];
  const da = lab[a + 1] - lab[b + 1];
  const db = lab[a + 2] - lab[b + 2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * How far one pixel is from a colour held outside the image, such as an
 * averaged background sample.
 *
 * @param {Float32Array} lab From `toLab`.
 * @param {number} index Pixel index.
 * @param {number} L
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function labDeltaToColour(lab, index, L, a, b) {
  const at = index * 3;
  const dL = lab[at] - L;
  const da = lab[at + 1] - a;
  const db = lab[at + 2] - b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** The CIELAB cube root, with a straight line near zero to keep it smooth. */
function pivot(ratio) {
  return ratio > LAB_EPSILON ? Math.cbrt(ratio) : LAB_KAPPA * ratio + LAB_OFFSET;
}
