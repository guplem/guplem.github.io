# Work Board

A personal board on top of your GitHub issues, with private notes that follow you
between devices. It runs entirely in your browser: there is no server, no account
to make here, and nothing is stored anywhere except GitHub.

## Features

- **Every open issue and pull request assigned to you**, across every repository
  your token can read, in one list, each marked with what it is.
- **What is waiting on you, above everything else.** A row of the pull requests
  where somebody asked for your review, longest-waiting first, because those
  cost other people time rather than yours.
- **A board that keeps itself up to date.** Six columns, from To do to Done,
  and a card moves itself when a pull request appears, when a reviewer is asked,
  when they answer, and when it merges. The button on a card opens a menu that
  moves it by hand when GitHub's answer is not the truth, and hands it back to
  the rules with one click.
- **The real links between your work.** A pull request appears inside the card
  of the issue it closes, an issue says what it is part of, and anything waiting
  on unfinished work is marked **Blocked**. All of it read from GitHub's own
  relationships, never guessed from a description.
- **Filter by kind, repository or label.** Two labels means either of them; a
  kind plus a repository means both. The filters go into the address bar too, so
  "everything tagged urgent in this repository" is a link.
- **A smart order, which is what the board opens on.** Oldest first, so the
  work that has waited longest is at the top, with one rule over it: a stack of
  pull requests reads in the order it can merge. A stacked pull request targets
  another one's branch, so the lower one has to merge first, and it is usually
  the one that looks least recently touched.
- **Or sort it plainly**: recently updated, least recently updated, newest,
  oldest, ones you noted first, by label, by repository, or by title. The choice
  goes into the address bar, so a reload keeps it and a link carries it.
- **A private note on any issue**, added from the card's own menu and shown only
  where one exists. Notes are yours alone: they never appear on GitHub's issue
  page, and nobody else sees them.
- **Your notes sync themselves.** They live in a JSON file in a private
  repository you own, so the laptop and the phone show the same thing, and every
  change keeps a version in git history.
- **Two devices can edit at once.** The merge runs note by note, so nothing you
  wrote is overwritten by the other device.
- **Plain error messages.** When a call fails, the page names the permission to
  add instead of showing GitHub's own wording.
- **A settings screen** for your tokens: what each one reaches, how to add
  another, and which repository holds your notes.
- **Your tokens back out again.** GitHub shows a token once and never again, so
  this browser holds the only copy. Settings can copy any token, show it, or
  copy every one of them as a single backup you keep in your password manager.

## Setting it up, once

1. **Create a private repository for your notes.** Call it `work-board-data`,
   and set **Visibility** to **Private**. It holds nothing but your notes: the
   board writes one file into it.

2. **Create a fine-grained personal access token** at
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
   The form asks you for each of these:

   - **Repository access:** choose **Only select repositories**, then select
     **both** `work-board-data` *and* every repository whose issues you want on
     the board. Leaving `work-board-data` out is the mistake people make: the
     board can then read your issues and cannot save a single note.
   - **Repository permissions:** set each of these and leave the rest alone.
     - `Metadata` → Read-only
     - `Issues` → Read and write
     - `Pull requests` → Read-only
     - `Contents` → Read and write
   - **Expiration:** pick a date. 90 days is a good default.

3. **Paste the token into the page** and press Connect. The page checks each
   permission and tells you exactly which one is missing if any call fails.

4. **Work in an organisation? Add a second token** from **Settings**. A fine-grained token belongs
   to one owner. A token owned by your account cannot see an organisation's
   repositories, whatever permissions you give it. Create another token with the
   organisation as the **Resource owner**, grant it the same permissions, and
   paste it there. Settings repeats the whole guide, so you do not have to come
   back here. An organisation owner may have to approve the token first.

   Keep the notes repository on your personal token. An organisation's owners
   can read its repositories, and these notes are meant for you alone.

If the board later needs access your token does not have, the page says so on
load and names what to add. The permission list lives in the code, so the page
and this README cannot fall behind it.

The token is kept in this browser and is sent only to GitHub. Anything else with
access to this browser can read it, so keep the repository list short and keep
the expiry date. "Sign out and forget the token" removes it.

## Moving to another browser or another computer

A different browser, a different computer and a different Chrome profile each
keep their own storage, so none of them can see the tokens you added in the
others. GitHub cannot show you a token a second time either.

1. In **Settings**, press **Copy every token as a backup**. Read the warning
   once and continue. You now hold one piece of text with every token and the
   name you gave it.
2. Keep that text in your password manager. It is a password: whoever holds it
   can do everything you granted those tokens.
3. On the other browser, paste it into the token box, on the welcome screen or
   in Settings. Every token comes back, with its name, and the board connects.

To move a single token instead, press **Copy** on its row. The token is never
printed on screen: it appears in the row only if your browser refuses the
clipboard, which happens when you open `index.html` as a file instead of
serving it. Even then it is forgotten as soon as you leave Settings.

## How to Run

Open `index.html` in a browser, or serve the folder with any HTTP server:

```bash
python -m http.server 8000
```

## Tests

```bash
bun test
```
