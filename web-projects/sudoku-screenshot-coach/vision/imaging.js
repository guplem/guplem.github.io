// Pixel work: the small, general image operations the grid finder builds on.
//
// Every function here is pure and takes plain typed arrays, so the whole image
// pipeline runs and gets tested without a browser or a canvas.
//
// Two data shapes travel through this module:
//   gray  Uint8ClampedArray, one byte of brightness per pixel, 0 is black.
//   mask  Uint8Array, 1 where there is ink (a dark stroke), 0 elsewhere.

/**
 * Brightness of every pixel of an RGBA buffer.
 * A transparent pixel is blended onto white first, because that is what a
 * browser shows behind a screenshot with an alpha channel.
 */
export function toGray(rgba, width, height) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const alpha = rgba[i * 4 + 3] / 255;
    const r = rgba[i * 4] * alpha + 255 * (1 - alpha);
    const g = rgba[i * 4 + 1] * alpha + 255 * (1 - alpha);
    const b = rgba[i * 4 + 2] * alpha + 255 * (1 - alpha);
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/** A copy of the image with light and dark swapped. */
export function invertGray(gray) {
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i += 1) out[i] = 255 - gray[i];
  return out;
}

/**
 * Shrink the image so its longest side is at most `maxDim`, averaging the pixels
 * that merge. Large screenshots are slow to scan and gain nothing in accuracy.
 * @returns {{data: Uint8ClampedArray, width: number, height: number, scale: number}}
 *   `scale` maps a coordinate in the new image back to the original.
 */
export function downscale(gray, width, height, maxDim) {
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { data: gray, width, height, scale: 1 };
  const scale = maxDim / longest;
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const data = new Uint8ClampedArray(outWidth * outHeight);
  for (let y = 0; y < outHeight; y += 1) {
    const y0 = Math.floor((y * height) / outHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / outHeight));
    for (let x = 0; x < outWidth; x += 1) {
      const x0 = Math.floor((x * width) / outWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / outWidth));
      let sum = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          sum += gray[sy * width + sx];
          count += 1;
        }
      }
      data[y * outWidth + x] = Math.round(sum / count);
    }
  }
  return { data, width: outWidth, height: outHeight, scale: outWidth / width };
}

/**
 * Summed-area table: every entry holds the sum of the pixels above and to the
 * left of it. It makes the mean of any rectangle a four-lookup operation, which
 * is what keeps the adaptive threshold fast.
 * @returns {Float64Array} a (width + 1) x (height + 1) table
 */
export function integralImage(gray, width, height) {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum;
    }
  }
  return integral;
}

/** Mean brightness of the square window of the given radius around a pixel. */
export function boxBlurMean(integral, width, height, x, y, radius) {
  const stride = width + 1;
  const x0 = Math.max(0, x - radius);
  const y0 = Math.max(0, y - radius);
  const x1 = Math.min(width - 1, x + radius);
  const y1 = Math.min(height - 1, y + radius);
  const area = (x1 - x0 + 1) * (y1 - y0 + 1);
  const sum =
    integral[(y1 + 1) * stride + (x1 + 1)] -
    integral[y0 * stride + (x1 + 1)] -
    integral[(y1 + 1) * stride + x0] +
    integral[y0 * stride + x0];
  return sum / area;
}

/**
 * Mark a pixel as ink when it is clearly darker than the pixels around it
 * (Bradley and Roth's adaptive threshold). A single global cut-off fails on
 * screenshots, where one part of the page is bright and another is shaded.
 * @param {number} [radius] window radius; defaults to about one eighth of the width
 * @param {number} [tolerance] percent below the local mean a pixel must fall
 */
export function adaptiveThreshold(gray, width, height, radius = Math.max(3, Math.round(Math.min(width, height) / 16)), tolerance = 12) {
  const integral = integralImage(gray, width, height);
  const mask = new Uint8Array(width * height);
  const keep = (100 - tolerance) / 100;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mean = boxBlurMean(integral, width, height, x, y, radius);
      mask[y * width + x] = gray[y * width + x] < mean * keep ? 1 : 0;
    }
  }
  return mask;
}

/**
 * Grow every ink pixel by `radius` in the four directions. It closes the small
 * gaps that anti-aliasing leaves in a thin grid line, so the line survives as
 * one connected shape.
 */
export function dilate(mask, width, height, radius = 1) {
  if (radius <= 0) return mask;
  let current = mask;
  for (let step = 0; step < radius; step += 1) {
    const next = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (current[index]) {
          next[index] = 1;
          continue;
        }
        if (
          (x > 0 && current[index - 1]) ||
          (x < width - 1 && current[index + 1]) ||
          (y > 0 && current[index - width]) ||
          (y < height - 1 && current[index + width])
        ) {
          next[index] = 1;
        }
      }
    }
    current = next;
  }
  return current;
}

/** How many ink pixels a mask holds. */
export function countInk(mask) {
  let count = 0;
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) count += 1;
  return count;
}

/** Share of ink inside a rectangle, from 0 to 1. Parts outside the image count as empty. */
export function inkDensity(mask, width, height, x, y, w, h) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(width, x + w);
  const y1 = Math.min(height, y + h);
  if (x1 <= x0 || y1 <= y0) return 0;
  let count = 0;
  for (let row = y0; row < y1; row += 1) {
    for (let col = x0; col < x1; col += 1) if (mask[row * width + col]) count += 1;
  }
  return count / (w * h);
}
