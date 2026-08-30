import { describe, test, expect } from "bun:test";
import {
  GAME_ID,
  depositToBox,
  reorderBox,
  reorderParty,
  swapWithBox,
  withdrawFromBox,
  PARTY_LIMIT,
  SAVE_VERSION,
  STORAGE_KEY,
  addMonster,
  awardBadge,
  cleanName,
  clearStorage,
  createSave,
  exportFileName,
  formatPlayTime,
  hasBadge,
  hasFlag,
  hasStoredSave,
  loadFromStorage,
  markCaught,
  markSeen,
  migrate,
  parseSave,
  sanitiseMonster,
  saveToStorage,
  serialise,
  setFlag,
} from "./save.js";
import { createMonster, maxHp } from "./monsters.js";
import { Rng } from "./rng.js";

/** A stand-in for localStorage, including one that refuses to store anything. */
function fakeStorage({ broken = false } = {}) {
  const map = new Map();
  return {
    getItem(key) {
      if (broken) throw new Error("blocked");
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (broken) throw new Error("quota");
      map.set(key, value);
    },
    removeItem(key) {
      if (broken) throw new Error("blocked");
      map.delete(key);
    },
  };
}

const sampleMonster = () => createMonster({ species: "baobo", level: 5, rng: new Rng(1) });

describe("a new save", () => {
  test("names the game and the version, so a stray file is refused later", () => {
    const state = createSave();
    expect(state.game).toBe(GAME_ID);
    expect(state.version).toBe(SAVE_VERSION);
  });

  test("starts in the player's house with no creatures and no badges", () => {
    const state = createSave();
    expect(state.player.map).toBe("playerHouse");
    expect(state.party).toEqual([]);
    expect(state.player.badges).toEqual([]);
  });

  test("starts with money and a few things in the bag", () => {
    const state = createSave();
    expect(state.player.money).toBeGreaterThan(0);
    expect(state.bag.calabash).toBeGreaterThan(0);
  });

  test("takes the name it is given, and defaults when given none", () => {
    expect(createSave({ name: "Nana" }).player.name).toBe("Nana");
    expect(createSave().player.name).toBe("Guillem");
  });

  test("only accepts the two sprites that exist", () => {
    expect(createSave({ sprite: "girl" }).player.sprite).toBe("girl");
    expect(createSave({ sprite: "robot" }).player.sprite).toBe("boy");
  });
});

describe("cleanName", () => {
  test("trims, collapses spaces and cuts to ten characters", () => {
    expect(cleanName("  Kwame  Nana  ")).toBe("Kwame Nana");
    expect(cleanName("Abcdefghijklmnop")).toBe("Abcdefghij");
  });

  test("falls back when given nothing usable", () => {
    expect(cleanName("")).toBe("Guillem");
    expect(cleanName("   ")).toBe("Guillem");
    expect(cleanName(null)).toBe("Guillem");
    expect(cleanName(undefined)).toBe("Guillem");
  });
});

describe("flags", () => {
  test("start unset and stay set", () => {
    const state = createSave();
    expect(hasFlag(state, "metProfessor")).toBe(false);
    expect(hasFlag(setFlag(state, "metProfessor"), "metProfessor")).toBe(true);
  });

  test("leave the state they were given alone", () => {
    const state = createSave();
    setFlag(state, "metProfessor");
    expect(hasFlag(state, "metProfessor")).toBe(false);
  });

  test("can be cleared again", () => {
    const state = setFlag(createSave(), "gateOpen");
    expect(hasFlag(setFlag(state, "gateOpen", false), "gateOpen")).toBe(false);
  });
});

describe("badges", () => {
  test("are added once and only once", () => {
    let state = createSave();
    state = awardBadge(state, "riverStone");
    state = awardBadge(state, "riverStone");
    expect(state.player.badges).toEqual(["riverStone"]);
    expect(hasBadge(state, "riverStone")).toBe(true);
  });
});

describe("the field guide lists", () => {
  test("note a species as seen", () => {
    expect(markSeen(createSave(), "polete").seen).toEqual(["polete"]);
  });

  test("never note the same species twice", () => {
    const once = markSeen(createSave(), "polete");
    expect(markSeen(once, "polete").seen).toEqual(["polete"]);
  });

  test("ignore a species that does not exist", () => {
    expect(markSeen(createSave(), "mewtwo").seen).toEqual([]);
  });

  test("catching also counts as seeing", () => {
    const state = markCaught(createSave(), "polete");
    expect(state.seen).toContain("polete");
    expect(state.caught).toContain("polete");
  });
});

