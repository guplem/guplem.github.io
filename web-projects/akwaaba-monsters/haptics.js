// The short buzz a phone gives when a finger presses a control.
//
// A touch screen gives a thumb nothing to feel. The buzz puts that back: the
// player knows the game read the press without looking away from the map.
//
// Only some browsers answer `navigator.vibrate`. Every iPhone and most desktop
// browsers ignore it. Nothing in the game may depend on a buzz, so every call
// here is best effort and reports what happened rather than throwing.

/** Where the vibration setting is remembered between visits. */
export const HAPTICS_KEY = "akwaaba-monsters:haptics";

/**
 * How long one buzz lasts, in milliseconds.
 *
 * Short is the whole point. A long buzz reads as an alarm, and a walk across a
 * map sends dozens of presses. This length feels like the click of a key.
 */
export const BUZZ_MS = 12;

export class Haptics {
  /**
   * @param {object} [options]
   * @param {Storage} [options.storage] where to remember the setting
   * @param {?function(number): boolean} [options.vibrate] the browser's own vibrate
   */
  constructor({ storage = globalThis.localStorage, vibrate } = {}) {
    const browser = globalThis.navigator;
    this.storage = storage;
    this.vibrate = vibrate === undefined ? (browser?.vibrate?.bind(browser) ?? null) : vibrate;
    this.enabled = this.#read();
  }

  /** True when the browser can vibrate at all. */
  get supported() {
    return typeof this.vibrate === "function";
  }

  /**
   * Buzz once for a press.
   * @returns {boolean} true when the browser took the request
   */
  buzz(ms = BUZZ_MS) {
    if (!this.enabled || !this.supported) return false;
    try {
      this.vibrate(ms);
      return true;
    } catch {
      // A browser can refuse, for example while the page is hidden. Say nothing.
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    try {
      this.storage?.setItem(HAPTICS_KEY, this.enabled ? "1" : "0");
    } catch {
      // Private browsing can refuse to store. The setting still holds for this visit.
    }
  }

  /** @returns {boolean} the setting it landed on */
  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  #read() {
    try {
      // On by default: the buzz is the point of the feature, and it is short.
      return this.storage?.getItem(HAPTICS_KEY) !== "0";
    } catch {
      return true;
    }
  }
}
