# 5. The early game copies Pokemon Emerald, number for number

## Context

A player reported that the game was too hard to start. Two things went wrong for
them. Poison in the first fight made that fight impossible to win. The first
trainer on the road held creatures at a higher level than their own.

A simulation of the real battle engine confirmed both reports, and found the
problem was worse than the report said. The grass starter won **0 percent** of
2000 runs against the first trainer. It won 0 percent against every trainer on
the first route up to level 9. The fire and water starters won 84 to 88 percent
of the same first fight, so the game was only broken for one choice in three.

Four separate faults produced that number:

1. **The first grass held creatures at or above the player's level.** Route 1
   ran to level 6 against a level 5 starter, and two of the seven friend
   creatures stood in it. Those two carry 390 and 432 base stat points against a
   starter's 298.
2. **Two 60 power moves arrived at level 5.** Sumsu learned Wing Beat and Gori
   learned Bite. Wing Beat is of the sky, the sky is twice as strong against
   grass, and a matching element adds half again. One level 5 Sumsu therefore
   hit the grass starter for 180 effective power and won in one turn.
3. **Kanku knew Venom Sting from level 1.** Poison is twice as strong against
   grass. The first wild Kanku beat the grass starter in two hits, and poisoned
   it three times in ten on top of that.
4. **A script poisoned the whole party and then started a battle.** Mama Sopa's
   soup ran `poisonParty` and `battle` in the same script, so the player never
   reached the bag. No medicine that clears poison existed anywhere in the game
   at that point, because the first shop is four maps further on.

The game is built in the shape of a Game Boy Advance title, so the obvious place
to look for the right numbers was the one that does this best. Emerald opens
about as gently as the genre ever has.

## Decision

**Copy Emerald's opening numbers, and hold them with tests.**

These are the measured Emerald values the rules come from. A level 5 starter is
the fixed point in every row.

| Emerald | Value |
|---|---|
| Route 101, the first grass | Lv 2-3, two to three below the starter |
| Route 102, the second grass | Lv 3-4, overlapping Route 101 |
| Youngster Calvin, the first trainer | one Poochyena at Lv 5 |
| Bug Catcher Rick, the next trainer | two Wurmple at Lv 4 |
| Rustboro gym trainers | Lv 8 to Lv 10 |
| Roxanne, the first gym leader | Geodude Lv 12, Nosepass Lv 15 |
| Zigzagoon, the strongest first route common | 240 base stat points against a 310 starter |
| Poochyena's Bite, 60 power | learned at Lv 13 |
| Taillow's Wing Attack, 60 power | learned at Lv 13 |
| Wurmple's Poison Sting | learned at Lv 5, one level above the Route 101 cap |
| Treecko, Torchic and Mudkip | 310 base stat points each, exactly equal |

The last three rows carry most of the weight.

Emerald puts a poison move on a first route creature and then puts that move one
level out of reach. The opening hours therefore hold no lasting condition at
all. Emerald also holds both of its 60 power early moves back to level 13, so
nothing out-hits the starter's own 40 power move until the player has a team.
And Emerald gives all three starters the same number of base stat points, so no
choice starts behind.

`areas/balance.test.js` holds one rule per row. Every rule names the Emerald
number it came from.

## Consequences

**The reported fight works now.** Measured over 2000 simulated runs of the real
engine, the grass starter goes from 0 percent to 100 percent against the first
trainer, and to 97 percent when the soup poisons it first. The first grass goes
from 76 percent to 94 percent. All three starters now win every fight on the
first route.

**Poison still exists, and it still tells the joke.** Mama Sopa's soup poisons
the party after the battle rather than before it, and she hands over three
Bitter Leaf at the same time. The player meets poison, learns what the cure is,
and holds the cure. That mirrors Emerald, which sells Antidotes one route before
the first thing that can poison you.

**Three creatures moved down the road.** Polete, Hinoko and Poya left the first
route. Polete and Hinoko live on the river. Poya lives in the mine. All seven
friend creatures are still catchable in the area, which `areas.test.js` checks.

**Every grass move is special now.** Vine Whip and Razor Leaf were physical
while Absorb and Seed Bomb were special. That split left Baobo, a creature built
around 55 special attack, fighting with its 48 attack. Generation 3, whose
damage formula this engine already follows, makes every grass move special.
The whole grass line now agrees.

**Kanku is a common creature by its numbers as well as its role.** Its catch
rate of 150 and its experience yield of 58 always said "common roadside
creature". Its 303 base stat points said otherwise, and put it between the
starters. It now totals 272, next to Gori at 278 and Sumsu at 251.

**The gym leader has the last word again.** Nana Sika's ace sat at level 16,
level with Nana Kofi's. It now sits at 14. `areas.test.js` used to exempt Nana
Sika from the rule that nobody outranks the gym leader. The exemption is gone.

**A save written before this change still loads.** No identifier changed. Base
stats and learnsets are not written into a save file, and `sanitiseMonster` in
`save.js` clamps stored health to the new maximum. A creature caught before this
change keeps the four moves it was caught with.

**Balance is now a thing tests can fail on.** Before this, `areas.test.js`
checked that the world joined up and that levels climbed. Nothing checked that
the world could be beaten. A future area that puts a strong rare creature on its
first route will fail `areas/balance.test.js` and say why.
