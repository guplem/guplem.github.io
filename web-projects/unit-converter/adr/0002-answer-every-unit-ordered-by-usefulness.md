# ADR 0002: Answer every unit at once, ordered by usefulness

## Context

A converter that asks for a target unit assumes the person already knows which one they want. Often they do not. Somebody converting a height wants centimetres, but they would also take metres, and they will not know which reads better until they see both. Somebody converting a recipe wants millilitres and tablespoons and teaspoons, and asking for one at a time means running the tool three times.

Converting into every unit of a category costs nothing: a category holds at most about sixty units, and each one is a multiplication. So the only real question is how to show them.

Showing them in the order the catalogue happens to hold them does not work. Ordering by how common a unit is does not work either, and the case that proved it is a height. Type `5'10"` and miles is a common unit, so miles goes near the top, where it reads `0.0011 mi`. Nobody wants that. Meanwhile `70 in` and `177.8 cm`, which are the two answers a person came for, sit below it.

## Decision

Convert into every unit of the category and show them all, ordered by two things added together:

1. `rank`, how common the unit is, from 1 for an everyday unit to 4 for an exotic one. It lives beside each unit in `units.js`.
2. `readabilityPenalty(value)`, how far this particular number sits from the range a person reads at a glance. It is 0 between 0.01 and 100000, 1 further out, and 2 beyond that.

A lower total comes first. The eight best show immediately and the rest sit behind one control, so the answer is on screen with no scrolling and nothing is hidden from anyone who wants it.

A target is still available, and typing one (`100 km to mi`) promotes that unit to its own larger card above the list. It changes what is emphasised, never what is offered.

## Consequences

**Good**

- Most conversions need no target at all, which is what removes the third control that ADR 0001 set out to remove.
- `5'10"` puts centimetres and inches in the first four. `100 km` puts miles first and millimetres well down. Both cases are pinned in `convert.test.js`.
- The rule is short enough to explain in one sentence, so the order is predictable rather than magical.

**Bad, and what we do about it**

- The order now depends on the value, so the same unit can move as a person types. That is the point, but it means the list is not a fixed reference. The target card exists partly for this: a unit a person explicitly asked for never moves.
- Two thresholds (`0.01` and `100000`) are judgement calls, not facts. They are named constants in one function with the reasoning beside them, and `convert.test.js` covers all three bands, so changing them is a deliberate act with a visible blast radius.
- A category with sixty units, which currency is, produces a long list behind the "show more" control. That is acceptable: the eight most useful are already on screen.
