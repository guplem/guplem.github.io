# ADR 0005: A fixed set of ten categories, and the portal's own words when it is none of them

## Status

Accepted

## Context

Every story on the Current Events portal sits under a category heading, such as
"Law and crime". A folded row in the reading list showed where the story happened
and a summary of its words, but not what kind of story it was. A reader had to
open the row to learn that, which is a poor trade: the category is one of the two
things a reader sorts news by, and it is one short word.

To show it on a folded row, the page needs a short name and an icon for each
category. That needs an answer to a question the code had never asked: **is the
set of categories fixed, or does each day invent its own?**

A survey answered it. 710 real portal days from 2014 to 2026 were fetched and
every heading counted:

| Heading | Days | Story lines |
|---|---|---|
| Armed conflicts and attacks | 88% | 6134 |
| Disasters and accidents | 84% | 2251 |
| Politics and elections | 83% | 2857 |
| Law and crime | 71% | 1670 |
| Sports | 53% | 1389 |
| International relations | 49% | 1140 |
| Health and environment | 33% | 2186 |
| Arts and culture | 27% | 408 |
| Business and economy | 26% | 475 |
| Science and technology | 17% | 214 |

Those ten head more than 99% of every story. The survey also found 27 other
headings. Some are names the portal has retired ("Sport", "Health", "Business and
economics", "Science", "Health and medicine"), and the rest are plain typos
("Sience and technology", "Businesses and economy", "Law and Crime", "Politics and
election"). About one new typo appears each year.

So the set is a **convention that editors follow, and nothing enforces it.** A
design that trusts the ten and nothing else prints a broken row roughly once a
year. A design that trusts nothing shows no icon at all and wastes the fact that
ten headings do all the work.

## Decision

**Carry the ten as a fixed set, read a heading onto one of them, and print the
portal's own words when the reading fails.**

`categories.js` holds the ten keys, an icon for each, and the words that name
each one. `classifyCategory` reads a heading in two steps:

1. The exact heading the portal writes today, matched whole.
2. Otherwise, the words the heading is made of. A word must match **exactly**: a
   word that merely starts the same is a different word, so "Lawn care" is not law.
   A heading that names two categories, or none, answers null.

Null is a normal answer and not a failure. The page then shows the heading the
editor wrote, with no icon. That is true of any heading, including one invented
tomorrow.

Each category is named twice, in each language the page speaks: a short name for
a folded row ("Conflict") and the full name for an open one ("Armed conflicts and
attacks"). The heading itself is always English, because the portal is on English
Wikipedia, so naming the ten is also what lets a Spanish reader read them.

The icons are path data in the same module, drawn as strokes. The project ships
no image files (root ADR 0002 and the same rule across `web-projects/`), and an
icon that takes the colour of the text around it works in both themes with no
second copy.

## Consequences

**A folded row now says what kind of story it is.** The chip carries an icon and a
short name on the row's first line, beside the place. Opening the row widens it to
the full name, so the short name never has to be a perfect summary.

**A new heading degrades quietly.** The reader sees the portal's own words. Nothing
breaks, and nothing has to be shipped the day an editor invents a category.

**A retired name still works.** "Sport" and "Business and economics" read onto the
same categories as their current names, so a day from 2015 looks like a day from
2026.

**The word lists are a maintenance surface.** They are the one place a wrong
reading can come from. `categories.test.js` pins all ten current headings and
every one of the 25 real variants the survey found, so a change to the lists that
breaks a real day fails the suite.

**A wrong icon is worse than no icon, so the code never guesses.** A heading that
names two categories answers null rather than picking the first.

**The parser had to be fixed first.** Every portal day before about 2019 writes its
heading as `;Law and crime`, which the wiki renders as a div and not as bold, and
`stories.js` read only bold. Those days carried no category at all. The bug was
invisible while the category was only shown inside an opened row on a recent day;
it would have been plain the moment the chip went on every row. `stories.js` now
reads both forms.
