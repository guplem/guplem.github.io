# Sample sheets — importable CSVs

Two sets of CSVs, each recreating the three tabs the app reads. Import a set to get a working
live Google Sheet in a couple of minutes.

- **`demo/`** — invented sample data (4 players, a few combats). Use it to try the app or build a
  test sheet. This is fake data, not a real roster.
- **`real/`** — the actual tournament roster (253 athletes, 61 groups) with the generated
  combat schedule for the 40 four-player groups. Import this for the live event.

Each set has the same three files, named to match the tab the app expects:

- `Players.csv` → the **Players** tab
- `Groups.csv` → the **Groups** tab
- `Combats.csv` → the **Combats** tab

`real/` also contains `Club-codes.csv` — a reference table mapping each club to the short code
used inside the player IDs (for example `JB-TMT-1`). It is **not** imported into a tab.

## How to import into Google Sheets

1. Create a new Google Sheet (sheet.new).
2. For each file in the set: **File → Import → Upload** and pick the CSV.
   - Import location: **Insert new sheet(s)** — this creates a tab named after the file
     (`Players` / `Groups` / `Combats`), which is exactly what the app needs.
   - Separator type: **Comma** (or Detect automatically).
   - Leave "Convert text to numbers..." **on** so scores import as numbers.
3. Delete the empty default `Sheet1` that Google created.
4. Confirm the three tabs are named exactly `Players`, `Groups`, `Combats`.
5. Share the sheet: **Anyone with the link → Viewer**.
6. Copy the Sheet ID from the URL into `config.js` (`sheetId`). See `SETUP.md`.

## Notes

- **Player IDs** in `real/` are memorable codes: `{name initials}-{club code}-{n}`, e.g.
  `JB-TMT-1` = Joel Blanco, Taekwondo Mes Tordera. The `-n` only grows when two athletes share the
  same initials and club. See `real/Club-codes.csv` for the club codes.
- **Combats** in `real/` cover only the 40 groups that have exactly 4 players (a full round-robin,
  6 combats each = 240 combats). Groups of 3 or 5 are left out on purpose; they need manual
  decisions. Combats are ordered per tatami so no athlete fights twice in a row, with short rests
  between fights (at most 4 combats apart, which is the unavoidable minimum for a 4-player
  round-robin without back-to-back fights).
- Empty score cells are intentional: every `real/` combat is `Scheduled`. The `R1 Winner`/`R2
  Winner` cells force a round's winner (overriding the points) and are usually empty. In `demo/`,
  see `G01` combat 2 for an example: R1 is a 6-6 tie won by `Blue`, and in R2 the `Red` fighter
  leads 8-4 but is disqualified, so `Blue` is set as the round winner and wins the combat.
