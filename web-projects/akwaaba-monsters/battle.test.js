import { describe, test, expect } from "bun:test";
import {
  MAX_STAGE,
  accuracyMultiplier,
  activeMonster,
  attemptCatch,
  battleName,
  battleResult,
  calcDamage,
  catchChance,
  chooseFoeAction,
  createBattle,
  critChance,
  effectiveStat,
  escapeOdds,
  freshStages,
  stageMultiplier,
  statusLabel,
  takeTurn,
  usableMoves,
} from "./battle.js";
import { createMonster, flatIvs, isFainted, maxHp } from "./monsters.js";
import { getMove } from "./moves.js";
import { Rng } from "./rng.js";

const ivs = flatIvs(15);

function monster(species, level, moves) {
  return createMonster({ species, level, ivs, moves, rng: new Rng(1) });
}

function battleWith({ mine, theirs, kind = "wild", seed = 1, trainer = null }) {
  return createBattle({
    party: Array.isArray(mine) ? mine : [mine],
    foeParty: Array.isArray(theirs) ? theirs : [theirs],
    kind,
    trainer,
    rng: new Rng(seed),
  });
}

/** Keep taking turns with the same action until the battle ends. */
function playOut(battle, action = { kind: "move", slot: 0 }, limit = 200) {
  let current = battle;
  for (let i = 0; i < limit && !current.over; i++) {
    const next = takeTurn(current, current.awaiting === "switch" ? findSwitch(current) : action);
    current = next.battle;
  }
  return current;
}

function findSwitch(battle) {
  const index = battle.player.party.findIndex((entry) => !isFainted(entry));
  return { kind: "switch", index: index < 0 ? 0 : index };
}

describe("stage multipliers", () => {
  test("are one at zero, and never fall to zero at the bottom", () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(-MAX_STAGE)).toBeGreaterThan(0);
    expect(accuracyMultiplier(0)).toBe(1);
    expect(accuracyMultiplier(-MAX_STAGE)).toBeGreaterThan(0);
  });

  test("rise with the stage and fall below it", () => {
    expect(stageMultiplier(1)).toBe(1.5);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3, 5);
  });

  test("stop moving past six stages", () => {
    expect(stageMultiplier(9)).toBe(stageMultiplier(6));
    expect(accuracyMultiplier(-9)).toBe(accuracyMultiplier(-6));
  });

  test("accuracy moves in smaller steps than attack", () => {
    expect(accuracyMultiplier(1)).toBeLessThan(stageMultiplier(1));
  });
});

describe("createBattle", () => {
  test("puts the first healthy creature out on both sides", () => {
    const battle = battleWith({ mine: monster("baobo", 5), theirs: monster("sumsu", 3) });
    expect(activeMonster(battle, "player").species).toBe("baobo");
    expect(activeMonster(battle, "foe").species).toBe("sumsu");
    expect(battle.over).toBe(false);
  });

  test("skips a fainted creature at the front of the party", () => {
    const down = { ...monster("gori", 5), hp: 0 };
    const battle = battleWith({ mine: [down, monster("baobo", 5)], theirs: monster("sumsu", 3) });
    expect(activeMonster(battle, "player").species).toBe("baobo");
  });

  test("copies the party, so a battle never damages the saved one", () => {
    const mine = monster("baobo", 20);
    const battle = battleWith({ mine, theirs: monster("sumsu", 3) });
    activeMonster(battle, "player").hp = 1;
    expect(mine.hp).toBe(maxHp(mine));
  });

  test("refuses to start with nothing to fight or nothing to fight with", () => {
    expect(() => createBattle({ party: [], foeParty: [monster("sumsu", 3)] })).toThrow();
    expect(() => createBattle({ party: [monster("baobo", 5)], foeParty: [] })).toThrow();
    const down = { ...monster("gori", 5), hp: 0 };
    expect(() => createBattle({ party: [down], foeParty: [monster("sumsu", 3)] })).toThrow();
  });
});

