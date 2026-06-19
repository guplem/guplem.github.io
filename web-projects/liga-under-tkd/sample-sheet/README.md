# Sample sheet — importable CSVs

Three CSV files that recreate the demo data as a real Google Sheet. Import them to get a working
live sheet in a couple of minutes, then replace the rows with the real roster when it arrives.

The files match the exact column headers the app reads (see the project `SETUP.md`):

- `Players.csv` → the **Players** tab
- `Groups.csv` → the **Groups** tab
- `Combats.csv` → the **Combats** tab

## How to import into Google Sheets

1. Create a new Google Sheet (sheet.new).
2. For each file: **File → Import → Upload** and pick the CSV.
   - Import location: **Insert new sheet(s)** — this creates a tab named `Players` / `Groups` /
     `Combats` (the tab name must match the file name, which these already do).
   - Separator type: **Comma** (or Detect automatically).
   - Leave "Convert text to numbers..." **on** so scores import as numbers.
3. Delete the empty default `Sheet1` that Google created.
4. Confirm the three tabs are named exactly `Players`, `Groups`, `Combats`.
5. Share the sheet: **Anyone with the link → Viewer**.
6. Copy the Sheet ID from the URL into `config.js` (`sheetId`). See `SETUP.md`.

The app then shows the same data you already saw in Demo mode, now read live from your sheet.

## Notes

- Empty score cells are intentional: only `Finished`/`Ongoing` combats have points; `Scheduled`
  rows are blank. The `R1 Winner`/`R2 Winner` cells force a round's winner (overriding the points)
  and are usually empty. See `G01` combat 2: R1 is a 6-6 tie won by `Blue`, and in R2 the `Red`
  fighter leads 8-4 but is disqualified, so `Blue` is set as the round winner and wins the combat.
- This is invented sample data, not the real roster.
