#!/usr/bin/env python3
# What to review: reads data/progress.md and tells you which topics
# you have not reviewed for more than 7 days, from the oldest to the most recent.
# Use: python3 scripts/what-to-review.py
# Optional: python3 scripts/what-to-review.py 2026-10-25   (to test with another date)
# It only uses the Python 3 standard library.

import sys
from datetime import date, datetime
from pathlib import Path

DAYS_LIMIT = 7
FILE = Path(__file__).resolve().parent.parent / "data" / "progress.md"


def read_date(text):
    return datetime.strptime(text.strip(), "%Y-%m-%d").date()


def main():
    try:
        today = read_date(sys.argv[1]) if len(sys.argv) > 1 else date.today()
    except ValueError:
        print("The date is not valid. Write it like this: YYYY-MM-DD (for example 2026-10-25).")
        return 1

    if not FILE.exists():
        print("I cannot find the file data/progress.md. Ask the agent to create it.")
        return 1

    try:
        lines = FILE.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        print("I cannot read data/progress.md. Check that it is a text file.")
        return 1

    due = []          # (days, subject, topic, status)
    never_reviewed = []  # topics with no date
    errors = []       # lines that cannot be understood

    for number, line in enumerate(lines, start=1):
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells[0] in ("Subject", "") or set(cells[0]) <= set("-: "):
            continue  # header or dashes line
        if len(cells) < 4:
            errors.append(number)
            continue
        subject, topic, status, date_text = cells[:4]
        if date_text in ("-", ""):
            never_reviewed.append((subject, topic, status))
            continue
        try:
            days = (today - read_date(date_text)).days
        except ValueError:
            errors.append(number)
            continue
        if days > DAYS_LIMIT:
            due.append((days, subject, topic, status))

    if errors:
        numbers = ", ".join(str(n) for n in errors)
        word = "line" if len(errors) == 1 else "lines"
        print(f"Warning: I do not understand {word} {numbers} of data/progress.md. Check the date (YYYY-MM-DD).")
        print()

    if not due and not never_reviewed:
        if errors:
            return 1
        print(f"All up to date. No topic has gone more than {DAYS_LIMIT} days without a review.")
        return 0

    if due:
        due.sort(key=lambda t: -t[0])  # the oldest first
        print(f"Topics not reviewed for more than {DAYS_LIMIT} days (from the oldest to the most recent):")
        for days, subject, topic, status in due:
            print(f"- {subject}, {topic}: {days} days ago ({status})")

    if never_reviewed:
        if due:
            print()
        print("Topics you have never reviewed:")
        for subject, topic, status in never_reviewed:
            print(f"- {subject}, {topic} ({status})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