describe("battleName", () => {
  test("marks a wild creature as wild", () => {
    const battle = battleWith({ mine: monster("baobo", 5), theirs: monster("sumsu", 3) });
    expect(battleName(battle, "foe")).toBe("Wild Sumsu");
    expect(battleName(battle, "player")).toBe("Baobo");
  });

  test("names the trainer for a trainer's creature", () => {
    const battle = battleWith({
      mine: monster("baobo", 5),
      theirs: monster("kanku", 5),
      kind: "trainer",
      trainer: { name: "Mama Sopa" },
    });
    expect(battleName(battle, "foe")).toBe("Mama Sopa's Kanku");
  });
});

describe("calcDamage", () => {
  const attacker = monster("poya", 20);
  const defender = monster("baobo", 20);

  test("does more damage with more power", () => {
    const weak = calcDamage({
      attacker,
      defender,
      move: getMove("tackle"),
      attackStat: 50,
      defenseStat: 50,
    });
    const strong = calcDamage({
      attacker,
      defender,
      move: getMove("earthquake"),
      attackStat: 50,
      defenseStat: 50,
    });
    expect(strong.damage).toBeGreaterThan(weak.damage);
  });

  test("does less damage against a higher defence", () => {
    const soft = calcDamage({
      attacker,
      defender,
      move: getMove("tackle"),
      attackStat: 50,
      defenseStat: 30,
    });
    const hard = calcDamage({
      attacker,
      defender,
      move: getMove("tackle"),
      attackStat: 50,
      defenseStat: 120,
    });
    expect(hard.damage).toBeLessThan(soft.damage);
  });

  test("doubles for a critical hit", () => {
    const plain = calcDamage({
      attacker,
      defender,
      move: getMove("tackle"),
      attackStat: 60,
      defenseStat: 60,
    });
    const crit = calcDamage({
      attacker,
      defender,
      move: getMove("tackle"),
      attackStat: 60,
      defenseStat: 60,
      crit: true,
    });
    expect(crit.damage).toBeGreaterThan(plain.damage);
  });

  test("adds half again when the move matches the attacker's own type", () => {
    // Poya is earth, so Mud Slam gets the bonus and Bite does not. Both have
    // power 60. The defender must be a creature that resists neither, or its
    // own types would hide the bonus: Gori is plain beast.
    const neutral = monster("gori", 20);
    const matching = calcDamage({
      attacker,
      defender: neutral,
      move: getMove("mudSlam"),
      attackStat: 60,
      defenseStat: 60,
    });
    const plain = calcDamage({
      attacker,
      defender: neutral,
      move: getMove("bite"),
      attackStat: 60,
      defenseStat: 60,
    });
    expect(matching.damage).toBeGreaterThan(plain.damage);
  });

  test("reports zero and a zero multiplier when the type cannot touch the target", () => {
    const sky = monster("sumsu", 20);
    const result = calcDamage({
      attacker,
      defender: sky,
      move: getMove("mudSlam"),
      attackStat: 60,
      defenseStat: 60,
    });
    expect(result.damage).toBe(0);
    expect(result.multiplier).toBe(0);
  });

  test("does nothing for a status move", () => {
    expect(
      calcDamage({ attacker, defender, move: getMove("growl"), attackStat: 60, defenseStat: 60 })
        .damage,
    ).toBe(0);
  });

  test("never does less than one point when it does connect", () => {
    const result = calcDamage({
      attacker: monster("sumsu", 2),
      defender: monster("carsla", 60),
      move: getMove("peck"),
      attackStat: 5,
      defenseStat: 999,
    });
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });

  test("grows with the attacker's level", () => {
    const low = calcDamage({
      attacker: monster("poya", 5),
      defender,
      move: getMove("tackle"),
      attackStat: 50,
      defenseStat: 50,
    });
    const high = calcDamage({
      attacker: monster("poya", 50),
      defender,
      move: getMove("tackle"),
      attackStat: 50,
      defenseStat: 50,
    });
    expect(high.damage).toBeGreaterThan(low.damage);
  });
});

describe("critChance", () => {
  test("is higher for a move built to land critical hits", () => {
    expect(critChance(getMove("razorLeaf"))).toBeGreaterThan(critChance(getMove("vineWhip")));
  });
});

