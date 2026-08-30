// The script engine: how an NPC talks, and how the story moves.
//
// Every conversation, sign, cut scene and gym door in the game is a list of
// steps. A step is an array: the name of the thing to do, then its arguments.
//
//   ["say", "Akwaaba! Welcome."]
//   ["if", { flag: "beatGym" }, [["say", "Well done."]], [["say", "Come back later."]]]
//
// The runner walks that list and hands out one effect at a time. It changes
// nothing itself: `app.js` reads the effect, does it, and asks for the next one.
// That is what makes the whole story testable without a browser.
//
// A later agent writes area 2 by writing more of these lists. Adding a new step
// name means adding one case here and one case in `app.js`, and nothing else.

/** Every step name the runner understands. */
export const STEP_NAMES = [
  "say",
  "ask",
  "if",
  "setFlag",
  "clearFlag",
  "give",
  "giveMoney",
  "takeMoney",
  "giveMonster",
  "battle",
  "wildBattle",
  "warp",
  "heal",
  "shop",
  "badge",
  "face",
  "walk",
  "hide",
  "show",
  "chooseStarter",
  "wait",
  "music",
  "sound",
  "shake",
  "end",
];

/**
 * What `#nextStep` returns when the script is spent.
 *
 * It has to be a value no script can hold. `null` will not do: a script with a
 * stray `null` in it would look finished and the rest would never run.
 */
const NO_MORE_STEPS = Symbol("noMoreSteps");

/** Steps the caller has to finish before the script can carry on. */
export const WAITING_STEPS = new Set([
  "say",
  "ask",
  "battle",
  "wildBattle",
  "shop",
  "chooseStarter",
  "giveMonster",
  "walk",
  "wait",
  "shake",
]);

/**
 * Read one condition against the game state.
 *
 * A condition is an object with exactly one interesting key, which keeps the
 * scripts short to read:
 *   { flag: "x" }        the flag is set
 *   { notFlag: "x" }     the flag is not set
 *   { badge: "x" }       the player has that badge
 *   { hasItem: "x" }     the bag holds at least one
 *   { partyHas: "x" }    that species is in the party
 *   { partyEmpty: true } the player has no creatures at all
 *   { moneyAtLeast: 100 }
 *   { all: [...] } / { any: [...] } to combine them
 */
export function evaluateCondition(condition, state) {
  if (!condition || typeof condition !== "object") return false;
  if (Array.isArray(condition.all)) {
    return condition.all.every((entry) => evaluateCondition(entry, state));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((entry) => evaluateCondition(entry, state));
  }
  if (typeof condition.flag === "string") return Boolean(state.flags?.[condition.flag]);
  if (typeof condition.notFlag === "string") return !state.flags?.[condition.notFlag];
  if (typeof condition.badge === "string") {
    return (state.player?.badges ?? []).includes(condition.badge);
  }
  if (typeof condition.hasItem === "string") return (state.bag?.[condition.hasItem] ?? 0) > 0;
  if (typeof condition.partyHas === "string") {
    return (state.party ?? []).some((monster) => monster.species === condition.partyHas);
  }
  if (condition.partyEmpty === true) return (state.party ?? []).length === 0;
  if (typeof condition.moneyAtLeast === "number") {
    return (state.player?.money ?? 0) >= condition.moneyAtLeast;
  }
  return false;
}

/**
 * Walk a script, one effect at a time.
 *
 * Call `step(state)` to get the next effect. When the effect is one of
 * `WAITING_STEPS`, finish it and then call `step` again. After an `ask` effect,
 * call `answer(index)` first to say which option the player picked.
 */
export class ScriptRunner {
  /**
   * @param {Array} script a list of steps
   * @param {object} [context] anything the script needs, such as the NPC running it
   */
  constructor(script, context = {}) {
    this.frames = [{ steps: Array.isArray(script) ? script : [], index: 0 }];
    this.context = context;
    this.finished = false;
    this.pendingOptions = null;
  }

  /** True when there is nothing left to do. */
  get done() {
    return this.finished;
  }

