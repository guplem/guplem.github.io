import { describe, test, expect } from "bun:test";
import { applyBattleEvent, easeToward, snapshotBattle } from "./battlePlayback.js";
import { activeMonster, createBattle, takeTurn } from "./battle.js";
import { createMonster, flatIvs, maxHp } from "./monsters.js";
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

/** Play a whole turn onto a snapshot, the way the screen does. */
function playBack(shown, events) {
  let current = shown;
  for (const event of events) current = applyBattleEvent(current, event);
  return current;
}

describe("snapshotBattle", () => {
  test("copies what the screen shows, and keeps the battle's shape", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("hinoko", 30) });
    const shown = snapshotBattle(battle);
    expect(shown.kind).toBe("wild");
    expect(activeMonster(shown, "player").species).toBe("nacho");
    expect(activeMonster(shown, "foe").species).toBe("hinoko");
    expect(shown.fainted).toEqual({ player: false, foe: false });
  });

  test("says a side is down when the creature it has out has fainted", () => {
    const battle = battleWith({
      mine: [monster("nacho", 30), monster("hinoko", 30)],
      theirs: monster("nacho", 30),
    });
    battle.player.party[0].hp = 0;
    expect(snapshotBattle(battle).fainted).toEqual({ player: true, foe: false });
  });

  test("holds no live generator, so it can be copied freely", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    expect(shown.rng).toBeUndefined();
    expect(() => structuredClone(shown)).not.toThrow();
  });

  test("does not change when the real battle moves on", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    const before = activeMonster(shown, "foe").hp;
    takeTurn(battle, { kind: "move", slot: 0 });
    expect(activeMonster(shown, "foe").hp).toBe(before);
  });
});

describe("applyBattleEvent", () => {
  test("a message alone changes nothing on screen", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    const after = applyBattleEvent(shown, { type: "message", text: "Nacho used Bash!" });
    expect(activeMonster(after, "foe").hp).toBe(activeMonster(shown, "foe").hp);
  });

  test("damage lowers health only when the damage event plays", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    const full = activeMonster(shown, "foe").hp;
    const said = applyBattleEvent(shown, { type: "message", text: "Nacho used Bash!" });
    expect(activeMonster(said, "foe").hp).toBe(full);
    const hurt = applyBattleEvent(said, { type: "damage", side: "foe", amount: 9, hp: full - 9 });
    expect(activeMonster(hurt, "foe").hp).toBe(full - 9);
  });

  test("leaves the snapshot it was given alone", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    const full = activeMonster(shown, "foe").hp;
    applyBattleEvent(shown, { type: "damage", side: "foe", amount: 5, hp: full - 5 });
    expect(activeMonster(shown, "foe").hp).toBe(full);
  });

  test("healing raises health", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    shown.player.party[0].hp = 5;
    const after = applyBattleEvent(shown, { type: "heal", side: "player", amount: 10, hp: 15 });
    expect(activeMonster(after, "player").hp).toBe(15);
  });

  test("a status arrives and later leaves", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    const sick = applyBattleEvent(shown, { type: "status", side: "foe", status: "poison" });
    expect(activeMonster(sick, "foe").status).toBe("poison");
    const cured = applyBattleEvent(sick, { type: "statusEnd", side: "foe", status: "poison" });
    expect(activeMonster(cured, "foe").status).toBeNull();
  });

  test("a faint empties the health bar and marks the side as down", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    const after = applyBattleEvent(shown, { type: "faint", side: "foe" });
    expect(activeMonster(after, "foe").hp).toBe(0);
    expect(after.fainted.foe).toBe(true);
  });

  test("a send-out swaps the creature and stands the side back up", () => {
    const battle = battleWith({
      mine: [monster("nacho", 30), monster("hinoko", 30)],
      theirs: monster("nacho", 30),
    });
    const shown = applyBattleEvent(snapshotBattle(battle), { type: "faint", side: "player" });
    const after = applyBattleEvent(shown, { type: "sendOut", side: "player", partyIndex: 1 });
    expect(activeMonster(after, "player").species).toBe("hinoko");
    expect(after.fainted.player).toBe(false);
  });

  test("experience and a level fill the bar and raise the number", () => {
    const battle = battleWith({ mine: monster("nacho", 5), theirs: monster("nacho", 5) });
    const shown = snapshotBattle(battle);
    const gained = applyBattleEvent(shown, { type: "exp", amount: 300, partyIndex: 0, exp: 900 });
    expect(gained.player.party[0].exp).toBe(900);
    const grown = applyBattleEvent(gained, { type: "levelUp", partyIndex: 0, level: 9, hp: 30 });
    expect(grown.player.party[0].level).toBe(9);
    expect(grown.player.party[0].hp).toBe(30);
  });

  test("an event it does not know leaves the picture alone", () => {
    const battle = battleWith({ mine: monster("nacho", 30), theirs: monster("nacho", 30) });
    const shown = snapshotBattle(battle);
    const after = applyBattleEvent(shown, { type: "somethingNew", side: "foe" });
    expect(activeMonster(after, "foe").hp).toBe(activeMonster(shown, "foe").hp);
  });
});

describe("the played-back picture matches the battle it came from", () => {
  // This is the property that makes the delay safe: once the last event of a
  // turn has played, the screen shows exactly the state the engine worked out.

  /** The numbers a player can read off the battle screen. */
  function visible(state) {
    return ["player", "foe"].map((side) => {
      const monster = activeMonster(state, side);
      return {
        side,
        species: monster.species,
        hp: monster.hp,
        max: maxHp(monster),
        level: monster.level,
        status: monster.status ?? null,
        exp: monster.exp,
      };
    });
  }

  test("over a whole battle, for several pairs of creatures", () => {
    const pairs = [
      ["nacho", "hinoko"],
      ["kanku", "carsla"],
      ["seryi", "krabo"],
      ["polete", "sumsu"],
    ];
    for (const [mine, theirs] of pairs) {
      for (let seed = 1; seed <= 3; seed++) {
        let battle = battleWith({
          mine: [monster(mine, 12), monster(theirs, 12)],
          theirs: [monster(theirs, 10), monster(mine, 10)],
          kind: "trainer",
          trainer: { name: "Kofi", prize: 100 },
          seed,
        });
        let shown = snapshotBattle(battle);
        for (let turn = 0; turn < 60 && !battle.over; turn++) {
          const action =
            battle.awaiting === "switch"
              ? { kind: "switch", index: battle.player.party.findIndex((one) => one.hp > 0) }
              : { kind: "move", slot: 0 };
          const played = takeTurn(battle, action);
          battle = played.battle;
          shown = playBack(shown, played.events);
          expect(visible(shown)).toEqual(visible(battle));
        }
      }
    }
  });
});

describe("easeToward", () => {
  test("stands still once it has arrived", () => {
    expect(easeToward(20, 20)).toBe(20);
  });

  test("moves at least one step, so it always arrives", () => {
    expect(easeToward(20, 19)).toBe(19);
    expect(easeToward(19, 20)).toBe(20);
  });

  test("moves faster over a wider gap", () => {
    expect(easeToward(0, 80)).toBe(10);
    expect(easeToward(80, 0)).toBe(70);
    expect(easeToward(78, 80)).toBe(79);
  });

  test("never steps past the target", () => {
    for (let target = 0; target <= 40; target++) {
      for (let current = 0; current <= 40; current++) {
        const moved = easeToward(current, target);
        const overshot = current < target ? moved > target : moved < target;
        expect(overshot).toBe(false);
      }
    }
  });
});