describe("effectiveStat", () => {
  test("halves attack for a burned creature", () => {
    const burned = { ...monster("poya", 20), status: "burn" };
    const healthy = monster("poya", 20);
    const a = battleWith({ mine: burned, theirs: monster("sumsu", 5) });
    const b = battleWith({ mine: healthy, theirs: monster("sumsu", 5) });
    expect(effectiveStat(a, "player", "attack")).toBeLessThan(
      effectiveStat(b, "player", "attack"),
    );
  });

  test("quarters speed for a paralysed creature", () => {
    const stunned = { ...monster("polete", 20), status: "paralysis" };
    const healthy = monster("polete", 20);
    const a = battleWith({ mine: stunned, theirs: monster("sumsu", 5) });
    const b = battleWith({ mine: healthy, theirs: monster("sumsu", 5) });
    expect(effectiveStat(a, "player", "speed") * 4).toBeLessThanOrEqual(
      effectiveStat(b, "player", "speed") + 4,
    );
  });

  test("never falls below one, however many times it is lowered", () => {
    const battle = battleWith({ mine: monster("sumsu", 2), theirs: monster("sumsu", 2) });
    battle.player.stages.attack = -6;
    expect(effectiveStat(battle, "player", "attack")).toBeGreaterThanOrEqual(1);
  });
});

describe("taking a turn", () => {
  test("hurts the foe and writes the log", () => {
    // Name the move: at level 25 Poya's first slot happens to hold a status
    // move, and this test is about damage.
    const battle = battleWith({
      mine: monster("poya", 25, ["tackle"]),
      theirs: monster("sumsu", 5),
    });
    const before = activeMonster(battle, "foe").hp;
    const { battle: after, events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(activeMonster(after, "foe").hp).toBeLessThan(before);
    expect(events.some((event) => event.type === "message")).toBe(true);
  });

  test("leaves the battle it was given untouched", () => {
    const battle = battleWith({ mine: monster("poya", 25), theirs: monster("sumsu", 5) });
    const before = activeMonster(battle, "foe").hp;
    takeTurn(battle, { kind: "move", slot: 0 });
    expect(activeMonster(battle, "foe").hp).toBe(before);
  });

  test("spends one power point per move used", () => {
    const battle = battleWith({ mine: monster("poya", 25), theirs: monster("nacho", 40) });
    const before = activeMonster(battle, "player").moves[0].pp;
    const { battle: after } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(activeMonster(after, "player").moves[0].pp).toBe(before - 1);
  });

  test("refuses to use a move with no power points left", () => {
    const mine = monster("poya", 25);
    mine.moves[0].pp = 0;
    const battle = battleWith({ mine, theirs: monster("nacho", 40) });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.text?.includes("no power left"))).toBe(true);
  });

  test("ends the battle when the wild creature faints", () => {
    const battle = battleWith({ mine: monster("poya", 40), theirs: monster("sumsu", 2) });
    const after = playOut(battle);
    expect(after.over).toBe(true);
    expect(after.outcome).toBe("win");
  });

  test("ends the battle when the whole party faints", () => {
    const battle = battleWith({ mine: monster("sumsu", 2), theirs: monster("nacho", 60) });
    const after = playOut(battle);
    expect(after.over).toBe(true);
    expect(after.outcome).toBe("lose");
  });

  test("asks the player to switch when one creature faints and another can fight", () => {
    const weak = { ...monster("sumsu", 2), hp: 1 };
    const battle = battleWith({
      mine: [weak, monster("nacho", 40)],
      theirs: monster("poya", 45),
    });
    let current = battle;
    for (let i = 0; i < 12 && current.awaiting !== "switch" && !current.over; i++) {
      current = takeTurn(current, { kind: "move", slot: 0 }).battle;
    }
    expect(current.awaiting).toBe("switch");
    expect(current.over).toBe(false);
  });

  test("a forced switch does not give the foe a free hit", () => {
    const weak = { ...monster("sumsu", 2), hp: 1 };
    const battle = battleWith({
      mine: [weak, monster("nacho", 40)],
      theirs: monster("poya", 45),
    });
    let current = battle;
    for (let i = 0; i < 12 && current.awaiting !== "switch" && !current.over; i++) {
      current = takeTurn(current, { kind: "move", slot: 0 }).battle;
    }
    const healthBefore = current.player.party[1].hp;
    const after = takeTurn(current, { kind: "switch", index: 1 }).battle;
    expect(after.player.active).toBe(1);
    expect(after.player.party[1].hp).toBe(healthBefore);
    expect(after.awaiting).toBeNull();
  });

  test("does nothing at all once the battle is over", () => {
    const battle = battleWith({ mine: monster("poya", 40), theirs: monster("sumsu", 2) });
    const done = playOut(battle);
    const { battle: after, events } = takeTurn(done, { kind: "move", slot: 0 });
    expect(events).toEqual([]);
    expect(after.outcome).toBe(done.outcome);
  });

  test("clears the stat changes when a creature is swapped out", () => {
    const battle = battleWith({
      mine: [monster("nacho", 30), monster("gori", 30)],
      theirs: monster("krabo", 5, ["tackle"]),
    });
    battle.player.stages.attack = 3;
    const after = takeTurn(battle, { kind: "switch", index: 1 }).battle;
    expect(after.player.active).toBe(1);
    expect(after.player.stages).toEqual(freshStages());
  });

  test("the faster creature moves first", () => {
    // Polete is the fastest creature in the game; Nacho the slowest.
    const battle = battleWith({
      mine: monster("polete", 30),
      theirs: monster("nacho", 30),
      seed: 4,
    });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    const firstMove = events.find((event) => event.type === "useMove");
    expect(firstMove.side).toBe("player");
  });
});

