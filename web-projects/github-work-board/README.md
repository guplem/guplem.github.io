# Work Board

A personal board on top of your GitHub issues, with private notes that follow you
between devices. It runs entirely in your browser: there is no server, no account
to make here, and nothing is stored anywhere except GitHub.

## Features

- **Every open issue and pull request assigned to you**, across every repository
  your token can read, in one list, each marked with what it is.
- **Seven ways to sort it**: recently updated, least recently updated, newest,
  oldest, ones you noted first, by repository, or by title. The choice goes into
  the address bar, so a reload keeps it and a link carries it.
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

1. **Create a private repository for your notes.** Call it `work-board-data`,
   and set **Visibility** to **Private**. It holds nothing but your notes: the
   board writes one file into it.

2. **Create a fine-grained personal access token** at
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
   The form asks three things:

   - **Repository access:** choose **Only select repositories**, then select
     **both** `work-board-data` *and* every repository whose issues you want on
     the board. Leaving `work-board-data` out is the mistake people make: the
     board can then read your issues and cannot save a single note.
   - **Repository permissions:** set these three and leave the rest alone.
     - `Metadata` → Read-only
     - `Issues` → Read and write
     - `Pull requests` → Read-only
     - `Contents` → Read and write
   - **Expiration:** pick a date. 90 days is a good default.

3. **Paste the token into the page** and press Connect. The page checks each
   permission and tells you exactly which one is missing if any call fails.

If the board later needs access your token does not have, the page says so on
load and names what to add. The permission list lives in the code, so the page
and this README cannot fall behind it.

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
