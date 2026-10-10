# ADR 0047: Issue fields come free with each issue, and the reader chooses what a card shows

## Context

GitHub lets an organisation define **issue fields**: an effort, a priority, a
start date, a target date, or any text, number, date or option it needs. The
reader wanted to see the fields that are set on each card, to filter by them,
and perhaps to sort or filter a number field by a range.

The reader also wanted to choose which information a card carries: the
fields, the milestone, the labels, and the rest.

Four questions decide the design:

- **Which fields?** GitHub has two kinds. Issue fields belong to the
  organisation and sit on the issue. Project fields belong to a project
  (GitHub Projects) and sit on the project item, for issues and pull requests.
- **What does it cost?** One refresh already costs five calls for each token,
  and the GraphQL query is measured (ADR 0010, ADR 0025).
- **What can a filter offer?** A field can hold a number, an option, a date or
  a free text.
- **Where does the reader's choice live?**

## Decision

**The board reads issue fields, and reads them from the answer that it already
has.** `GET /issues` sends the values inside each issue, as
`issue_field_values`, with the field's name, its kind and its value. The
`Issues: read` permission that the board already asks for covers them.
`fields.readFieldValues` reads them, and `normalizeWorkItem` puts them on the
item. The feature adds no call, no GraphQL field and no permission.

**Project fields are rejected.** They need the organisation permission
"Projects: read", which every reader would have to add. A fine-grained token
cannot read a project that a user account owns at all. They also cost a
nested GraphQL connection on every refresh. Issue fields answer the reader's
case (the effort on an issue) for free.

**A pull request has no issue fields.** GitHub does not put them on a pull
request, so its list is empty.

**A field is a pill under the labels: the name quiet, the value bold.**
"Effort 3" reads at a glance. An option carries GitHub's colour as a dot. A
date reads as "1 Oct 2026", read from the text and never through `Date`, so a
time zone cannot move the day.

**Numbers and options are filter chips. Dates and free text are not.** A
number or an option has a handful of values, so one chip per value is a short
row. A date or a text has one value per card, and a chip that matches one card
filters nothing. The filters draw one row per field, built from what the list
holds. A field pill on a board card presses the same chip, like the
milestone's name (ADR 0045). On a review card the pill is text, because the
board's filters never narrow the review row (ADR 0009).

**Each field is its own kind of filter** (ADR 0009). Two values of one field
widen ("Effort 3 or 5"). Two fields narrow ("Effort 3 and Priority P1"). A
chosen value travels in the link as `field=Effort: 3`, one parameter each, so
its shape is permanent, like a label name.

**No range filter and no sort by a field, for now.** A range needs two inputs
per number field and a new link shape. A sort by a field needs a sort id per
field name, and sort ids are permanent (ADR 0006). Both are real work for a
case that the chips mostly answer: an effort has few values. They can come
later on top of the same `fields` list.

**The reader chooses which parts of a card are drawn.** Settings has a list
"What each card shows", with one switch per part: labels, milestone, fields,
people, parent and blockers, and sub-issues. The title, the kind, the pills
that say what wants doing, and the note always stay, because they are the
card.

**The choice is stored in `board.json`, in a new record map, `cardParts`**,
so it follows the reader to every machine, like the colours (ADR 0024). Every
part is shown until the reader hides it, so a board that never visits Settings
looks as it did. It is its own map and not keys in `visibility`: a part of a
card and a part of the board are two different things, and one must never hide
the other by sharing an id. A part id is written into the file, so it is
permanent; `cardParts.test.js` pins the set.

**Hiding a part hides it on the card only.** The filters stay. A reader who
hides the labels on every card can still narrow the board by a label.

## Consequences

**The fields are as fresh as the last read**, on the schedule of ADR 0025.

**A field that only organisation members can see** reaches a token that only
when its owner is a member. That is GitHub's rule, and the board shows what
GitHub sends.

**A field name with ": " in it** splits wrong in a chosen key, because the key
is read up to the first ": ". Its chips then match nothing, and "Clear the
filters" is the way out. No real field name was seen with one.

**A field renamed on GitHub** leaves an old link filtered on a name no item
carries, exactly like a renamed milestone (ADR 0045).

**Rejected: a GraphQL read of `issueFieldValues`.** It answers the same thing,
and it would make every refresh dearer for nothing.
