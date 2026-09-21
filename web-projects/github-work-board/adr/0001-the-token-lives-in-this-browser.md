# ADR 0001: The token lives in this browser, and the page says so

## Context

This page reads and writes private GitHub data, so every call needs proof of who
is asking. GitHub offers two ways to get that proof, and only one of them works
here.

The usual way is a "Sign in with GitHub" button (OAuth). Its last step trades a
code for a token using a **client secret**, which is a password the application
must keep. A page served from GitHub Pages keeps nothing: every byte is public.
GitHub's other flow (device flow) needs no secret, but its login endpoints send
no CORS headers, and CORS is the browser rule that decides which pages may call
which servers. The browser blocks the call. Both roads therefore need a small
server, and root ADR 0002 says this site has none.

That leaves a **personal access token**: the reader makes it themselves in
GitHub's settings and pastes it into the page. The open question is not whether
to use one. It is where the pasted token then lives.

`web-projects/github-stats-dashboard` already chose one answer: keep it in a
JavaScript variable, so it disappears on reload. That is right for a dashboard
somebody opens twice a year. This board is meant to be open every working day,
and a tool that asks for a credential every morning is a tool nobody keeps using.

## Decision

**The token is saved in `localStorage`, and the page is honest about what that
costs.**

Four rules hold the decision up:

1. **One file stores it.** `settings.js` is the only module that names
   `localStorage`, and the only one that knows the key. `invariants.test.js`
   fails when a second file learns either.
2. **One file sends it.** `gateway.js` is the only module that calls the
   network, and it sends the token to `api.github.com` and nowhere else. The
   same test pins the host list.
3. **The token never reaches the address bar.** Root ADR 0006 already forbids
   sensitive values in URL state; here a test enforces it, because a URL is
   copied into chat messages and written to server logs.
4. **The page tells the reader the truth** next to the input box: the token
   stays in this browser, anything else with access to this browser can read it,
   so scope it narrowly and give it an expiry date.

The setup guide asks for a **fine-grained** token, not a classic one. A classic
token with the `repo` scope can read and write every repository the account
owns. A fine-grained token is limited to a chosen list. The guide cannot prefill
the fine-grained form (GitHub supports prefilled links only for classic tokens),
so it lists the exact permissions instead, and the page names the missing one
when a call fails. See `githubErrors.js`.

## Consequences

**A script that runs on this origin can read the token.** That is the real cost
and it is not hypothetical: every web-project on `triunitystudios.com` shares one
origin, so they share one `localStorage`. Two things keep the risk small, and
both are rules, not hopes:

- **This project loads no third-party code.** Root ADR 0005 allows a pinned CDN
  import, and this project does not take it. A CDN script on a page holding a
  credential can read that credential. `invariants.test.js` fails on any import
  from outside this folder.
- **Nothing from GitHub reaches the screen as HTML.** Issue titles, label names
  and note text go through `textContent`. The one exception is the deploy line,
  which carries its own escaper.

**The blast radius is the token's own scope.** A leaked fine-grained token can do
what its permissions allow on the repositories it lists, until it expires. That
is why the guide asks for an expiry date and a short repository list, and why
every token in Settings carries **Remove**, one press away and with nothing to
sit through. Removing the last one forgets everything this browser stored.
There was once a single "Sign out and forget the token" button beside them; it
went when the board grew a list of tokens, because a red button that wipes all
of them sits badly under a list whose ordinary action is to remove one
(ADR 0018).

**Rejected: keep it in memory only.** Correct for a page opened rarely, wrong for
one opened daily. Rejected: **IndexedDB**. It is not readable by less script than
`localStorage` is; it would trade real complexity for no real protection
(`whatsapp-sticker-creator` ADR 0004 moved there for size, which is not the
problem here). Rejected: **a server that holds the secret**. It is the only
answer that removes the token from the browser, and it ends the no-server design
this whole site rests on.
