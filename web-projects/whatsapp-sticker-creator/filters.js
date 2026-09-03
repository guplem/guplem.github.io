// Colour adjustments and the named looks built from them.
//
// Every adjustment here is a 4 by 5 matrix. Each output channel is a mix of
// the four input channels plus a constant:
//
//   out.r = m[0]*r  + m[1]*g  + m[2]*b  + m[3]*a  + m[4]
//   out.g = m[5]*r  + m[6]*g  + m[7]*b  + m[8]*a  + m[9]
//   out.b = m[10]*r + m[11]*g + m[12]*b + m[13]*a + m[14]
//   out.a = m[15]*r + m[16]*g + m[17]*b + m[18]*a + m[19]
//
// One shape covers brightness, contrast, saturation and warmth, and any stack
// of them multiplies into a single matrix. That matters: a sticker is 262144
// pixels, the sliders move continuously, and one pass over the pixels per drag
// is the difference between a preview that follows the finger and one that
// lags behind it.
//
// **The alpha row is never touched.** A sticker is a cut-out, so a filter that
// wrote to alpha would fill the transparent background back in and turn the
// sticker into a square. Every matrix below leaves the last row as the
// identity, and `applyMatrix` copies alpha across rather than computing it, so
// the rule holds even if a future matrix gets it wrong.
//
// The alternative was the browser's own `ctx.filter`, which is a string like
// "brightness(1.2) saturate(0.5)". It is shorter to write and cannot be tested
// without a browser, so the arithmetic lives here instead and is covered.

/** How eyes weigh the channels: Rec.709, the same weights sRGB is built on. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/** Contrast turns about the middle of the range, so it changes no mid tone. */
const MID = 127.5;

/** How far the warmth slider can push a channel, at full strength. */
const TEMPERATURE_RANGE = 30;

/**
 * A matrix that changes nothing.
 *
 * @returns {Float32Array} 20 numbers, a 4 by 5 matrix.
 */
export function identityMatrix() {
  const matrix = new Float32Array(20);
  matrix[0] = 1;
  matrix[6] = 1;
  matrix[12] = 1;
  matrix[18] = 1;
  return matrix;
}

/**
 * Lighten or darken by adding the same amount to every channel.
 *
 * @param {number} amount -1 is black, 0 changes nothing, 1 is white.
 * @returns {Float32Array}
 */
export function brightnessMatrix(amount) {
  const matrix = identityMatrix();
  const shift = amount * 255;
  matrix[4] = shift;
  matrix[9] = shift;
  matrix[14] = shift;
  return matrix;
}

/**
 * Push the tones apart or pull them together, turning about the middle grey.
 *
 * Pivoting anywhere else would make every contrast change a brightness change
 * too, so one slider would move two things.
 *
 * @param {number} amount 1 changes nothing, 0 flattens the picture to one
 *   grey, above 1 pushes the tones apart.
 * @returns {Float32Array}
 */
export function contrastMatrix(amount) {
  const matrix = identityMatrix();
  const shift = MID - MID * amount;
  matrix[0] = amount;
  matrix[6] = amount;
  matrix[12] = amount;
  matrix[4] = shift;
  matrix[9] = shift;
  matrix[14] = shift;
  return matrix;
}

/**
 * Move each colour towards or away from its own grey.
 *
 * The grey it moves towards is the weighted brightness, not the plain average.
 * Green looks far brighter than blue at the same value, so a plain average
 * would turn a red and a green into the same mid grey.
 *
 * @param {number} amount 0 is grey, 1 changes nothing, above 1 exaggerates.
 * @returns {Float32Array}
 */
export function saturationMatrix(amount) {
  const matrix = new Float32Array(20);
  const rest = 1 - amount;
  matrix[0] = LUMA_R * rest + amount;
  matrix[1] = LUMA_G * rest;
  matrix[2] = LUMA_B * rest;
  matrix[5] = LUMA_R * rest;
  matrix[6] = LUMA_G * rest + amount;
  matrix[7] = LUMA_B * rest;
  matrix[10] = LUMA_R * rest;
  matrix[11] = LUMA_G * rest;
  matrix[12] = LUMA_B * rest + amount;
  matrix[18] = 1;
  return matrix;
}

/**
 * Warm the picture up or cool it down.
 *
 * Warmth is red against blue, which is how a camera's white balance works and
 * how the eye reads a photo as sunny or overcast. Green is left alone, so the
 * slider moves one axis and not two.
 *
 * @param {number} amount -1 is coldest, 0 changes nothing, 1 is warmest.
 * @returns {Float32Array}
 */
export function temperatureMatrix(amount) {
  const matrix = identityMatrix();
  matrix[4] = amount * TEMPERATURE_RANGE;
  matrix[14] = -amount * TEMPERATURE_RANGE;
  return matrix;
}

