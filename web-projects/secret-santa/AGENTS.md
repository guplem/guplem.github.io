# secret-santa/AGENTS.md

> **SCOPE:** These rules apply when working on files under `web-projects/secret-santa/`.

A Secret Santa draw shared as one link, in Catalan, Spanish and English. See `README.md` for the features.

## Module map

| File | Role |
|---|---|
| `draw.js` | Pure. The seeded draw (`drawAssignments`), the seed maker, and the check for people who block every draw |
| `editor.js` | Pure. The changes the create screen makes to a draft: add, remove (with pair renumbering), toggle an exclusion |
| `urlState.js` | Pure. The `e` parameter: encode and decode the event as base64url JSON (with the optional note, `m`, at most 100 characters), and clean typed or pasted names |
| `share.js` | Pure. The message the organiser copies with the link, in a language they pick, and the WhatsApp link |
| `i18n.js` | Pure. The `ca`/`es`/`en` catalogue, the system-language detection and `translate` |
| `memory.js` | Pure. Remembers, on this device, who opened each draw (`localStorage` key `secret-santa.chosen`, keyed by `drawId`, the 50 most recent draws) |
| `deployStamp.js` | Pure. The "deployed at" footer line (root ADR 0013), copied from `sudoku-screenshot-coach` |
| `effects.js` | DOM. Snow, confetti and phone buzz; all off under reduced motion |
| `app.js` | DOM glue: the receive view (names, warning dialog, present, note), and the create view (editor, then share screen) |

## Rules

- **The draw output is permanent.** A shared link must give the same result on every phone, today and after any deploy. Never change the output of `drawAssignments`, `canonicalEvent`, `hashString` or `mulberry32`. A new draw needs a new link version `v`. See ADR 0001.
- **The link never carries the result.** Only the title, the note, the names, the forbidden pairs and the seed. The title and the note are not part of the draw: an edit to them keeps the result.
- **The receive view is for everyone, including older people.** It shows only the name list, the warning, the present and the note, in large type. It has no tabs and no footer: `body.is-receive` hides the footer, so the "deployed at" line and the report link show only in the create view. The present and the answer sit in the vertical middle of the screen. The organiser's view hides behind the small `#create-own` link at the very bottom. Do not add controls to the receive view.
- **The share button opens the phone's own share menu** (`navigator.share`), so the organiser can pick any app. A browser without that menu gets a WhatsApp link instead.
- **People are numbered by list position.** A forbidden pair `[g, r]` means "g may not give to r". `editor.removePerson` renumbers the pairs after the removed person.
- **The URL parameters:** `?e=` is a drawn event and opens the receive view. Any other address opens the create view. `?draft=` is the create view's draft: its seed is `-` until a draw happens, then the draw's seed, and a draft with a seed opens on the share screen.
- **`#create-own` fills the editor from the link's event.** "Start over" (`#clear`) empties it, and asks for a second tap first.
- **This device remembers who you are, per draw.** `memory.js` keys the choice by `drawId` (names, exclusions and seed, not the title). A remembered person skips the name list and lands on their closed present. The small `#not-me` link at the bottom of that screen is the only way back to the list. Keep it small: the owner asked for it to be "relatively hidden". Storage tier: this device (root ADR 0007).
- **Every text is in `i18n.js`.** `i18n.test.js` fails when a key misses a language or a placeholder. A new text needs all three languages.
- **The capture script clicks buttons by text.** The present button keeps a visually hidden label (`.sr-only`), so `scripts/captureProjectImage.js --click "Open the present"` can press it. The image source is `resources/images/projects/sources/secretSanta/`.
