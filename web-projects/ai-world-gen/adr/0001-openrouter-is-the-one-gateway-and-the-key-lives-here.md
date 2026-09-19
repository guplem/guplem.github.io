# ADR 0001: OpenRouter is the one gateway, and the key lives in this browser

## Context

This page needs two different kinds of model: a language model to write a
world's vocabulary, and TypeSafe's Jev to make one typed decision per cell.
Each vendor has its own API, its own authentication and its own view on
whether a browser may call it at all (CORS, the browser rule that decides
which pages may call which servers). Integrating three or four of them from a
static page is three or four integrations, three or four keys, and at least
one that refuses browsers.

Root ADR 0002 says this site has no server. So nothing here can hold a secret,
proxy a call, or add a header the browser cannot send.

The plan named one unverified assumption that had to be tested before anything
was built on it: whether OpenRouter allows direct browser calls. Community
reports were mixed.

## Decision

**Every AI request goes to `openrouter.ai`, and nowhere else.** The app never
calls OpenAI, Anthropic, Google or TypeSafe directly. OpenRouter serves all of
them behind one key and one OpenAI-shaped API, and it serves Jev too
(`~typesafe/jev-latest`, beta since 2026-09-18) on its `alpha/decisions`
endpoint.

**The assumption was tested first.** On 2026-09-19 a preflight (`OPTIONS`) with
an `Origin` header against `/api/v1/chat/completions`, `/api/v1/models`,
`/api/v1/auth/key` and `/api/alpha/decisions` all answered
`Access-Control-Allow-Origin: *` with `Authorization` in the allowed headers.
The **Test connection** button runs the same check live, from the reader's
browser, before anything else is asked of the key. Should CORS ever close, the
fallback named in the plan still stands: one minimal serverless proxy that
mirrors `openRouterClient.js`'s interface, so nothing else changes.

**The reader brings their own key, and it lives in this browser.** The same
four rules as `github-work-board` ADR 0001, because the situation is the same:

1. **One file stores it.** `settings.js` is the only module that names
   `localStorage` and the only one that knows the storage key.
2. **One file sends it.** `openRouterClient.js` is the only module that calls
   `fetch`, and it calls one host.
3. **The key never reaches the address bar.** The setup travels in the link
   (root ADR 0006); the key does not, and `invariants.test.js` fails on any
   module that writes it into a search string.
4. **The page says so** next to the paste box, and offers "Forget the key" as a
   button, not a settings page.

"Remember this key in this browser" is on by default and can be turned off, in
which case the key lives in memory until the tab closes.

## Consequences

**A script on this origin can read the key.** Every web-project on
`triunitystudios.com` shares one origin and one `localStorage`. An OpenRouter
key is a billing credential, so the page asks the reader to set a credit limit
on it, and the project loads no third-party script (root ADR 0005 allows a
pinned CDN import; this project does not take it, and the invariants test
fails on one).

**One dependency on one company.** If OpenRouter is down, the page is down.
The trade is one integration instead of four, and it is the right trade for a
static page with no server.

**Jev is in beta.** `models.js` tells a decisions model from a text model, and
`generation.createDecider` can route the same per-cell question to a text model
through `chat/completions` when Jev does not answer. Slower and dearer, but a
live demo survives.

**Rejected: call each vendor directly.** Four integrations, two of which do
not allow browsers, and four keys to explain. **Rejected: a proxy from day
one.** It ends the no-server design for a risk that turned out not to exist.