describe("status conditions", () => {
  test("poison chips away at the end of the turn", () => {
    const poisoned = { ...monster("nacho", 40), status: "poison" };
    const battle = battleWith({ mine: poisoned, theirs: monster("nacho", 40) });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.text?.includes("hurt by its poison"))).toBe(true);
  });

  test("a creature cannot be poisoned twice", () => {
    const battle = battleWith({
      mine: monster("kanku", 30, ["toxicDust"]),
      theirs: { ...monster("nacho", 30), status: "poison" },
    });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.text?.includes("already poisoned"))).toBe(true);
  });

  test("a poison creature cannot be poisoned at all", () => {
    const battle = battleWith({
      mine: monster("kanku", 30, ["toxicDust"]),
      theirs: monster("kanku", 30),
      seed: 11,
    });
    const { battle: after } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(activeMonster(after, "foe").status).not.toBe("poison");
  });

  test("a metal creature shrugs poison off too", () => {
    const battle = battleWith({
      mine: monster("kanku", 30, ["toxicDust"]),
      theirs: monster("carsla", 30),
      seed: 12,
    });
    const { battle: after } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(activeMonster(after, "foe").status).toBeNull();
  });

  test("a fire creature cannot be burned", () => {
    const battle = battleWith({
      mine: monster("ananse", 30, ["ember"]),
      theirs: monster("ananse", 30),
      seed: 3,
    });
    let current = battle;
    for (let i = 0; i < 25 && !current.over; i++) {
      current = takeTurn(current, { kind: "move", slot: 0 }).battle;
      expect(activeMonster(current, "foe").status).not.toBe("burn");
    }
  });

  test("a sleeping creature wakes up on its own", () => {
    const sleeper = { ...monster("nacho", 30), status: "sleep", sleepTurns: 1 };
    const battle = battleWith({ mine: sleeper, theirs: monster("nacho", 30) });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.text?.includes("woke up"))).toBe(true);
  });

  test("a deeply sleeping creature cannot act", () => {
    const sleeper = { ...monster("nacho", 30), status: "sleep", sleepTurns: 3 };
    const battle = battleWith({ mine: sleeper, theirs: monster("nacho", 30) });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    const playerMoved = events.some(
      (event) => event.type === "useMove" && event.side === "player",
    );
    expect(playerMoved).toBe(false);
  });

  test("statusLabel reads as English in the log", () => {
    expect(statusLabel("poison")).toBe("poisoned");
    expect(statusLabel("sleep")).toBe("fast asleep");
  });
});

