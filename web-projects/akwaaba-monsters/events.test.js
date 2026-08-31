import { describe, test, expect } from "bun:test";
import {
  STEP_NAMES,
  WAITING_STEPS,
  ScriptRunner,
  evaluateCondition,
  runScript,
  validateScript,
} from "./events.js";

/** Run a script to the end and collect every effect it hands out. */
function collect(script, state = {}, answers = []) {
  const runner = runScript(script);
  const effects = [];
  let answerIndex = 0;
  for (let guard = 0; guard < 200; guard++) {
    const effect = runner.step(state);
    effects.push(effect);
    if (effect.type === "end") break;
    if (effect.type === "ask") runner.answer(answers[answerIndex++] ?? 0);
  }
  return effects;
}

describe("evaluateCondition", () => {
  const state = {
    flags: { metProfessor: true },
    player: { badges: ["riverStone"], money: 500 },
    bag: { calabash: 3 },
    party: [{ species: "baobo" }],
  };

  test("reads a flag both ways round", () => {
    expect(evaluateCondition({ flag: "metProfessor" }, state)).toBe(true);
    expect(evaluateCondition({ flag: "beatGym" }, state)).toBe(false);
    expect(evaluateCondition({ notFlag: "beatGym" }, state)).toBe(true);
    expect(evaluateCondition({ notFlag: "metProfessor" }, state)).toBe(false);
  });

  test("reads badges, items, party and money", () => {
    expect(evaluateCondition({ badge: "riverStone" }, state)).toBe(true);
    expect(evaluateCondition({ badge: "goldPan" }, state)).toBe(false);
    expect(evaluateCondition({ hasItem: "calabash" }, state)).toBe(true);
    expect(evaluateCondition({ hasItem: "kelewele" }, state)).toBe(false);
    expect(evaluateCondition({ partyHas: "baobo" }, state)).toBe(true);
    expect(evaluateCondition({ partyHas: "nacho" }, state)).toBe(false);
    expect(evaluateCondition({ partyEmpty: true }, state)).toBe(false);
    expect(evaluateCondition({ partyEmpty: true }, { party: [] })).toBe(true);
    expect(evaluateCondition({ moneyAtLeast: 400 }, state)).toBe(true);
    expect(evaluateCondition({ moneyAtLeast: 900 }, state)).toBe(false);
  });

  test("combines conditions with all and any", () => {
    expect(
      evaluateCondition({ all: [{ flag: "metProfessor" }, { badge: "riverStone" }] }, state),
    ).toBe(true);
    expect(
      evaluateCondition({ all: [{ flag: "metProfessor" }, { badge: "goldPan" }] }, state),
    ).toBe(false);
    expect(evaluateCondition({ any: [{ badge: "goldPan" }, { hasItem: "calabash" }] }, state)).toBe(
      true,
    );
  });

  test("is false for nonsense rather than throwing", () => {
    expect(evaluateCondition(null, state)).toBe(false);
    expect(evaluateCondition({}, state)).toBe(false);
    expect(evaluateCondition({ mystery: 1 }, state)).toBe(false);
    expect(evaluateCondition({ flag: "x" }, {})).toBe(false);
  });
});

describe("running a script", () => {
  test("hands out one effect per step, in order, then ends", () => {
    const effects = collect([
      ["say", "Akwaaba!"],
      ["give", "calabash", 2],
      ["setFlag", "greeted"],
    ]);
    expect(effects.map((effect) => effect.type)).toEqual(["say", "give", "setFlag", "end"]);
    expect(effects[0].text).toBe("Akwaaba!");
    expect(effects[1]).toMatchObject({ item: "calabash", count: 2 });
    expect(effects[2]).toMatchObject({ flag: "greeted", value: true });
  });

  test("ends straight away on an empty script", () => {
    expect(collect([]).map((effect) => effect.type)).toEqual(["end"]);
  });

  test("keeps saying it has ended once it has", () => {
    const runner = runScript([["say", "Hi"]]);
    runner.step();
    expect(runner.step().type).toBe("end");
    expect(runner.step().type).toBe("end");
    expect(runner.done).toBe(true);
  });

  test("gives a count of one when a give step does not say", () => {
    expect(collect([["give", "calabash"]])[0].count).toBe(1);
  });

  test("turns takeMoney into a negative amount and giveMoney into a positive one", () => {
    expect(collect([["giveMoney", 500]])[0].amount).toBe(500);
    expect(collect([["takeMoney", 500]])[0].amount).toBe(-500);
    // Even when the script writer put the sign in themselves.
    expect(collect([["takeMoney", -500]])[0].amount).toBe(-500);
  });

  test("stops at an end step, leaving the rest unread", () => {
    const effects = collect([["say", "First"], ["end"], ["say", "Never"]]);
    expect(effects.map((effect) => effect.type)).toEqual(["say", "end"]);
  });

  test("skips a step it does not know instead of crashing", () => {
    const effects = collect([["say", "One"], ["fly", "away"], ["say", "Two"]]);
    expect(effects.filter((effect) => effect.type === "say").length).toBe(2);
  });

  test("skips a step that is not even a list", () => {
    expect(collect([["say", "One"], "nonsense", null, ["say", "Two"]]).length).toBe(3);
  });

  test("can be cancelled part way, which is what losing a battle does", () => {
    const runner = runScript([["say", "One"], ["say", "Two"]]);
    runner.step();
    runner.cancel();
    expect(runner.step().type).toBe("end");
    expect(runner.done).toBe(true);
  });
});

