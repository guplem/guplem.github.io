# ADR 0009: Filters widen within one kind and narrow across kinds

## Context

One list holding issues and pull requests, from every repository a person can
reach, across their own account and their organisations, is long. Sorting
reorders it; it never shortens it. Three questions come up often enough to be
worth a control: *only issues*, *only this repository*, *only the things tagged
this way*.

Two decisions have to be made before any of it can be built, and both are easy
to get wrong in a way nobody notices until the board is empty.

**What does choosing two labels mean?** Read strictly, `bug` and `urgent`
together means the items carrying both, which is usually none. Somebody who
clicks a second label almost always means "and also show me these".

**Where do the chosen filters live?** Nowhere would throw them away on reload.
`localStorage` would keep them per device and hide them from a link.

## Decision

**Within one kind of filter, the chosen values widen. Across the kinds, each one
narrows.**

- Two labels means *either*. Two repositories means *either*.
- A kind and a repository chosen together means *both must hold*.

That is what a person means by clicking, and it is the only combination in which
adding a second chip inside a group can never shrink the list.

**Only offer a filter the list can actually use.** The repository chips are built
from the repositories the items are actually in, the label chips from the labels
they actually carry. A filter that can only ever empty the board is noise, so the
repository group stays hidden until there are at least two, and the label group
until there is at least one.

**The chosen filters live in the address bar**, beside the view and the sort
order (root ADR 0006), as one parameter per item: `?kind=issue&repo=me%2Fa&label=bug`.
A comma-separated value would break on the first label containing a comma. The
kind ids are permanent, like the sort ids and the view names, and
`invariants.test.js` pins them together with the fact that `issue` and
`pull-request` are also what a work item calls its own kind.

**An empty list says which of the two empties it is.** Nothing assigned at all is
a token problem (ADR 0007) and the way out is Settings. Nothing matching the
filters is a filter problem and the way out is a "Clear the filters" button. The
board shows one or the other, never both.

## Consequences

**A filtered board is shareable and survives a reload.** "Everything tagged
`urgent` in this repository" is a link, which is the main thing `localStorage`
could not have given.

**Chips take room at the top of the board**, more with more repositories. A
person in twenty repositories gets twenty chips. That is the next thing to fix
if it becomes a problem, probably by folding the group behind a count, and it is
not worth building before it hurts.

**The label chips list every label in use, not every label defined.** They change
as the work changes, which means a label can vanish from the chips while it is
still chosen in the address bar. That filter stays in force and empties the
board, and the "Clear the filters" button is what makes that recoverable.

**Rejected: labels meaning "all of these".** Correct as logic, wrong as a
gesture: the second click would almost always empty the board. **Rejected: three
state chips (include, exclude, off)** as the main site uses for its work filters
(root ADR 0014). They earn their place there, where the reader is browsing a
fixed set of projects; here the third state is a feature nobody has asked for
yet, and two states is one less thing to explain. **Rejected: a free-text search
box.** It is a different feature with different rules (which fields, whole words
or not), and it belongs beside these, not instead of them.