  /** Take the next step off the top frame, or the sentinel when none is left. */
  #nextStep() {
    while (this.frames.length > 0) {
      const frame = this.frames[this.frames.length - 1];
      if (frame.index >= frame.steps.length) {
        this.frames.pop();
        continue;
      }
      return frame.steps[frame.index++];
    }
    return NO_MORE_STEPS;
  }

  /** Run a nested list of steps before carrying on with the current one. */
  #push(steps) {
    if (Array.isArray(steps) && steps.length > 0) {
      this.frames.push({ steps, index: 0 });
    }
  }

  /**
   * The next effect for the caller to carry out.
   *
   * @param {object} state the game state, for reading conditions
   * @returns {object} an effect with a `type`. `{type:"end"}` means finished.
   */
  step(state = {}) {
    if (this.finished) return { type: "end" };
    if (this.pendingOptions) {
      // The caller must answer the question before the script moves on.
      return { type: "ask", ...this.pendingOptions };
    }

    for (let guard = 0; guard < 10000; guard++) {
      const raw = this.#nextStep();
      if (raw === NO_MORE_STEPS) {
        this.finished = true;
        return { type: "end" };
      }
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const [name, ...args] = raw;

      switch (name) {
        case "if": {
          const [condition, thenSteps, elseSteps] = args;
          this.#push(evaluateCondition(condition, state) ? thenSteps : elseSteps);
          continue;
        }
        case "ask": {
          const [text, options] = args;
          this.pendingOptions = {
            text,
            options: (options ?? []).map((option) => ({ label: option.label })),
          };
          this.#askOptions = options ?? [];
          return { type: "ask", ...this.pendingOptions };
        }
        case "end":
          this.finished = true;
          return { type: "end" };
        case "say":
          return { type: "say", text: args[0], context: this.context };
        case "setFlag":
          return { type: "setFlag", flag: args[0], value: true };
        case "clearFlag":
          return { type: "setFlag", flag: args[0], value: false };
        case "give":
          return { type: "give", item: args[0], count: args[1] ?? 1 };
        case "giveMoney":
          return { type: "money", amount: Math.abs(args[0] ?? 0) };
        case "takeMoney":
          return { type: "money", amount: -Math.abs(args[0] ?? 0) };
        case "giveMonster":
          return { type: "giveMonster", species: args[0], level: args[1] ?? 5 };
        case "battle":
          return { type: "battle", trainer: args[0] };
        case "wildBattle":
          return { type: "wildBattle", species: args[0], level: args[1] ?? 5 };
        case "warp":
          return { type: "warp", map: args[0], x: args[1], y: args[2], dir: args[3] ?? "down" };
        case "heal":
          return { type: "heal" };
        case "shop":
          return { type: "shop", stock: args[0] ?? [] };
        case "badge":
          return { type: "badge", badge: args[0] };
        case "face":
          return { type: "face", who: args[0], dir: args[1] };
        case "walk":
          return { type: "walk", who: args[0], dir: args[1], steps: args[2] ?? 1 };
        case "hide":
          return { type: "visible", who: args[0], visible: false };
        case "show":
          return { type: "visible", who: args[0], visible: true };
        case "chooseStarter":
          return { type: "chooseStarter" };
        case "wait":
          return { type: "wait", ms: args[0] ?? 300 };
        case "music":
          return { type: "music", track: args[0] };
        case "sound":
          return { type: "sound", sound: args[0] };
        case "shake":
          return { type: "shake", ms: args[0] ?? 400 };
        default:
          // An unknown step is skipped rather than left to crash the game. A
          // stuck NPC is a bug; a black screen is a disaster.
          continue;
      }
    }

    this.finished = true;
    return { type: "end" };
  }

  /**
   * Answer the question the script just asked.
   * @param {number} index which option the player chose
   */
  answer(index) {
    if (!this.pendingOptions) return;
    const options = this.#askOptions ?? [];
    const chosen = options[index];
    this.pendingOptions = null;
    this.#askOptions = [];
    if (chosen?.then) this.#push(chosen.then);
  }

  /** Stop the script wherever it is. Used when a battle is lost. */
  cancel() {
    this.finished = true;
    this.frames = [];
    this.pendingOptions = null;
  }

  #askOptions = [];
}

/** Start a script. A shorthand so callers do not need the class name. */
export function runScript(script, context) {
  return new ScriptRunner(script, context);
}

/**
 * Check a script for the mistakes that are easy to make.
 * `areas.test.js` runs this over every script in the game.
 *
 * @param {Array} script
 * @param {object} known what exists: { items, species, maps, trainers, flags }
 * @returns {string[]} one line per problem
 */
export function validateScript(script, known = {}, where = "script") {
  const problems = [];
  const say = (message) => problems.push(`${where}: ${message}`);
  if (!Array.isArray(script)) {
    say("is not a list of steps");
    return problems;
  }

  for (const raw of script) {
    if (!Array.isArray(raw) || raw.length === 0) {
      say("has a step that is not a list");
      continue;
    }
    const [name, ...args] = raw;
    if (!STEP_NAMES.includes(name)) {
      say(`uses the unknown step "${name}"`);
      continue;
    }
    if (name === "say" && (typeof args[0] !== "string" || args[0].length === 0)) {
      say("has a say step with no text");
    }
    if (name === "if") {
      problems.push(...validateScript(args[1] ?? [], known, where));
      problems.push(...validateScript(args[2] ?? [], known, where));
    }
    if (name === "ask") {
      const options = args[1] ?? [];
      if (options.length < 2) say("has a question with fewer than two answers");
      for (const option of options) {
        if (typeof option.label !== "string") say("has an answer with no label");
        problems.push(...validateScript(option.then ?? [], known, where));
      }
    }
    if (name === "give" && known.items && !known.items.has(args[0])) {
      say(`gives the unknown item "${args[0]}"`);
    }
    if ((name === "giveMonster" || name === "wildBattle") && known.species && !known.species.has(args[0])) {
      say(`names the unknown species "${args[0]}"`);
    }
    if (name === "battle" && known.trainers && !known.trainers.has(args[0])) {
      say(`names the unknown trainer "${args[0]}"`);
    }
    if (name === "warp" && known.maps && !known.maps.has(args[0])) {
      say(`warps to the unknown map "${args[0]}"`);
    }
    if (name === "shop") {
      for (const id of args[0] ?? []) {
        if (known.items && !known.items.has(id)) say(`sells the unknown item "${id}"`);
      }
    }
  }
  return problems;
}
