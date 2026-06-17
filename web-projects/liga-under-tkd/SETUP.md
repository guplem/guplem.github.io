# Liga UNDER — Setup guide (connect the live Google Sheet)

The app reads all its data from **one Google Sheet**. The assistants edit that sheet live during
the event, and the website shows the changes within seconds. This guide explains how to create the
sheet, share it, and connect it to the app. No coding is needed except pasting one ID.

Until you connect a sheet, the app runs on **sample data** and shows a "Demo mode" badge.

---

## 1. Create the Google Sheet

> **Quick start:** the `sample-sheet/` folder has three ready-made CSVs (`Players.csv`,
> `Groups.csv`, `Combats.csv`) that recreate the demo data. Import them (File → Import → Upload →
> Insert new sheet) to get all three tabs with correct headers in minutes, then edit the rows. See
> `sample-sheet/README.md`. The steps below describe the same tabs if you prefer to build by hand.

Create one Google Sheet document with **three tabs** (the small tabs at the bottom). The tab names
and the column headers (the first row of each tab) must match **exactly**, including capital
letters and spaces.

### Tab `Players` (one row per athlete, filled before the event)

| Player ID | Name | Surname | Club | Group ID |
|-----------|------|---------|------|----------|
| P001 | Aina | Roca | Avellaneda | G01 |

- **Player ID**: a unique code like `P001`, `P002`, … Keep the leading zeros.
- **Group ID**: the group this athlete belongs to (links to the `Groups` tab).
- If a full name does not split cleanly into Name + Surname, put the whole name in **Name** and
  leave **Surname** empty.

### Tab `Groups` (one row per round-robin pool)

| Group ID | Age | Sex | Weight | Level | Pool |
|----------|-----|-----|--------|-------|------|
| G01 | Cadete | Femenino | -44kg | A | 1 |

- **Age**: `Cadete` or `Junior`.
- **Sex**: `Masculino` or `Femenino` (the website shows the translated word automatically).
- **Weight**: free text such as `-44kg` or `>78kg`.
- **Level**: `A` or `B` (skill division).
- **Pool**: `1` by default. Use `2`, `3`, … only when one category is split into several pools.

### Tab `Combats` (one row per combat — this is the live one)

| Red ID | Blue ID | Field | Combat | R1 Red | R1 Blue | R1 Tiebreak | R2 Red | R2 Blue | R2 Tiebreak | Status |
|--------|---------|-------|--------|--------|---------|-------------|--------|---------|-------------|--------|
| P001 | P002 | 1 | 1 | 12 | 5 | | 9 | 7 | | Finished |

- **Red ID / Blue ID**: the two fighters (must exist in the `Players` tab).
- **Field**: the tatami number (`1`, `2`, …).
- **Combat**: the running order on that tatami (`1`, `2`, `3`, …). There is **no clock**; combats
  simply run in this order on each tatami.
- **R1 Red / R1 Blue / R2 Red / R2 Blue**: the points each fighter scored in each round (numbers).
- **R1 Tiebreak / R2 Tiebreak**: fill with `Red` or `Blue` **only** when that round's points are
  tied and the referee picks a winner. Leave empty otherwise.
- **Status**: `Scheduled`, `Ongoing`, `Finished`, or `Cancelled`.
  - `Ongoing` shows partial scores live. `Finished` counts in the standings. `Cancelled` is ignored.

> Tip: in Google Sheets use **Data → Data validation** to turn `R1 Tiebreak`, `R2 Tiebreak`, and
> `Status` into dropdowns. This prevents typos. The website is forgiving (unknown status becomes
> `Scheduled`), but dropdowns keep the data clean.

The website **computes** the round winners, the result (2-0 / 1-1 / 0-2), the league points
(3 / 1 / 0), the points for/against/difference, the standings, and the cross-table. You never type
those — only the raw scores and the status.

---

## 2. Share the sheet as read-only

1. Click **Share** (top right).
2. Under **General access**, choose **Anyone with the link**.
3. Set the role to **Viewer**.
4. Click **Done**.

This lets the website read the sheet. It does **not** let visitors edit it. Never put private data
(phone numbers, emails, addresses) in this sheet — anyone with the link can read it.

---

## 3. Copy the Sheet ID

Open the sheet and look at the address bar. The ID is the long code between `/d/` and `/edit`:

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit
                                        └──────────── this is the Sheet ID ────────────┘
```

---

## 4. Connect it to the app

Open `config.js` (in this folder) and paste the ID into `sheetId`:

```js
sheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890",
```

Save and reload the page. The "Demo mode" badge becomes a green **Live** badge. That is the only
change needed — the app switches to live mode automatically when `sheetId` is not empty.

---

## 5. Before the event: a dry run

1. Fill the three tabs with a few real players, groups, and combats.
2. Open the website and check the four pages (Home, By tatami, By group, Athletes).
3. Change a combat's `Status` to `Ongoing`, then to `Finished` with scores, and watch the website
   update within ~25 seconds.

---

## Still to confirm with the organizer

These were set with safe guesses and can be changed in one place each:

- **Glossary** (in `i18n.js`): the words for "tatami", "round" (currently `Asalto` / `Assalt` /
  `Round`), and "combat". Change them if the organizer prefers other terms.
- **Tiebreaker rule** (in `engine.js`, `DEFAULT_TIEBREAKERS`): currently league points → points
  difference → points for → head-to-head. Reorder if the official rule differs.
- **Exact brand colors and fonts** (in `style.css`, the `:root` block): currently the poster blue
  plus the Oswald condensed font. Swap if official values arrive.
