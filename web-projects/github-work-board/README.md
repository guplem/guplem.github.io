# Work Board

A personal board on top of your GitHub issues, with private notes that follow you
between devices. It runs entirely in your browser: there is no server, no account
to make here, and nothing is stored anywhere except GitHub.

## Features

- **Every open issue assigned to you**, across every repository your token can
  read, in one list.
- **A private note on any issue.** Notes are yours alone. They never appear on
  GitHub's issue page, and nobody else sees them.
- **Your notes sync themselves.** They live in a JSON file in a private
  repository you own, so the laptop and the phone show the same thing, and every
  change keeps a version in git history.
- **Two devices can edit at once.** The merge runs note by note, so nothing you
  wrote is overwritten by the other device.
- **Plain error messages.** When a call fails, the page names the permission to
  add instead of showing GitHub's own wording.

## Setting it up, once

1. **Make a private repository for your notes.** Call it `work-board-data` and
   set the visibility to **Private**. The page links you to the right form.
2. **Make a fine-grained personal access token** at
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
   Give it access to the repositories you work in *and* the notes repository,
   then grant:
   - `Metadata` → Read-only
   - `Issues` → Read and write
   - `Contents` → Read and write

   Set an expiry date. 90 days is a good default.
3. **Paste the token into the page** and press Connect. The page checks each
   permission and tells you exactly which one is missing if any call fails.

The token is kept in this browser and is sent only to GitHub. Anything else with
access to this browser can read it, so keep the repository list short and keep
the expiry date. "Sign out and forget the token" removes it.

## How to Run

Open `index.html` in a browser, or serve the folder with any HTTP server:

```bash
python -m http.server 8000
```

## Tests

```bash
bun test
```