/**
 * Multiply two matrices, so applying the result once equals applying `first`
 * then `second`.
 *
 * @param {Float32Array} first Applied first.
 * @param {Float32Array} second Applied second.
 * @returns {Float32Array}
 */
export function composeMatrices(first, second) {
  const out = new Float32Array(20);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let total = 0;
      for (let inner = 0; inner < 4; inner += 1) {
        total += second[row * 5 + inner] * first[inner * 5 + column];
      }
      out[row * 5 + column] = total;
    }
    // The constant column: the second matrix's own constant, plus whatever
    // the second matrix makes of the first one's constants. Dropping this
    // term is what silently loses the brightness slider in a stack.
    let constant = second[row * 5 + 4];
    for (let inner = 0; inner < 4; inner += 1) {
      constant += second[row * 5 + inner] * first[inner * 5 + 4];
    }
    out[row * 5 + 4] = constant;
  }
  return out;
}

/**
 * One matrix for a whole set of slider positions.
 *
 * The order is fixed: saturation, then contrast, then brightness, then
 * warmth. Saturation goes first because it is the only one that mixes the
 * channels together, and running it after a channel shift would spread that
 * shift across all three.
 *
 * @param {object} adjustments
 * @param {number} [adjustments.saturation]
 * @param {number} [adjustments.contrast]
 * @param {number} [adjustments.brightness]
 * @param {number} [adjustments.temperature]
 * @returns {Float32Array}
 */
export function buildMatrix({ saturation = 1, contrast = 1, brightness = 0, temperature = 0 }) {
  let matrix = identityMatrix();
  if (saturation !== 1) matrix = composeMatrices(matrix, saturationMatrix(saturation));
  if (contrast !== 1) matrix = composeMatrices(matrix, contrastMatrix(contrast));
  if (brightness !== 0) matrix = composeMatrices(matrix, brightnessMatrix(brightness));
  if (temperature !== 0) matrix = composeMatrices(matrix, temperatureMatrix(temperature));
  return matrix;
}

/**
 * Run a matrix over a picture.
 *
 * @param {Uint8ClampedArray} rgba Left unchanged: the editor re-applies the
 *   filters from the original picture on every slider move, so writing
 *   through the input would compound the change on each pass.
 * @param {Float32Array} matrix
 * @returns {Uint8ClampedArray} A new picture.
 */
export function applyMatrix(rgba, matrix) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let at = 0; at < rgba.length; at += 4) {
    const r = rgba[at];
    const g = rgba[at + 1];
    const b = rgba[at + 2];
    const a = rgba[at + 3];
    // Uint8ClampedArray clamps to 0 to 255 on assignment, so a result off
    // either end lands on the end rather than wrapping around.
    out[at] = matrix[0] * r + matrix[1] * g + matrix[2] * b + matrix[3] * a + matrix[4];
    out[at + 1] = matrix[5] * r + matrix[6] * g + matrix[7] * b + matrix[8] * a + matrix[9];
    out[at + 2] = matrix[10] * r + matrix[11] * g + matrix[12] * b + matrix[13] * a + matrix[14];
    // Alpha is copied, never computed. See the note at the top of the file.
    out[at + 3] = a;
  }
  return out;
}

/**
 * The named looks. Each is a set of slider positions, so a preset and a hand
 * adjustment are the same kind of thing and can be stacked.
 *
 * `labelKey` names a message in `i18n.js` rather than holding English, so the
 * list reads in either language.
 */
export const FILTER_PRESETS = [
  { id: "none", labelKey: "filter.none", adjustments: {} },
  { id: "punch", labelKey: "filter.punch", adjustments: { saturation: 1.4, contrast: 1.15 } },
  { id: "soft", labelKey: "filter.soft", adjustments: { saturation: 0.85, contrast: 0.9, brightness: 0.06 } },
  { id: "mono", labelKey: "filter.mono", adjustments: { saturation: 0, contrast: 1.1 } },
  { id: "noir", labelKey: "filter.noir", adjustments: { saturation: 0, contrast: 1.5, brightness: -0.05 } },
  { id: "sunny", labelKey: "filter.sunny", adjustments: { temperature: 0.6, saturation: 1.15 } },
  { id: "cool", labelKey: "filter.cool", adjustments: { temperature: -0.6, saturation: 1.1 } },
  { id: "fade", labelKey: "filter.fade", adjustments: { saturation: 0.7, contrast: 0.8, brightness: 0.1 } },
  { id: "poster", labelKey: "filter.poster", adjustments: { saturation: 1.8, contrast: 1.6 } },
];

/**
 * The matrix for a named preset.
 *
 * @param {string} id
 * @returns {Float32Array} The identity for a name this version does not know,
 *   because a sticker saved by an older version should lose its look rather
 *   than fail to open.
 */
export function presetMatrix(id) {
  const preset = FILTER_PRESETS.find((entry) => entry.id === id);
  return preset ? buildMatrix(preset.adjustments) : identityMatrix();
}