describe("stat-changing moves", () => {
  test("lower the target's stat and say so", () => {
    const battle = battleWith({
      mine: monster("carsla", 30, ["royalOrder"]),
      theirs: monster("nacho", 30),
    });
    const { battle: after, events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(after.foe.stages.attack).toBe(-1);
    expect(after.foe.stages.defense).toBe(-1);
    expect(events.some((event) => event.text?.includes("Attack fell"))).toBe(true);
  });

  test("raise the user's own stat when the move says self", () => {
    const battle = battleWith({
      mine: monster("seryi", 30, ["fireDance"]),
      theirs: monster("nacho", 30),
    });
    const { battle: after } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(after.player.stages.spAttack).toBe(1);
    expect(after.player.stages.speed).toBe(1);
  });

  test("stop at six stages and say the stat will go no lower", () => {
    const battle = battleWith({
      mine: monster("carsla", 30, ["royalOrder"]),
      theirs: monster("nacho", 60),
    });
    battle.foe.stages.attack = -6;
    battle.foe.stages.defense = -6;
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.text?.includes("no lower"))).toBe(true);
  });
});

describe("healing and draining moves", () => {
  test("Nap gives back half the maximum health", () => {
    const hurt = monster("nacho", 40, ["nap"]);
    hurt.hp = 10;
    const battle = battleWith({ mine: hurt, theirs: monster("sumsu", 2) });
    const { battle: after } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(activeMonster(after, "player").hp).toBeGreaterThan(10);
  });

  test("Nap on a healthy creature heals nothing", () => {
    const battle = battleWith({
      mine: monster("nacho", 40, ["nap"]),
      theirs: monster("sumsu", 2),
    });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.type === "heal")).toBe(false);
  });

  test("Absorb gives back part of the damage it did", () => {
    const hurt = monster("hinoko", 30, ["absorb"]);
    hurt.hp = Math.floor(maxHp(hurt) / 2);
    const battle = battleWith({ mine: hurt, theirs: monster("krabo", 30) });
    const { events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.type === "heal" && event.side === "player")).toBe(true);
  });
});

describe("running away", () => {
  test("cannot happen in a trainer battle", () => {
    const battle = battleWith({
      mine: monster("baobo", 5),
      theirs: monster("kanku", 5),
      kind: "trainer",
      trainer: { name: "Mama Sopa" },
    });
    const { battle: after, events } = takeTurn(battle, { kind: "run" });
    expect(after.over).toBe(false);
    expect(events.some((event) => event.text?.includes("cannot run"))).toBe(true);
  });

  test("works against a much slower wild creature", () => {
    const battle = battleWith({
      mine: monster("polete", 40),
      theirs: monster("nacho", 5),
      seed: 2,
    });
    const { battle: after } = takeTurn(battle, { kind: "run" });
    expect(after.outcome).toBe("ran");
  });

  test("gets easier the more times it is tried", () => {
    expect(escapeOdds(50, 50, 3)).toBeGreaterThan(escapeOdds(50, 50, 0));
  });

  test("is certain against a creature with no speed at all", () => {
    expect(escapeOdds(50, 0, 0)).toBe(256);
  });
});

