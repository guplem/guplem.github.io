// Turning and mirroring a picture.
//
// A phone photo often arrives on its side. Browsers usually honour the
// orientation a camera writes into the file, but not always and not
// consistently, so the editor offers a turn button rather than trusting it.
//
// Both operations run on the picture and on its cut-out mask, and both have to
// move the same way or the cut-out slides off the subject. So they take the
// number of bytes per pixel rather than assuming four: a picture has four, a
// mask has one, and one function handles both.

/**
 * Mirror left to right.
 *
 * @param {Uint8Array | Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} channels Bytes per pixel: 4 for a picture, 1 for a mask.
 * @returns {Uint8Array | Uint8ClampedArray} A new array of the same type.
 */
export function flipX(data, width, height, channels) {
  const out = new data.constructor(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * channels;
      const to = (y * width + (width - 1 - x)) * channels;
      // Copy the whole pixel at once. Reversing bytes rather than pixels
      // would turn every red pixel into a transparent blue one.
      for (let channel = 0; channel < channels; channel += 1) {
        out[to + channel] = data[from + channel];
      }
    }
  }
  return out;
}

/**
 * Turn a quarter turn clockwise. The width and the height swap over.
 *
 * @param {Uint8Array | Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} channels Bytes per pixel.
 * @returns {{ data: Uint8Array | Uint8ClampedArray, width: number, height: number }}
 */
export function rotateQuarter(data, width, height, channels) {
  const out = new data.constructor(data.length);
  const turnedWidth = height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * channels;
      // Clockwise: the row a pixel was in becomes the column it ends up in,
      // counted from the right, so the top left corner lands top right.
      const to = (x * turnedWidth + (height - 1 - y)) * channels;
      for (let channel = 0; channel < channels; channel += 1) {
        out[to + channel] = data[from + channel];
      }
    }
  }
  return { data: out, width: turnedWidth, height: width };
}
