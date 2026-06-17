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
  rows are blank. A tie-break (`Red`/`Blue`) is filled only when a round's points are level
  (see `G01` combat 2, which has `Blue` in `R1 Tiebreak`).
- This is invented sample data, not the real roster.