describe("catching", () => {
  test("is more likely against a hurt creature", () => {
    const healthy = monster("sumsu", 10);
    const hurt = { ...healthy, hp: 1 };
    expect(catchChance({ monster: hurt })).toBeGreaterThan(catchChance({ monster: healthy }));
  });

  test("is more likely against a sleeping creature", () => {
    const awake = monster("sumsu", 10);
    const asleep = { ...awake, status: "sleep" };
    expect(catchChance({ monster: asleep })).toBeGreaterThan(catchChance({ monster: awake }));
  });

  test("is more likely with a better calabash", () => {
    const target = monster("hinoko", 10);
    expect(catchChance({ monster: target, ballBonus: 2 })).toBeGreaterThan(
      catchChance({ monster: target, ballBonus: 1 }),
    );
  });

  test("is harder for a rare creature than a common one", () => {
    // Nacho has the lowest catch rate in the game, Sumsu one of the highest.
    const common = { ...monster("sumsu", 10), hp: 1 };
    const rare = { ...monster("nacho", 10), hp: 1 };
    expect(catchChance({ monster: rare })).toBeLessThan(catchChance({ monster: common }));
  });

  test("is certain for a nearly dead common creature with a good calabash", () => {
    const target = { ...monster("sumsu", 3), hp: 1, status: "sleep" };
    expect(catchChance({ monster: target, ballBonus: 3 })).toBe(1);
  });

  test("a throw reports between zero and three shakes when it fails", () => {
    const rng = new Rng(5);
    const target = monster("nacho", 40);
    for (let i = 0; i < 50; i++) {
      const result = attemptCatch({ monster: target, rng });
      expect(result.shakes).toBeGreaterThanOrEqual(0);
      expect(result.shakes).toBeLessThanOrEqual(3);
      if (result.caught) expect(result.shakes).toBe(3);
    }
  });

  test("a successful throw ends the battle and keeps the creature", () => {
    const target = { ...monster("sumsu", 3), hp: 1, status: "sleep" };
    const battle = battleWith({ mine: monster("baobo", 10), theirs: target, seed: 7 });
    const { battle: after } = takeTurn(battle, { kind: "catch", ballBonus: 3 });
    expect(after.outcome).toBe("caught");
    expect(after.caught.species).toBe("sumsu");
  });

  test("cannot be tried on a trainer's creature", () => {
    const battle = battleWith({
      mine: monster("baobo", 10),
      theirs: monster("kanku", 5),
      kind: "trainer",
      trainer: { name: "Mama Sopa" },
    });
    const { battle: after, events } = takeTurn(battle, { kind: "catch" });
    expect(after.outcome).toBeNull();
    expect(events.some((event) => event.text?.includes("cannot catch"))).toBe(true);
  });
});

describe("trainer battles", () => {
  test("send out the next creature instead of ending", () => {
    const battle = battleWith({
      mine: monster("poya", 45),
      theirs: [{ ...monster("kanku", 3), hp: 1 }, monster("krabo", 5)],
      kind: "trainer",
      trainer: { name: "Mama Sopa", prize: 200 },
    });
    const { battle: after, events } = takeTurn(battle, { kind: "move", slot: 0 });
    expect(events.some((event) => event.type === "sendOut" && event.side === "foe")).toBe(true);
    expect(after.over).toBe(false);
  });

  test("end once every one of the trainer's creatures is down", () => {
    const battle = battleWith({
      mine: monster("poya", 50),
      theirs: [monster("kanku", 3), monster("krabo", 3)],
      kind: "trainer",
      trainer: { name: "Mama Sopa", prize: 200 },
    });
    const after = playOut(battle);
    expect(after.outcome).toBe("win");
    expect(battleResult(after).prize).toBe(200);
  });

  test("pay no prize money for a loss", () => {
    const battle = battleWith({
      mine: monster("sumsu", 2),
      theirs: monster("nacho", 60),
      kind: "trainer",
      trainer: { name: "Nana Sika", prize: 900 },
    });
    const after = playOut(battle);
    expect(after.outcome).toBe("lose");
    expect(battleResult(after).prize).toBe(0);
  });
});

describe("experience after a win", () => {
  test("goes to the creature that was out", () => {
    const battle = battleWith({
      mine: monster("poya", 20, ["tackle"]),
      theirs: monster("sumsu", 3),
    });
    const after = playOut(battle);
    expect(after.outcome).toBe("win");
    expect(after.expGained).toBeGreaterThan(0);
    expect(after.player.party[0].exp).toBeGreaterThan(battle.player.party[0].exp);
  });

  test("is worth more from a trainer than from the wild", () => {
    const wild = playOut(
      battleWith({ mine: monster("poya", 30, ["tackle"]), theirs: monster("kanku", 6) }),
    );
    const fromTrainer = playOut(
      battleWith({
        mine: monster("poya", 30, ["tackle"]),
        theirs: monster("kanku", 6),
        kind: "trainer",
        trainer: { name: "Someone", prize: 10 },
      }),
    );
    expect(fromTrainer.expGained).toBeGreaterThan(wild.expGained);
  });

  test("queues a move to learn rather than replacing one behind the player's back", () => {
    // A level 3 Polete is one level away from Spark, and already has two moves.
    const rookie = monster("polete", 3);
    const battle = battleWith({ mine: rookie, theirs: monster("sumsu", 12) });
    const after = playOut(battle);
    if (after.outcome === "win") {
      expect(Array.isArray(after.pendingLearns)).toBe(true);
    }
    // Whatever happened, the four move slots were never quietly overwritten.
    expect(after.player.party[0].moves.length).toBeLessThanOrEqual(4);
  });

  test("notes an evolution instead of doing it mid-fight", () => {
    const nearly = createMonster({ species: "baobo", level: 15, ivs, rng: new Rng(1) });
    nearly.exp = 3374; // one point short of level 16 on the medium curve
    const battle = battleWith({ mine: nearly, theirs: monster("nacho", 30) });
    const after = playOut(battle);
    if (after.outcome === "win") {
      expect(after.evolutions.some((entry) => entry.to === "baobanto")).toBe(true);
      // The creature has not changed species yet: that happens after the battle.
      expect(after.player.party[0].species).toBe("baobo");
    }
  });
});

