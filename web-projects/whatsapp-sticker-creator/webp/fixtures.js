// Real WebP files, used as test fixtures.
//
// A hand-written byte array would only prove that the reader agrees with the
// writer in this same folder. These four files come from libwebp (through
// Pillow), so a test that reads them proves the reader agrees with the encoder
// that browsers also use. Each file is a 64x64 image, which keeps the base64
// text short enough to read.
//
// Between them they cover every container shape that `readWebp` must accept:
//
// | fixture          | chunks                  | what it is                  |
// |------------------|-------------------------|-----------------------------|
// | LOSSY_ALPHA      | VP8X, ALPH, VP8         | extended, lossy, has alpha  |
// | LOSSLESS_ALPHA   | VP8L                    | simple, lossless, has alpha |
// | LOSSY_OPAQUE     | VP8                     | simple, lossy, no alpha     |
// | ANIMATED         | VP8X, ANIM, ANMF x3     | an animation, so the reader |
// |                  |                         | can reject it as a frame    |
//
// `canvas.toBlob("image/webp")` in a browser produces the first three shapes,
// which is why the reader has to handle all of them.

/** Extended container, lossy image data, transparency in a separate ALPH chunk. */
export const LOSSY_ALPHA_BASE64 =
  "UklGRrYAAABXRUJQVlA4WAoAAAAQAAAAPwAAPwAAQUxQSB0AAAABDzD/ERFCTQAkDM3o3wk0wD4j" +
  "+j8BqK/MTH7O+ABWUDggcgAAAHAFAJ0BKkAAQAA+fTaSR6SjIaE3/qgAkA+JZADOrQAANgAWVuIO" +
  "QjtluTRZXwf30d94rYAA/v3ZNX6PMFPo62P+h59xv3/+SvL6vFLAJdrC6f9Dz1jfv/8FlFxkN2AC" +
  "JvnkQwGKR5mF/9G7d+v3yeeAAA==";

/** Simple container, one VP8L chunk that carries its own transparency. */
export const LOSSLESS_ALPHA_BASE64 =
  "UklGRjIAAABXRUJQVlA4TCUAAAAvP8APEA8wyOMxWvMf8FATAAlDM/p3Ag2wz4j+TwDqKzOTnzM+" +
  "AA==";

/** Simple container, one VP8 chunk, fully opaque. */
export const LOSSY_OPAQUE_BASE64 =
  "UklGRoYAAABXRUJQVlA4IHoAAACwBQCdASpAAEAAPn0wkkekoyGhN+gAkA+JZADONQAUgBkgAIV/" +
  "AbGlR1r7e6BHDI188dBlEvgA/v0qRf3P/br3/M+C/y5O9iP/I8b/2pU2nGwAUvf/hX3/J5+/zRep" +
  "gP/Ay8q6NQk0YKpH1FfASG/8ynB0inqQPUqAAA==";

/** A three frame animation with durations 100 ms, 60 ms and 240 ms. */
export const ANIMATED_BASE64 =
  "UklGRlABAABXRUJQVlA4WAoAAAACAAAAPwAAPwAAQU5JTQYAAAAAAAAAAABBTk1GYgAAAAUAAAQA" +
  "ACsAACcAAGQAAANWUDggSgAAALADAJ0BKiwAKAA+kUifS6WkIqGjiACwEglnAHYABJhIi9MxeiIA" +
  "AP7scN/+IXextv//1Bn/lof+rQ/YU/0C3/747+At40gEAAAAQU5NRlYAAAAFAAAHAAArAAAnAAA8" +
  "AAABVlA4ID4AAABUAwCdASosACgAPpE+l0uCOAABIJZwDR6oACeMdh+ADRNAAAD+h9f4hd7G2//5" +
  "2D+zf3o9wKyX9IOeTnHAAEFOTUZcAAAABQAACgAAKwAAJwAA8AAAAFZQOCBEAAAAVAMAnQEqLAAo" +
  "AD6RPpdLgjgAASCWcA0eqAAnjHYfgA0TQAAA/uwmX/+cS/kj9Aug//rUyMfRi/wFSyoP6BUuwMWX" +
  "AAA=";

/**
 * Turn one of the base64 fixtures above into the byte array that the readers
 * take. `atob` exists in the browser and in Bun, so no polyfill is needed.
 *
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function fixtureBytes(base64) {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes;
}