describe("branching on the game state", () => {
  const script = [
    [
      "if",
      { flag: "beatGym" },
      [["say", "Well done!"]],
      [["say", "Come back when you have the badge."]],
    ],
    ["say", "Goodbye."],
  ];

  test("takes the first branch when the condition holds", () => {
    const effects = collect(script, { flags: { beatGym: true } });
    expect(effects[0].text).toBe("Well done!");
    expect(effects[1].text).toBe("Goodbye.");
  });

  test("takes the other branch when it does not", () => {
    const effects = collect(script, { flags: {} });
    expect(effects[0].text).toContain("Come back");
    expect(effects[1].text).toBe("Goodbye.");
  });

  test("carries on when a branch is missing entirely", () => {
    const effects = collect([["if", { flag: "nope" }, [["say", "Yes"]]], ["say", "After"]], {});
    expect(effects.map((effect) => effect.type)).toEqual(["say", "end"]);
    expect(effects[0].text).toBe("After");
  });

  test("handles a branch inside a branch", () => {
    const nested = [
      [
        "if",
        { flag: "a" },
        [["if", { flag: "b" }, [["say", "both"]], [["say", "only a"]]]],
        [["say", "neither"]],
      ],
    ];
    expect(collect(nested, { flags: { a: true, b: true } })[0].text).toBe("both");
    expect(collect(nested, { flags: { a: true } })[0].text).toBe("only a");
    expect(collect(nested, { flags: {} })[0].text).toBe("neither");
  });

  test("reads the state given at each step, not the one it started with", () => {
    const runner = runScript([["say", "One"], ["if", { flag: "later" }, [["say", "Set!"]]]]);
    runner.step({ flags: {} });
    // The caller set the flag between steps, which is what an effect does.
    expect(runner.step({ flags: { later: true } }).text).toBe("Set!");
  });
});

describe("questions", () => {
  const script = [
    [
      "ask",
      "Would you like some soup?",
      [
        { label: "Yes", then: [["say", "You feel unwell."], ["setFlag", "ateSoup"]] },
        { label: "No", then: [["say", "She looks offended."]] },
      ],
    ],
    ["say", "She stirs the pot."],
  ];

  test("stop and wait until they are answered", () => {
    const runner = runScript(script);
    const asked = runner.step({});
    expect(asked.type).toBe("ask");
    expect(asked.options.map((option) => option.label)).toEqual(["Yes", "No"]);
    // Asking again before answering gives the same question back.
    expect(runner.step({}).type).toBe("ask");
  });

  test("run the branch the player picked", () => {
    const yes = collect(script, {}, [0]);
    expect(yes[1].text).toContain("unwell");
    expect(yes[2]).toMatchObject({ flag: "ateSoup" });

    const no = collect(script, {}, [1]);
    expect(no[1].text).toContain("offended");
  });

  test("carry on with the rest of the script afterwards", () => {
    const effects = collect(script, {}, [1]);
    expect(effects[effects.length - 2].text).toBe("She stirs the pot.");
  });

  test("treat an answer out of range as no branch at all", () => {
    const runner = runScript(script);
    runner.step({});
    runner.answer(99);
    expect(runner.step({}).text).toBe("She stirs the pot.");
  });

  test("ignore an answer when nothing was asked", () => {
    const runner = runScript([["say", "Hi"]]);
    runner.answer(0);
    expect(runner.step({}).type).toBe("say");
  });

  test("handle a question inside an answer", () => {
    const nested = [
      [
        "ask",
        "Sure?",
        [
          {
            label: "Yes",
            then: [["ask", "Really?", [{ label: "Yes", then: [["say", "Fine."]] }, { label: "No" }]]],
          },
          { label: "No" },
        ],
      ],
    ];
    const effects = collect(nested, {}, [0, 0]);
    expect(effects.some((effect) => effect.text === "Fine.")).toBe(true);
  });
});

