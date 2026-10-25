# summary.py -- summary of the last 7 days of workouts.
#
# What it does: it reads data/log.csv and adds up, for the last 7 days,
# the workout minutes (rows with unit "min") and the kilometers
# (rows with unit "km"). Meals (unit "kcal") are not added up here.
#
# The 7 days are counted backward from the most recent date in the
# log, and that day is included. This way it works the same as time passes.
#
# How to log a run: two rows with the same date and type "run",
# one with the km and one with the minutes.
#
# Use (from the agent folder):  python3 scripts/summary.py
# It only uses the Python 3 standard library: there is nothing to install.

import csv
import sys
from datetime import date, timedelta
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "data" / "log.csv"
COLUMNS = ["date", "type", "detail", "amount", "unit"]
DAYS = 7


def fail(message):
    print(message)
    sys.exit(1)


def read_rows():
    """Return (valid rows, warnings). Each row is (date, type, amount, unit)."""
    if not PATH.exists():
        fail("I cannot find data/log.csv. Ask the agent to create it.")
    try:
        with open(PATH, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if header is None:
                fail("data/log.csv is empty. Log a workout first.")
            header = [c.strip().lower() for c in header]
            if header != COLUMNS:
                fail("The first line of data/log.csv must be: "
                     + ",".join(COLUMNS))
            rows, warnings = [], []
            for n, fields in enumerate(reader, start=2):
                if not any(c.strip() for c in fields):
                    continue  # blank line
                if len(fields) != len(COLUMNS):
                    warnings.append(f"Line {n}: it has {len(fields)} columns and must have 5. I skip it.")
                    continue
                date_text, kind, _detail, amount_text, unit = [c.strip() for c in fields]
                try:
                    day = date.fromisoformat(date_text)
                except ValueError:
                    warnings.append(f"Line {n}: the date '{date_text}' is not valid (use YYYY-MM-DD). I skip it.")
                    continue
                try:
                    amount = float(amount_text.replace(",", "."))
                except ValueError:
                    warnings.append(f"Line {n}: the amount '{amount_text}' is not a number. I skip it.")
                    continue
                rows.append((day, kind.lower(), amount, unit.lower()))
            return rows, warnings
    except (OSError, UnicodeDecodeError, csv.Error) as error:
        fail(f"I cannot read data/log.csv ({error}).")


def fmt(number):
    """Write 18.5 as 18.5 and 205.0 as 205."""
    return f"{number:g}"


def main():
    rows, warnings = read_rows()
    if not rows:
        for warning in warnings:
            print(warning)
        fail("There are no valid rows in data/log.csv. Log a workout first.")

    last = max(r[0] for r in rows)
    first = last - timedelta(days=DAYS - 1)
    week = [r for r in rows if first <= r[0] <= last]

    minutes = sum(a for _, _, a, u in week if u == "min")
    km = sum(a for _, _, a, u in week if u == "km")
    workout_days = {d for d, _, _, u in week if u in ("min", "km")}
    meals = sum(1 for _, t, _, _ in week if t == "meal")

    print(f"Summary of the last {DAYS} days")
    print(f"From {first} to {last} (the most recent date in the log is {last}).")
    print(f"- Workout minutes: {fmt(minutes)}")
    print(f"- Kilometers: {fmt(km)}")
    print(f"- Days with a workout: {len(workout_days)}")
    print(f"- Meals logged: {meals}")
    for warning in warnings:
        print("Warning: " + warning)


if __name__ == "__main__":
    main()