describe("adding a creature", () => {
  test("goes into the party while there is room", () => {
    const result = addMonster(createSave(), sampleMonster());
    expect(result.wentToBox).toBe(false);
    expect(result.state.party.length).toBe(1);
    expect(result.state.caught).toContain("baobo");
  });

  test("goes into the box once the party is full", () => {
    let state = createSave();
    for (let i = 0; i < PARTY_LIMIT; i++) state = addMonster(state, sampleMonster()).state;
    const result = addMonster(state, createMonster({ species: "gori", rng: new Rng(2) }));
    expect(result.wentToBox).toBe(true);
    expect(result.state.party.length).toBe(PARTY_LIMIT);
    expect(result.state.box.length).toBe(1);
  });
});

describe("saving and loading through the browser", () => {
  test("writes and reads the same game back", () => {
    const storage = fakeStorage();
    const state = addMonster(createSave({ name: "Nana" }), sampleMonster()).state;
    expect(saveToStorage(storage, state).ok).toBe(true);
    const loaded = loadFromStorage(storage);
    expect(loaded.player.name).toBe("Nana");
    expect(loaded.party.length).toBe(1);
    expect(loaded.party[0].species).toBe("baobo");
  });

  test("reports nothing to continue when the store is empty", () => {
    const storage = fakeStorage();
    expect(loadFromStorage(storage)).toBeNull();
    expect(hasStoredSave(storage)).toBe(false);
  });

  test("keeps running when the browser refuses to store anything", () => {
    const storage = fakeStorage({ broken: true });
    const result = saveToStorage(storage, createSave());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Export");
    expect(loadFromStorage(storage)).toBeNull();
    expect(clearStorage(storage)).toBe(false);
  });

  test("ignores rubbish sitting under the storage key", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, "not json at all");
    expect(loadFromStorage(storage)).toBeNull();
  });

  test("throws the save away when asked", () => {
    const storage = fakeStorage();
    saveToStorage(storage, createSave());
    expect(clearStorage(storage)).toBe(true);
    expect(hasStoredSave(storage)).toBe(false);
  });

  test("stamps the moment it was saved", () => {
    const storage = fakeStorage();
    saveToStorage(storage, createSave());
    expect(typeof loadFromStorage(storage).savedAt).toBe("string");
  });
});

