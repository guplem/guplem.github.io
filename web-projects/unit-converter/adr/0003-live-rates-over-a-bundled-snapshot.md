# ADR 0003: Live exchange rates over a bundled snapshot, and always say which

## Context

Sixteen of the seventeen categories in this converter are fixed by a standard. An inch has been exactly 0.0254 metres since 1959 and will be tomorrow. A euro is not like that: its factor changed this morning and will change again.

That leaves three problems the other categories do not have.

1. The page needs a number before the network answers, and it may never answer. This site's rule is that a page never goes blank, and a currency row with no number is a blank page in miniature.
2. Whatever number is shown, the reader has to be able to tell whether it is today's or not. A stale rate that looks live is worse than no rate, because a person will act on it.
3. A free rate service can be down, and the two we can use do not carry the same currencies. Frankfurter serves the European Central Bank's daily table, which is about thirty currencies. ExchangeRate-API's open endpoint carries about a hundred and sixty.

## Decision

Every currency carries a dated snapshot factor in `units.js`, read on the day the file was written and marked with `SNAPSHOT_DATE`. The page therefore answers with no network at all.

At start-up the page asks for live rates, in this order:

1. A cached table in the browser less than twelve hours old is used as it is, so most visits ask for nothing.
2. Otherwise `dataSource.js` tries ExchangeRate-API first, for the wider list of currencies, then Frankfurter, which is a different operator so one being down does not take the page with it.
3. If neither answers and there is an older cached table, that is used: real rates from last week beat a snapshot from the last deploy.
4. If there is nothing at all, the bundled snapshot stands.

The rates replace the snapshot factor per currency, not all at once. A service that covers thirty currencies upgrades those thirty and leaves the rest on the snapshot, rather than downgrading the page to thirty currencies.

The note under the answers always names what is in use: the date the live rates are from and which service sent them, or the date of the bundled copy and the fact that live rates could not be reached.

`rates.js` is pure and holds everything that can go wrong with a rate table: an unreadable answer, a currency this page does not carry, a rate that is zero or a string, and the inversion. A service answers "how many dollars one euro buys" (1.16); the conversion engine wants "what one dollar is worth in euros" (0.86). Getting that backwards gives prices that look plausible and are wrong, so `rates.test.js` pins it from both directions and for a table quoted in something other than euros.

## Consequences

**Good**

- The page converts currencies offline, on a first load, and when both services are down.
- No reader can mistake a snapshot for today's rate, because the page says so in the same block as the numbers.
- One bad rate in an answer drops that one currency to its snapshot instead of breaking the table.

**Bad, and what we do about it**

- The snapshot goes out of date the day after it is written, and nothing updates it automatically. It is a fallback of last resort and is labelled with its date wherever it is used, so an old one is visible rather than silent. Refreshing it is a data edit like any other.
- This is the only part of the page that touches the network, which weakens the "everything happens in your browser" claim. The footer says exactly that and no more: the only request is the rate table.
- Two services mean two response shapes to read. Both are handled in one pure function with a test for each shape, rather than in the file that does the fetching.
