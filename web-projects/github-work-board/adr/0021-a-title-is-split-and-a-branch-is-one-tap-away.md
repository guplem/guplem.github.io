# ADR 0021: A title is split from the change it announces, and a branch is one tap away

## Context

Two complaints about the same thing: a card shows what GitHub stores, and what
GitHub stores is not what a person reads.

**A title carries a prefix nobody reads twice.** Almost every title here is
written the way conventional commits asks for it, `fix(api): the board forgets
the note on reload`. On a board of forty cards the first half is the same nine
words over and over, in the widest, boldest text on the card, pushing the only
part worth reading onto a second line.

**A branch name was nowhere.** Checking a pull request out means typing its
branch, and the card knows it: `headRefName` arrives with everything else and
nothing showed it. Worse for a pull request nested inside its issue, which had
no menu at all, on the reasoning that its only row would have done nothing
(ADR 0012).

## Decision

**The prefix becomes an icon and a small word, and the title line is the
description.** `titles.js` reads `type(scope)!: description` and the card draws
the type as an icon, the scope muted with a separator, and the description at
full weight. The whole original title stays as the link's hover text, so
nothing is lost.

- **A word the board does not know is left in the title, word for word.** The
  point is to take noise off the card, and a word that is not a type is not
  noise, it is the title: "Note: the rate limit is 5000 an hour" keeps every
  word it has. `readTitle` returns `type: null` and the whole string.
- **A colon in the middle of a sentence is punctuation.** The prefix is one
  word, so "Make it clear: the token never leaves the browser" is left alone.
- **Issues are not written by commit rules.** "Bug:" and "Feature:" are what
  people actually type and mean the same thing, so each type carries the
  spellings it answers to.
- **`!` is drawn, not written.** A breaking change turns the icon the
  destructive colour and thickens it. It is the one thing on a title that has
  to interrupt somebody.
- **The icons are paths in `titles.js`**, drawn on the same 24 by 24 box as
  every other icon here, because this project loads no third-party code at all
  (ADR 0001). Keeping them beside the type list keeps a type in one place.

**Copy branch name is a row in the card menu**, and it is the row a nested
pull request gets. The menu now shows only the rows that mean something for the
card that opened it: an issue has no branch, and a nested pull request cannot
be moved, because its column comes from the issue it travels in (ADR 0012).
That reasoning was never "a nested card gets no menu", it was "a move would do
nothing", and it still holds.

## Consequences

**A card is one line shorter in the common case**, which is the point: more
work fits in a column, and the description starts where the eye already is.

**A scope is now the only place a reader sees the word `api`.** That is fine
while the icon carries the type, and it is why the scope keeps its own muted
style rather than disappearing.

**The type colours are a second vocabulary to keep.** Green for a feature, red
for a fix, blue for docs, purple for a refactor. They live beside the badge
colours in `style.css` and have to stay distinguishable in both schemes.

**A copy has nowhere to report itself but the board's status line.** The menu
closes on the press, so the status line says `Copied fix-branch.`, and on a
browser that refuses the clipboard it says the branch instead, where it can at
least be selected.

**Rejected: muting the description instead of the prefix.** The description is
the content. The prefix is what repeats.
**Rejected: guessing a type from a title with no colon.** "Fix the thing" is a
fix and "Fixture loading is slow" is not, and nothing in the string tells them
apart. A colon is an explicit mark and the board only reads explicit marks,
the same rule that keeps relationships out of descriptions (ADR 0010).
**Rejected: a full menu on a nested pull request.** Its move would write a
column to the document and change nothing on screen, which is exactly what
ADR 0012 decided.