describe("the foe's choices", () => {
  test("always pick a move that still has power points", () => {
    const foe = monster("kanku", 20);
    foe.moves[0].pp = 0;
    const battle = battleWith({ mine: monster("baobo", 20), theirs: foe, seed: 3 });
    for (let i = 0; i < 40; i++) {
      const action = chooseFoeAction(battle);
      if (action.kind === "move") expect(foe.moves[action.slot].pp).toBeGreaterThan(0);
    }
  });

  test("fall back to struggling when every move is spent", () => {
    const foe = monster("kanku", 20);
    for (const slot of foe.moves) slot.pp = 0;
    const battle = battleWith({ mine: monster("baobo", 20), theirs: foe });
    expect(chooseFoeAction(battle).kind).toBe("struggle");
  });

  test("a trainer usually reaches for the move that beats you", () => {
    // Krabo is water. Against a fire creature its water move should win out.
    const foe = monster("krabo", 25, ["tackle", "waterJet"]);
    const battle = battleWith({
      mine: monster("ananse", 25),
      theirs: foe,
      kind: "trainer",
      trainer: { name: "Tester" },
      seed: 21,
    });
    let waterPicks = 0;
    for (let i = 0; i < 60; i++) {
      if (chooseFoeAction(battle).slot === 1) waterPicks++;
    }
    expect(waterPicks).toBeGreaterThan(30);
  });
});

describe("usableMoves", () => {
  test("reports every slot with its remaining power points", () => {
    const battle = battleWith({ mine: monster("baobo", 9), theirs: monster("sumsu", 3) });
    const moves = usableMoves(battle);
    expect(moves.length).toBe(4);
    expect(moves[0].usable).toBe(true);
    expect(moves[0].move.name).toBe("Tackle");
  });

  test("marks a spent move as unusable", () => {
    const mine = monster("baobo", 9);
    mine.moves[0].pp = 0;
    const battle = battleWith({ mine, theirs: monster("sumsu", 3) });
    expect(usableMoves(battle)[0].usable).toBe(false);
  });
});

describe("a battle always finishes", () => {
  test("never runs forever, whatever the pairing", () => {
    const pairs = [
      ["baobo", "sumsu"],
      ["nacho", "carsla"],
      ["gis", "dungu"],
      ["polete", "krabo"],
      ["seryi", "sasabon"],
      ["carsla", "carsla"],
    ];
    for (const [mine, theirs] of pairs) {
      for (let seed = 1; seed <= 4; seed++) {
        const battle = battleWith({
          mine: monster(mine, 25),
          theirs: monster(theirs, 25),
          seed,
        });
        const after = playOut(battle, { kind: "move", slot: 0 }, 400);
        expect(after.over).toBe(true);
        expect(["win", "lose", "ran", "caught"]).toContain(after.outcome);
      }
    }
  });

  test("never leaves health below zero or above the maximum", () => {
    const battle = battleWith({ mine: monster("hinoko", 20), theirs: monster("poya", 22), seed: 8 });
    let current = battle;
    for (let i = 0; i < 60 && !current.over; i++) {
      current = takeTurn(current, current.awaiting === "switch" ? findSwitch(current) : { kind: "move", slot: 0 }).battle;
      for (const side of ["player", "foe"]) {
        for (const entry of current[side].party) {
          expect(entry.hp).toBeGreaterThanOrEqual(0);
          expect(entry.hp).toBeLessThanOrEqual(maxHp(entry));
        }
      }
    }
  });
});
