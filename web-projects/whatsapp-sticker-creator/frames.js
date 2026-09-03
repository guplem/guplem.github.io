// The frame list of an animated sticker: what plays, in what order, for how
// long.
//
// An animated sticker is several pictures in one file, and WhatsApp puts three
// rules on the timing. Every frame must last at least 8 ms, the whole thing
// must run no longer than 10 seconds, and there must be more than one frame or
// it is not an animation at all. Those rules live in `spec.js`; this file
// makes sure the list a person builds obeys them as they build it, rather than
// failing at export when the work is done.
//
// One rule shapes the whole feature and is easy to miss. From WhatsApp's own
// requirements: "the first frame should say it all - WhatsApp ends the
// animation on the first frame after looping". The frame that shows when the
// animation stops is the first one in the list, not the last, so the order in
// the list is not just play order, it decides what the sticker looks like at
// rest.
//
// Frames hold whatever the editor needs to redraw them. Nothing here reads
// those fields, so this module never has to change when the editor does.

import { MAX_ANIMATION_MS, MIN_FRAME_DURATION_MS } from "./spec.js";

/**
 * The most frames one sticker may hold.
 *
 * This is a budget limit, not a format limit. The format would allow 1250
 * frames at the 8 ms floor, but an animated sticker may only be 500KB in
 * total. Past about 60 frames each one gets under 8.5KB, which is less than a
 * recognisable 512 by 512 picture needs, so the sticker would be refused for
 * size no matter how the frames were timed.
 */
export const MAX_FRAMES = 60;

/** The frame time a plain frame gets when there is nothing to copy. */
export const DEFAULT_FRAME_DURATION_MS = 100;

/**
 * Add a frame to the end of the list.
 *
 * @param {object[]} frames
 * @param {object} frame
 * @returns {object[]} A new list.
 * @throws When the list is already full.
 */
export function addFrame(frames, frame) {
  if (frames.length >= MAX_FRAMES) {
    throw new Error(`An animated sticker holds at most ${MAX_FRAMES} frames.`);
  }
  return [
    ...frames,
    {
      ...frame,
      // Frames added one after another keep the timing already chosen, so a
      // person who set 250 ms does not have to set it again for every frame.
      durationMs: clampDuration(
        frame.durationMs ?? frames.at(-1)?.durationMs ?? DEFAULT_FRAME_DURATION_MS,
      ),
    },
  ];
}

/**
 * Take a frame out.
 *
 * @param {object[]} frames
 * @param {number} index
 * @returns {object[]} A new list, unchanged when the index is not there.
 */
export function removeFrame(frames, index) {
  if (index < 0 || index >= frames.length) return [...frames];
  return frames.filter((_, at) => at !== index);
}

/**
 * Move a frame to another position. The order decides both the play order and
 * which frame the sticker rests on, so this is a real edit and not a view.
 *
 * @param {object[]} frames
 * @param {number} from
 * @param {number} to Clamped into the list.
 * @returns {object[]} A new list.
 */
export function moveFrame(frames, from, to) {
  if (from < 0 || from >= frames.length) return [...frames];
  const target = Math.min(Math.max(to, 0), frames.length - 1);
  const next = [...frames];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * Set one frame's time on screen.
 *
 * @param {object[]} frames
 * @param {number} index
 * @param {number} durationMs Raised to the 8 ms floor if it is below it.
 * @returns {object[]} A new list.
 */
export function setFrameDuration(frames, index, durationMs) {
  return frames.map((frame, at) =>
    at === index ? { ...frame, durationMs: clampDuration(durationMs) } : frame,
  );
}

/**
 * Give every frame the same time on screen.
 *
 * @param {object[]} frames
 * @param {number} durationMs
 * @returns {object[]} A new list.
 */
export function setAllDurations(frames, durationMs) {
  const clamped = clampDuration(durationMs);
  return frames.map((frame) => ({ ...frame, durationMs: clamped }));
}

/**
 * Speed the animation up or slow it down, keeping the rhythm between frames.
 *
 * @param {object[]} frames
 * @param {number} factor Above 1 slows down, below 1 speeds up.
 * @returns {object[]} A new list.
 */
export function scaleDurations(frames, factor) {
  return frames.map((frame) => ({
    ...frame,
    durationMs: clampDuration(frame.durationMs * factor),
  }));
}

/**
 * How long the animation runs.
 *
 * @param {{ durationMs: number }[]} frames
 * @param {object} [options]
 * @param {boolean} [options.pingPong] Count the way back too.
 * @returns {number} Milliseconds.
 */
export function totalDurationMs(frames, { pingPong = false } = {}) {
  return playbackOrder(frames, { pingPong }).reduce(
    (total, frame) => total + frame.durationMs,
    0,
  );
}

/**
 * The frames in the order they play.
 *
 * A ping-pong runs down the list and back up it, leaving out both ends on the
 * way back. Repeating an end would make that frame appear to hang for twice as
 * long at the turn.
 *
 * @param {object[]} frames
 * @param {object} [options]
 * @param {boolean} [options.pingPong]
 * @returns {object[]} Frames, possibly the same frame more than once.
 */
export function playbackOrder(frames, { pingPong = false } = {}) {
  if (!pingPong || frames.length < 3) return [...frames];
  return [...frames, ...frames.slice(1, -1).reverse()];
}

/**
 * Shrink an over-long animation to fit WhatsApp's ten second ceiling, keeping
 * the rhythm between frames.
 *
 * @param {object[]} frames
 * @param {object} [options]
 * @param {boolean} [options.pingPong]
 * @param {number} [options.maxMs]
 * @returns {object[]} A new list.
 */
export function fitWithinLimit(frames, { pingPong = false, maxMs = MAX_ANIMATION_MS } = {}) {
  if (frames.length === 0) return [];
  const total = totalDurationMs(frames, { pingPong });
  if (total <= maxMs) return [...frames];
  // Scaling every frame by the same factor is what keeps the rhythm. Some
  // frames may land on the floor, which shortens the animation by less than
  // asked; the caller checks the total afterwards.
  return scaleDurations(frames, maxMs / total);
}

/**
 * The frame time for a rate in frames per second.
 *
 * @param {number} fps
 * @returns {number} Whole milliseconds, never below the floor.
 */
export function durationForFps(fps) {
  if (!(fps > 0)) return DEFAULT_FRAME_DURATION_MS;
  return clampDuration(1000 / fps);
}

/** Whole milliseconds, and never below what WhatsApp accepts. */
function clampDuration(durationMs) {
  const whole = Math.round(Number(durationMs));
  if (!Number.isFinite(whole)) return DEFAULT_FRAME_DURATION_MS;
  return Math.max(MIN_FRAME_DURATION_MS, whole);
}
