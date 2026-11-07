# ADR 0001: The link carries the event and the seed, never the result

## Context

A Secret Santa draw has one organiser and many people who each must learn one name: the person they give a present to. The page has no server, so the draw must reach every phone through the link that the organiser shares.

There are two ways to put a draw in a link. The link can carry the result (who gives to whom). Or the link can carry the inputs (the names, the exclusions and a seed) and let each phone compute the result again.

The owner asked for the second way: every run gets a new seed, the state lives in the URL, and the result comes from all the data plus the seed.

## Decision

The `e` parameter holds the event: the title, the names in list order, the forbidden pairs and the seed, as base64url JSON (`urlState.js`). It never holds the result.

`drawAssignments(names, forbidden, seed)` in `draw.js` computes the result. It seeds a mulberry32 generator with the FNV-1a hash of `canonicalEvent(names, forbidden, seed)`. That text sorts the pairs and removes repeats, so the pair order in the link does not matter. The title is not part of it, so a title edit keeps the draw.

The draw first tries up to 5,000 shuffles of the whole list and keeps the first one that fits the rules. That gives every valid draw the same chance. When the exclusions are so tight that shuffles keep failing, an exact backtracking search takes over. It is a little less even, but it always finds a draw when one exists.

The create screen makes a new seed (`newSeed()`, eight characters from `crypto.getRandomValues`) on every press of "Draw names" and "Draw again".

The page trusts people. Anyone can tap any name. Before it shows anything, a warning names the person twice and asks them to go on only if they are that person. After the confirmation, this device remembers the choice for that draw (`memory.js`), so the person does not pick again. The memory uses the same draw identity as the result, without the title, so it never travels in the link.

## Consequences

**Good**

- The link stays short, and nobody can read the result from it at a glance.
- Every phone gets the same result with no server and no account.
- A change to any name, any exclusion or the seed gives a fresh draw.

**Bad**

- **Never change `drawAssignments`, `canonicalEvent`, `hashString` or `mulberry32` in a way that changes their output.** Every link already shared would then show a different result on a new phone than on an old one. A change to the draw needs a new `v` in the link format, and the old version must keep its old code path.
- The protection is honesty, not secrecy. A curious person can tap other names, or run the draw in a console.