describe("exporting and importing a file", () => {
  test("a saved file loads back exactly", () => {
    const state = addMonster(createSave({ name: "Nana" }), sampleMonster()).state;
    const result = parseSave(serialise(state));
    expect(result.ok).toBe(true);
    expect(result.state.player.name).toBe("Nana");
    expect(result.state.party[0].moves).toEqual(state.party[0].moves);
  });

  test("a file the game can move between devices is plain readable JSON", () => {
    const text = serialise(createSave());
    expect(text).toContain("\n");
    expect(JSON.parse(text).game).toBe(GAME_ID);
  });

  test("refuses a file that is not JSON, and says what to do", () => {
    const result = parseSave("<html>oops</html>");
    expect(result.ok).toBe(false);
    expect(result.error).toContain(".json");
  });

  test("refuses another game's save", () => {
    const result = parseSave(JSON.stringify({ game: "pokemon-emerald", version: 1 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("different game");
  });

  test("refuses a save from a newer version instead of mangling it", () => {
    const result = parseSave(JSON.stringify({ game: GAME_ID, version: SAVE_VERSION + 5 }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("newer version");
  });

  test("refuses a JSON file that is not an object", () => {
    expect(parseSave("[1,2,3]").ok).toBe(false);
    expect(parseSave("42").ok).toBe(false);
  });

  test("names the downloaded file after the player and the day", () => {
    const state = createSave({ name: "Nana" });
    const name = exportFileName(state, new Date("2026-08-30T10:00:00Z"));
    expect(name).toBe("akwaaba-Nana-2026-08-30.json");
  });

  test("strips anything awkward out of the file name", () => {
    const state = createSave({ name: "A/B C" });
    expect(exportFileName(state, new Date("2026-01-02T00:00:00Z"))).toBe(
      "akwaaba-ABC-2026-01-02.json",
    );
  });
});

describe("migrate: loading a save written by a different build", () => {
  test("fills in a field that did not exist when the save was written", () => {
    const old = { game: GAME_ID, version: 1, player: { name: "Old" } };
    const state = migrate(old);
    expect(state.player.money).toBeGreaterThan(0);
    expect(state.player.badges).toEqual([]);
    expect(state.bag).toBeDefined();
    expect(state.flags).toEqual({});
  });

  test("keeps a field a newer build added, instead of dropping it", () => {
    // This is the rule that lets area 2 add its own bookkeeping safely.
    const fromFuture = { ...createSave(), areaTwoProgress: { visited: true } };
    expect(migrate(fromFuture).areaTwoProgress).toEqual({ visited: true });
  });

  test("keeps a flag a newer build set, because flags are the story memory", () => {
    const fromFuture = { ...createSave(), flags: { beatGymSeven: true } };
    expect(migrate(fromFuture).flags.beatGymSeven).toBe(true);
  });

  test("drops a creature whose species this build does not have", () => {
    const state = migrate({
      ...createSave(),
      party: [{ species: "lugia", level: 40 }, sampleMonster()],
    });
    expect(state.party.length).toBe(1);
    expect(state.party[0].species).toBe("baobo");
  });

  test("drops an item this build does not have", () => {
    const state = migrate({ ...createSave(), bag: { calabash: 3, masterball: 9 } });
    expect(state.bag).toEqual({ calabash: 3 });
  });

  test("drops a move this build does not have, and never leaves a creature mute", () => {
    const monster = sampleMonster();
    monster.moves = [{ id: "psychic", pp: 10 }];
    const state = migrate({ ...createSave(), party: [monster] });
    expect(state.party[0].moves.length).toBeGreaterThan(0);
    for (const slot of state.party[0].moves) expect(slot.id).not.toBe("psychic");
  });

  test("pulls impossible numbers back into range", () => {
    const monster = { ...sampleMonster(), level: 9999, hp: -50, exp: -1 };
    const state = migrate({
      ...createSave(),
      player: { ...createSave().player, money: -100, x: "left a bit" },
      party: [monster],
    });
    expect(state.player.money).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(state.player.x)).toBe(true);
    expect(state.party[0].level).toBe(100);
    expect(state.party[0].hp).toBeGreaterThanOrEqual(0);
    expect(state.party[0].exp).toBeGreaterThanOrEqual(0);
  });

  test("never lets health sit above the maximum", () => {
    const monster = { ...sampleMonster(), hp: 99999 };
    const state = migrate({ ...createSave(), party: [monster] });
    expect(state.party[0].hp).toBe(maxHp(state.party[0]));
  });

  test("cuts an over-long party down to six", () => {
    const party = Array.from({ length: 10 }, () => sampleMonster());
    expect(migrate({ ...createSave(), party }).party.length).toBe(PARTY_LIMIT);
  });

  test("survives a save with nothing in it at all", () => {
    const state = migrate({});
    expect(state.game).toBe(GAME_ID);
    expect(state.party).toEqual([]);
    expect(state.player.name).toBe("Guillem");
  });

  test("survives being given nothing", () => {
    expect(migrate(null).game).toBe(GAME_ID);
    expect(migrate(undefined).player.map).toBe("playerHouse");
  });

  test("survives fields of completely the wrong type", () => {
    const state = migrate({
      game: GAME_ID,
      party: "not a list",
      bag: 12,
      flags: [1, 2],
      seen: "polete",
      player: "nobody",
    });
    expect(state.party).toEqual([]);
    expect(state.bag).toEqual({});
    expect(state.flags).toEqual({});
    expect(state.seen).toEqual([]);
    expect(state.player.name).toBe("Guillem");
  });

  test("counts every creature held as seen and caught, even if the lists lied", () => {
    const state = migrate({ ...createSave(), party: [sampleMonster()], seen: [], caught: [] });
    expect(state.seen).toContain("baobo");
    expect(state.caught).toContain("baobo");
  });

  test("keeps the random generator's position, so the world does not reshuffle", () => {
    const original = { ...createSave(), rngState: 123456 };
    expect(migrate(original).rngState).toBe(123456);
  });
});

describe("sanitiseMonster", () => {
  test("returns null for something that is not a creature", () => {
    expect(sanitiseMonster(null)).toBeNull();
    expect(sanitiseMonster("baobo")).toBeNull();
    expect(sanitiseMonster({ species: "nothing" })).toBeNull();
  });

  test("never lets power points sit above the move's own maximum", () => {
    const monster = sampleMonster();
    monster.moves = [{ id: "tackle", pp: 999 }];
    expect(sanitiseMonster(monster).moves[0].pp).toBe(35);
  });

  test("pulls hidden talent numbers back into range", () => {
    const monster = { ...sampleMonster(), ivs: { hp: 99, attack: -4 } };
    const clean = sanitiseMonster(monster);
    expect(clean.ivs.hp).toBe(31);
    expect(clean.ivs.attack).toBe(0);
  });

  test("drops a status the battle engine does not know", () => {
    expect(sanitiseMonster({ ...sampleMonster(), status: "cursed" }).status).toBeNull();
  });
});

describe("formatPlayTime", () => {
  test("reads as hours and minutes", () => {
    expect(formatPlayTime(0)).toBe("0:00");
    expect(formatPlayTime(65)).toBe("0:01");
    expect(formatPlayTime(3600)).toBe("1:00");
    expect(formatPlayTime(7 * 3600 + 5 * 60)).toBe("7:05");
  });

  test("never shows a negative time", () => {
    expect(formatPlayTime(-10)).toBe("0:00");
  });
});

describe("moving creatures between the party and the box", () => {
  /** A game with `inParty` creatures out and `inBox` waiting. */
  function withCounts(inParty, inBox) {
    let state = createSave();
    const party = [];
    for (let i = 0; i < inParty; i++) {
      party.push(createMonster({ species: "baobo", level: i + 2, rng: new Rng(i + 1) }));
    }
    const box = [];
    for (let i = 0; i < inBox; i++) {
      box.push(createMonster({ species: "gori", level: i + 20, rng: new Rng(i + 50) }));
    }
    return { ...state, party, box };
  }

  describe("withdrawFromBox", () => {
    test("brings a creature out of the box and into the party", () => {
      const before = withCounts(2, 2);
      const after = withdrawFromBox(before, 1);
      expect(after.moved).toBe(true);
      expect(after.state.party.length).toBe(3);
      expect(after.state.box.length).toBe(1);
      expect(after.state.party[2].level).toBe(21);
    });

    test("refuses when the party is already full, and says why", () => {
      const result = withdrawFromBox(withCounts(PARTY_LIMIT, 1), 0);
      expect(result.moved).toBe(false);
      expect(result.reason).toContain("full");
    });

    test("refuses a box slot that is not there", () => {
      expect(withdrawFromBox(withCounts(2, 1), 5).moved).toBe(false);
      expect(withdrawFromBox(withCounts(2, 1), -1).moved).toBe(false);
      expect(withdrawFromBox(withCounts(2, 0), 0).moved).toBe(false);
    });

    test("leaves the state it was given alone", () => {
      const before = withCounts(2, 2);
      withdrawFromBox(before, 0);
      expect(before.party.length).toBe(2);
      expect(before.box.length).toBe(2);
    });
  });

  describe("depositToBox", () => {
    test("puts a creature away", () => {
      const after = depositToBox(withCounts(3, 0), 1);
      expect(after.moved).toBe(true);
      expect(after.state.party.length).toBe(2);
      expect(after.state.box.length).toBe(1);
      expect(after.state.box[0].level).toBe(3);
    });

    test("never leaves the player with nothing to fight with", () => {
      const result = depositToBox(withCounts(1, 3), 0);
      expect(result.moved).toBe(false);
      expect(result.reason).toContain("last");
    });

    test("refuses a party slot that is not there", () => {
      expect(depositToBox(withCounts(3, 0), 9).moved).toBe(false);
      expect(depositToBox(withCounts(3, 0), -1).moved).toBe(false);
    });

    test("never leaves the player with nothing that can fight", () => {
      // `createBattle` throws when every creature in the party has fainted, so
      // the next patch of tall grass would end the game with an error.
      const state = withCounts(2, 0);
      state.party[0] = { ...state.party[0], hp: 0 };
      const result = depositToBox(state, 1);
      expect(result.moved).toBe(false);
      expect(result.reason).toContain("fight");
    });

    test("still puts a fainted creature away while a healthy one stays out", () => {
      const state = withCounts(2, 0);
      state.party[0] = { ...state.party[0], hp: 0 };
      expect(depositToBox(state, 0).moved).toBe(true);
    });
  });

  describe("swapWithBox", () => {
    test("exchanges the two, keeping both counts the same", () => {
      const before = withCounts(PARTY_LIMIT, 2);
      const after = swapWithBox(before, 0, 1);
      expect(after.swapped).toBe(true);
      expect(after.state.party.length).toBe(PARTY_LIMIT);
      expect(after.state.box.length).toBe(2);
      expect(after.state.party[0].species).toBe("gori");
      expect(after.state.box[1].species).toBe("baobo");
    });

    test("works even with a full party, which is the whole point", () => {
      const result = swapWithBox(withCounts(PARTY_LIMIT, 1), 3, 0);
      expect(result.swapped).toBe(true);
    });

    test("refuses an index that is not there", () => {
      expect(swapWithBox(withCounts(2, 1), 7, 0).swapped).toBe(false);
      expect(swapWithBox(withCounts(2, 1), 0, 7).swapped).toBe(false);
    });

    test("refuses to swap away the only creature that can still fight", () => {
      const state = withCounts(2, 1);
      state.party[0] = { ...state.party[0], hp: 0 };
      state.box[0] = { ...state.box[0], hp: 0 };
      const result = swapWithBox(state, 1, 0);
      expect(result.swapped).toBe(false);
      expect(result.reason).toContain("fight");
    });

    test("allows a swap that brings a healthy creature in", () => {
      const state = withCounts(2, 1);
      state.party[0] = { ...state.party[0], hp: 0 };
      state.party[1] = { ...state.party[1], hp: 0 };
      expect(swapWithBox(state, 0, 0).swapped).toBe(true);
    });

    test("leaves the state it was given alone", () => {
      const before = withCounts(2, 1);
      swapWithBox(before, 0, 0);
      expect(before.party[0].species).toBe("baobo");
      expect(before.box[0].species).toBe("gori");
    });
  });

  describe("reorderParty", () => {
    test("swaps two creatures inside the party", () => {
      const before = withCounts(3, 0);
      const after = reorderParty(before, 0, 2);
      expect(after.party[0].level).toBe(4);
      expect(after.party[2].level).toBe(2);
    });

    test("ignores an index that is not there, and swapping a slot with itself", () => {
      const before = withCounts(3, 0);
      expect(reorderParty(before, 0, 9).party.map((m) => m.level)).toEqual([2, 3, 4]);
      expect(reorderParty(before, 1, 1).party.map((m) => m.level)).toEqual([2, 3, 4]);
    });
  });

  describe("reorderBox", () => {
    test("swaps two creatures inside the box", () => {
      const before = withCounts(1, 3);
      const after = reorderBox(before, 0, 2);
      expect(after.box[0].level).toBe(22);
      expect(after.box[2].level).toBe(20);
    });

    test("ignores an index that is not there, and swapping a slot with itself", () => {
      const before = withCounts(1, 3);
      expect(reorderBox(before, 0, 9).box.map((m) => m.level)).toEqual([20, 21, 22]);
      expect(reorderBox(before, 1, 1).box.map((m) => m.level)).toEqual([20, 21, 22]);
    });

    test("leaves the party alone", () => {
      const before = withCounts(2, 2);
      expect(reorderBox(before, 0, 1).party).toEqual(before.party);
    });
  });

  test("nothing can strand a creature: what goes in can always come out", () => {
    // The bug this whole screen exists to close. Fill the party, catch a
    // seventh, and check the seventh can be brought back into play.
    let state = withCounts(PARTY_LIMIT, 0);
    const extra = createMonster({ species: "polete", level: 30, rng: new Rng(7) });
    const added = addMonster(state, extra);
    expect(added.wentToBox).toBe(true);
    state = added.state;

    const back = swapWithBox(state, 0, 0);
    expect(back.swapped).toBe(true);
    expect(back.state.party.some((m) => m.species === "polete")).toBe(true);
    expect(back.state.party.length).toBe(PARTY_LIMIT);
  });

  test("every move survives being written to JSON and read back", () => {
    const state = withdrawFromBox(withCounts(2, 2), 0).state;
    expect(migrate(JSON.parse(JSON.stringify(state))).party.length).toBe(3);
  });
});
