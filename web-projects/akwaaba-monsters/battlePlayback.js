// What the battle screen shows right now.
//
// `battle.js` works a whole turn out at once. If the screen drew that answer
// straight away, every health bar would drop while the message box still said
// "Nacho used Bash!", and both sides would move at the same moment. The real
// games do one thing at a time, and so does this.
//
// So the screen keeps a second, slower copy of the battle: the snapshot. The
// snapshot starts as the battle before the turn, and `app.js` moves it forward
// by one event each time it plays one. The engine holds the truth; the snapshot
// holds the picture, which trails behind it until the last event has played.
//
// Everything here is pure. It draws nothing and it touches no clock.

/**
 * A copy of a battle, holding only what the screen reads from it.
 *
 * The battle's random generator is left out on purpose. It is a live object
 * that `structuredClone` cannot copy, and the picture has no use for it.
 *
 * @param {object} battle a battle from `battle.js`
 * @returns {object} a battle-shaped snapshot, safe to copy
 */
export function snapshotBattle(battle) {
  return {
    kind: battle.kind,
    trainer: battle.trainer ? { ...battle.trainer } : null,
    player: sideSnapshot(battle.player),
    foe: sideSnapshot(battle.foe),
    // True while a side's creature lies beaten and no other one has come out.
    // A beaten creature is off the screen, so the snapshot must say so even
    // when it is built fresh, and not only when a `faint` event plays.
    fainted: {
      player: isDown(battle.player),
      foe: isDown(battle.foe),
    },
  };
}

function sideSnapshot(side) {
  return { party: structuredClone(side.party), active: side.active };
}

function isDown(side) {
  const monster = side.party[side.active];
  return Boolean(monster) && monster.hp <= 0;
}

/**
 * Move the picture forward by one event.
 *
 * Every event that changes the picture carries the value it lands on, so the
 * snapshot never has to redo the engine's arithmetic. An event this function
 * does not know changes nothing, which is what lets `battle.js` add one.
 *
 * @param {object} shown a snapshot from `snapshotBattle`
 * @param {object} event one event from `takeTurn`
 * @returns {object} a new snapshot; the one you passed in is left alone
 */
export function applyBattleEvent(shown, event) {
  const next = structuredClone(shown);
  const side = event.side;
  const monster = side ? next[side].party[next[side].active] : null;

  switch (event.type) {
    case "damage":
    case "heal":
      if (monster) monster.hp = event.hp;
      break;
    case "status":
      if (monster) monster.status = event.status;
      break;
    case "statusEnd":
      if (monster) {
        monster.status = null;
        monster.sleepTurns = 0;
      }
      break;
    case "faint":
      if (monster) monster.hp = 0;
      if (side) next.fainted[side] = true;
      break;
    case "sendOut":
      next[side].active = event.partyIndex;
      next.fainted[side] = false;
      break;
    case "exp":
      applyToPartyMember(next, event.partyIndex, (one) => {
        one.exp = event.exp ?? one.exp + event.amount;
      });
      break;
    case "levelUp":
      applyToPartyMember(next, event.partyIndex, (one) => {
        one.level = event.level;
        if (event.hp !== undefined) one.hp = event.hp;
      });
      break;
    default:
      break;
  }
  return next;
}

/** Experience and levels only ever land on the player's team. */
function applyToPartyMember(shown, index, change) {
  const monster = shown.player.party[index];
  if (monster) change(monster);
}

/** How far one health bar slides toward its target in a single frame. */
export const BAR_FRAMES = 8;

/**
 * One frame of a bar sliding toward the number it should show.
 *
 * It always moves at least one step, so a bar can never stop just short of
 * where it belongs and hold the whole battle up.
 */
export function easeToward(current, target) {
  const gap = target - current;
  if (gap === 0) return current;
  const step = Math.max(1, Math.ceil(Math.abs(gap) / BAR_FRAMES));
  return current + Math.sign(gap) * Math.min(Math.abs(gap), step);
}
