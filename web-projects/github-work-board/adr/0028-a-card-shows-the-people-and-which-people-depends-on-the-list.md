# ADR 0028: A card shows the people, and which people depends on the list

## Context

The board said what the work was and never who it was with. Two questions went
unanswered, and they are not the same question.

**On a pull request waiting for the reader's review:** whose work is this? The
reader is being asked to read somebody's change, and the card did not say whose,
so there was no way to sort "three from the same person" from "three from three
people", and nobody to go and ask about it.

**On the reader's own pull request:** who is this waiting on? A pull request
sits in "Awaiting review" for days and the card never said who to chase. Worse,
one sitting in "Needs attention" never said who had asked for the changes, so the
reader had to open it to find out whose comments to answer.

## Decision

**A card shows the people it is about, as small round faces, and which people
depends on which list the card is in.**

- **A review card shows the pull request's assignees.** Whose work this is.
- **The reader's own card shows everybody in the review**, each face carrying
  what the board is waiting on them for: they asked for changes, they were asked
  and have not answered, or they approved.

**The second list is not "the pending review requests", and that distinction is
the whole feature.** GitHub drops somebody from `reviewRequests` the moment they
submit a review. A pull request held up by one reviewer who asked for changes
therefore has **no pending request at all**. A probe of the repository this board
was built for found exactly that: pull request #2473, zero review requests, one
`CHANGES_REQUESTED` review. Drawing only pending requests would leave that card
blank, and it is the card that most needs a face on it. So the two lists are read
together, in `people.js`.

**Somebody asked to look again counts as asked, not as blocking.** They gave a
verdict and were then asked a second time, so the board is waiting on them. This
is the same reading that puts the pull request in "Awaiting review" rather than
"Needs attention" (ADR 0011), and the two must not disagree.

**The faces read in the order the reader acts on them:** who blocks them, then
who they can chase, then what is already done.

**A face is a button, and tapping it narrows the list to that person.** So there
are two filters, one for each list and each with its own name in the address bar
(ADR 0009):

| Filter | Narrows | In the link |
|---|---|---|
| Assignee | the row of pull requests waiting on the reader | `assignee=` |
| Reviewer | the reader's own board | `reviewer=` |

They are separate because they answer separate questions about separate lists.
A reader can hold both at once, and one link carries both. `invariants.test.js`
pins both names and says which list each one narrows, because
`?assignee=octocat&reviewer=octocat` is otherwise a guess.

**Both follow the rule every filter here follows** (ADR 0009): within one filter
the chosen people widen, so two people means either of them; across the filters
each one narrows its own list. Each group of chips appears only when its list
holds at least two people, the same threshold the repository chips use.

**The picture is never the only thing a face carries.** Every face holds the
person's initials underneath, so a picture that fails to arrive still says who
it is, and the name is on the face for a pointer and for a screen reader. The
review state is a coloured ring **and** words in the same label, because colour
alone is not an answer for everybody.

## Consequences

- **The page now loads images from `avatars.githubusercontent.com`.** It is the
  first time this project fetches anything outside `api.github.com`. Nothing
  leaves the browser that GitHub does not already know, and the reader is signed
  in to GitHub by definition. A blocked or failed image costs nothing, because
  the initials are already drawn. The address goes straight into `img.src`, so
  `readPerson` keeps it only when it starts with `https://` and drops anything
  else (ADR 0001).
- **The relationship query carries two more fields**, not one more call
  (ADR 0010). The reviewers were already being fetched to decide the column; only
  their names and pictures are new. A live probe confirmed the widened query
  needs no permission the board does not already ask for, so
  `REQUIRED_PERMISSIONS` is unchanged (ADR 0005).
- **The review row has a filter for the first time.** It had none, because every
  filter until now belonged to the board. ADR 0009 is updated in place to say so.
- **A face is one more thing on an already busy card.** It sits on its own row
  under the title, and a card with nobody on it draws nothing, so a board with no
  reviewers anywhere looks exactly as it did.