describe("the effects the game has to carry out", () => {
  test("cover every step name, so nothing is silently ignored", () => {
    const seen = new Set();
    const script = [
      ["say", "x"],
      ["setFlag", "f"],
      ["clearFlag", "f"],
      ["give", "calabash", 1],
      ["giveMoney", 1],
      ["takeMoney", 1],
      ["giveMonster", "polete", 5],
      ["battle", "mamaSopa1"],
      ["wildBattle", "nacho", 20],
      ["warp", "route1", 1, 2, "up"],
      ["heal"],
      ["box"],
      ["shop", ["calabash"]],
      ["badge", "riverStone"],
      ["face", "npc", "left"],
      ["walk", "npc", "up", 2],
      ["hide", "npc"],
      ["show", "npc"],
      ["chooseStarter"],
      ["wait", 100],
      ["music", "town"],
      ["sound", "blip"],
      ["shake", 200],
    ];
    for (const effect of collect(script)) seen.add(effect.type);
    // Every step above produced something other than a silent skip.
    expect(seen.size).toBeGreaterThanOrEqual(18);
    expect(seen.has("end")).toBe(true);
  });

  test("name every step in STEP_NAMES exactly once", () => {
    expect(new Set(STEP_NAMES).size).toBe(STEP_NAMES.length);
  });

  test("open the box and wait, because the player closes that screen", () => {
    // The storage computer runs this step. The script stops until the player
    // shuts the box, the same way a shop stops it.
    expect(collect([["box"]])[0].type).toBe("box");
    expect(WAITING_STEPS.has("box")).toBe(true);
  });

  test("fill in sensible defaults", () => {
    expect(collect([["walk", "npc", "up"]])[0].steps).toBe(1);
    expect(collect([["wait"]])[0].ms).toBeGreaterThan(0);
    expect(collect([["warp", "route1", 1, 2]])[0].dir).toBe("down");
    expect(collect([["giveMonster", "polete"]])[0].level).toBe(5);
    expect(collect([["shop"]])[0].stock).toEqual([]);
  });
});

describe("ScriptRunner used directly", () => {
  test("carries the context it was built with, so an NPC can name itself", () => {
    const runner = new ScriptRunner([["say", "Hello"]], { npc: "chief" });
    expect(runner.step({}).context).toEqual({ npc: "chief" });
  });

  test("survives being given something that is not a script", () => {
    expect(new ScriptRunner(null).step({}).type).toBe("end");
    expect(new ScriptRunner("hello").step({}).type).toBe("end");
  });
});

describe("validateScript", () => {
  const known = {
    items: new Set(["calabash"]),
    species: new Set(["polete"]),
    maps: new Set(["route1"]),
    trainers: new Set(["mamaSopa1"]),
  };

  test("passes a sound script", () => {
    expect(
      validateScript(
        [["say", "Hi"], ["give", "calabash", 1], ["battle", "mamaSopa1"]],
        known,
      ),
    ).toEqual([]);
  });

  test("catches an unknown step name", () => {
    expect(validateScript([["teleport", "away"]], known).join(" ")).toContain("unknown step");
  });

  test("catches a say step with no text", () => {
    expect(validateScript([["say"]], known).join(" ")).toContain("no text");
    expect(validateScript([["say", ""]], known).join(" ")).toContain("no text");
  });

  test("catches an item, species, trainer or map that does not exist", () => {
    expect(validateScript([["give", "potion"]], known).join(" ")).toContain("unknown item");
    expect(validateScript([["giveMonster", "mew"]], known).join(" ")).toContain("unknown species");
    expect(validateScript([["battle", "gary"]], known).join(" ")).toContain("unknown trainer");
    expect(validateScript([["warp", "kanto", 1, 1]], known).join(" ")).toContain("unknown map");
    expect(validateScript([["shop", ["potion"]]], known).join(" ")).toContain("unknown item");
  });

  test("catches a question with only one answer", () => {
    expect(
      validateScript([["ask", "Well?", [{ label: "Yes" }]]], known).join(" "),
    ).toContain("fewer than two");
  });

  test("looks inside branches and answers too", () => {
    const script = [["if", { flag: "a" }, [["give", "potion"]], [["say", ""]]]];
    const problems = validateScript(script, known);
    expect(problems.join(" ")).toContain("unknown item");
    expect(problems.join(" ")).toContain("no text");
  });

  test("catches something that is not a script at all", () => {
    expect(validateScript("hello", known).join(" ")).toContain("not a list of steps");
  });

  test("names where the problem is", () => {
    expect(validateScript([["say"]], known, "chief in Bosua")[0]).toContain("chief in Bosua");
  });
});
