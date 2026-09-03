// The board both rule sets share.
//
// Every mancala variant here sows seeds counterclockwise around a ring of
// twelve pits. The ring is one flat array, index 0 to 11, and index 0 is the
// first pit South sows into:
//
//        North's row        11  10  9  8  7  6
//        South's row         0   1  2  3  4  5
//
// So sowing always means "index + 1, wrapping at 12". The two big stores that
// Kalah needs are NOT in this array; they live in `state.scores`, because
// Ba-awa has no stores and both engines then share one board shape.
//
// This file holds only geometry and counting. It knows no rules.

/** How many pits the sowing ring has. */
export const PIT_COUNT = 12;

/** How many pits one player has in their own row. */
export const ROW = 6;

/** The player whose row is pits 0 to 5. */
export const SOUTH = 0;

/** The player whose row is pits 6 to 11. */
export const NORTH = 1;

/**
 * The other player.
 * @param {number} player SOUTH or NORTH
 * @returns {number} the opponent
 */
export function other(player) {
  return player === SOUTH ? NORTH : SOUTH;
}

/**
 * The first pit of a player's own row in sowing order.
 * @param {number} player SOUTH or NORTH
 * @returns {number} pit index
 */
export function homeStart(player) {
  return player === SOUTH ? 0 : ROW;
}

/**
 * The six pits of a player's own row, in sowing order.
 * @param {number} player SOUTH or NORTH
 * @returns {number[]} pit indices
 */
export function homePits(player) {
  const start = homeStart(player);
  return Array.from({ length: ROW }, (_, step) => start + step);
}

/**
 * The pit that sits across the board from the given pit. Pit 0 faces pit 11,
 * pit 1 faces pit 10, and so on. Kalah's capture needs this; Ba-awa does not.
 * @param {number} pit pit index
 * @returns {number} the facing pit index
 */
export function oppositePit(pit) {
  return PIT_COUNT - 1 - pit;
}

/**
 * A fresh ring with the same number of seeds in every pit.
 * @param {number} seedsPerPit seeds to put in each pit
 * @returns {number[]} the ring
 */
export function initialPits(seedsPerPit) {
  return new Array(PIT_COUNT).fill(seedsPerPit);
}

/**
 * Add up the seeds in some pits.
 * @param {number[]} pits the ring
 * @param {number[]} indices pits to count
 * @returns {number} total seeds
 */
export function seedsIn(pits, indices) {
  let total = 0;
  for (const index of indices) total += pits[index];
  return total;
}

/**
 * Add up every seed still on the board.
 * @param {number[]} pits the ring
 * @returns {number} total seeds
 */
export function totalOnBoard(pits) {
  return seedsIn(
    pits,
    pits.map((_, index) => index)
  );
}

/**
 * Who owns each pit when nobody has conquered anything: each player owns their
 * own row. Kalah always uses this, and it is also Ba-awa's first round.
 * @returns {number[]} owner per pit index
 */
export function fixedOwners() {
  return Array.from({ length: PIT_COUNT }, (_, pit) => (pit < ROW ? SOUTH : NORTH));
}

/**
 * Who owns each pit when the two players hold a given number of pits each.
 * Ba-awa needs this between rounds, where the winner takes pits from the loser.
 *
 * A player who holds six pits or more keeps their own row and then extends
 * forward in sowing order into the opponent's row. So South's seventh pit is
 * pit 6, the first pit of North's row that South sows into. The player who is
 * left with fewer than six keeps the tail of their own row, which is the part
 * the winner has not reached yet.
 *
 * @param {number} southPits pits South holds
 * @param {number} northPits pits North holds
 * @returns {number[]} owner per pit index
 * @throws {Error} when the two counts do not add up to the whole ring
 */
export function ownersFromPitCounts(southPits, northPits) {
  if (southPits < 0 || northPits < 0 || southPits + northPits !== PIT_COUNT) {
    throw new Error(`pit counts ${southPits} and ${northPits} do not tile ${PIT_COUNT} pits`);
  }
  const owners = new Array(PIT_COUNT).fill(-1);
  for (const player of [SOUTH, NORTH]) {
    const count = player === SOUTH ? southPits : northPits;
    // A short row keeps its tail, so it starts later than the row's own start.
    const from = homeStart(player) + (count >= ROW ? 0 : ROW - count);
    for (let step = 0; step < count; step += 1) {
      const pit = (from + step) % PIT_COUNT;
      if (owners[pit] !== -1) throw new Error(`pit ${pit} claimed twice`);
      owners[pit] = player;
    }
  }
  if (owners.includes(-1)) throw new Error("pit counts leave a pit unowned");
  return owners;
}
