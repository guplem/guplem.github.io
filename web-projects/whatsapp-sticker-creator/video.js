// Turning a video into the frames of an animated sticker.
//
// A sticker is not a video. WhatsApp plays an animated sticker as a short
// silent loop of at most 60 pictures, 10 seconds and 500KB, so a video cannot
// be handed over as it is: a piece of it has to be chosen, and that piece has
// to be sampled into a small number of still pictures.
//
// This file makes every one of those decisions and touches no video. It says
// which moments to grab and how long each grabbed picture stays on screen.
// `render.js` does the grabbing, and `app.js` turns the pictures into frames
// the editor already knows how to handle. The split is what lets the hard part
// be tested without a browser.
//
// Two rules shape the plan:
//
//   The clip plays at real speed. Each frame stays on screen for the gap
//   between the moments it was taken from, so a three second clip lasts three
//   seconds and the movement looks like the video it came from.
//
//   The frame budget lowers the rate, never the length. When the moments asked
//   for are more than 60, the clip is sampled wider instead of being cut
//   short. A person who chose three seconds gets three seconds, a little
//   choppier, rather than one second at a smooth rate.

import { MAX_FRAMES } from "./frames.js";
import { MAX_ANIMATION_MS, MIN_FRAME_DURATION_MS } from "./spec.js";

/** The rates the tool offers, and the one it starts with. */
export const MIN_VIDEO_FPS = 4;
export const MAX_VIDEO_FPS = 24;
export const DEFAULT_VIDEO_FPS = 12;

/**
 * How much of a long video the tool takes by default.
 *
 * Three seconds at 12 pictures a second is 36 frames, which fits the 60 frame
 * budget and leaves about 14KB per frame of the 500KB a sticker may weigh.
 * Ten seconds would spend the whole budget and force a quality nobody wants.
 */
export const DEFAULT_CLIP_MS = 3000;

/** The shortest clip the tool will cut, so a start near the end still works. */
export const MIN_CLIP_MS = 100;

/** File endings for the videos a browser can usually open. */
const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "ogv", "ogg", "mkv", "avi", "3gp"];

/**
 * Is this file a video?
 *
 * The browser's own type is the answer when there is one. Some browsers hand
 * back an empty type for a `.mov` recorded on a phone, so the name is the
 * fallback rather than a refusal the person cannot explain.
 *
 * @param {{ type?: string, name?: string }} file
 * @returns {boolean}
 */
export function isVideoFile(file) {
  const type = String(file?.type ?? "");
  if (type.startsWith("video/")) return true;
  if (type.startsWith("image/")) return false;
  const ending = String(file?.name ?? "").split(".").pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.includes(ending ?? "");
}

/**
 * The piece of a video the tool takes before the person changes it.
 *
 * @param {number} durationMs How long the whole video runs.
 * @returns {{ startMs: number, lengthMs: number }}
 */
export function defaultClip(durationMs) {
  return { startMs: 0, lengthMs: Math.min(DEFAULT_CLIP_MS, Math.max(0, durationMs)) };
}

/**
 * Decide which moments of a video become frames, and how long each one shows.
 *
 * @param {object} options
 * @param {number} options.durationMs How long the whole video runs.
 * @param {number} [options.startMs] Where the clip starts.
 * @param {number} [options.lengthMs] How much of the video the clip takes.
 * @param {number} [options.fps] Pictures a second, clamped to the range above.
 * @param {number} [options.maxFrames]
 * @param {number} [options.maxAnimationMs]
 * @returns {{
 *   timesMs: number[],
 *   frameDurationMs: number,
 *   startMs: number,
 *   lengthMs: number,
 *   fps: number,
 *   capped: boolean,
 * }} `capped` is true when the frame budget lowered the rate.
 * @throws When the video has no length to sample, which includes a live stream.
 */
export function planVideoFrames({
  durationMs,
  startMs = 0,
  lengthMs = DEFAULT_CLIP_MS,
  fps = DEFAULT_VIDEO_FPS,
  maxFrames = MAX_FRAMES,
  maxAnimationMs = MAX_ANIMATION_MS,
} = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("This video has no length that can be read.");
  }

  const rate = clamp(Number(fps) || DEFAULT_VIDEO_FPS, MIN_VIDEO_FPS, MAX_VIDEO_FPS);
  // A start past the end would sample nothing, so it is pulled back far enough
  // to leave the shortest clip the tool cuts.
  const start = clamp(Number(startMs) || 0, 0, Math.max(0, durationMs - MIN_CLIP_MS));
  const length = clamp(
    Number(lengthMs) || DEFAULT_CLIP_MS,
    1,
    Math.min(durationMs - start, maxAnimationMs),
  );

  // How many pictures the rate asks for, then what the budget allows. Two is
  // the floor: one frame is a still picture, and WhatsApp refuses it inside an
  // animated pack.
  const wanted = Math.max(2, Math.floor(length / (1000 / rate)));
  const count = Math.min(wanted, maxFrames);
  const step = length / count;

  const timesMs = Array.from({ length: count }, (_, index) =>
    Math.min(Math.round(start + index * step), Math.ceil(start + length) - 1),
  );

  // Floor, not round: rounding up would push the animation past the ceiling
  // when the clip already fills it.
  const frameDurationMs = Math.max(MIN_FRAME_DURATION_MS, Math.floor(step));

  return { timesMs, frameDurationMs, startMs: start, lengthMs: length, fps: rate, capped: wanted > maxFrames };
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}
