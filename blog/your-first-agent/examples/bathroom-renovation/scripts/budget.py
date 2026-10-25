#!/usr/bin/env python3
# budget.py
#
# What it does: reads data/budget.csv and tells you three things:
#   1. the total planned,
#   2. the total spent,
#   3. the items that go over what was planned.
#
# How to use it: from the agent's folder, type
#   python3 scripts/budget.py
#
# The file must have these columns: item,planned,spent
# The amounts are euros, in plain numbers (for example 350 or 12.5).
# It only uses Python 3, with nothing else to install.

import csv
import sys
from pathlib import Path

# The path is worked out from this script, so it works from anywhere.
PATH = Path(__file__).resolve().parent.parent / "data" / "budget.csv"
COLUMNS = ["item", "planned", "spent"]


def fail(message):
    print("Error: " + message)
    sys.exit(1)


def to_number(text, line, column):
    """Turn a text into a number. If it cannot, say where the problem is."""
    clean = (text or "").strip()
    try:
        value = float(clean)
    except ValueError:
        fail(f"on line {line}, the column '{column}' has '{clean}' "
             "and it is not a number. Write only the number, for example 350.")
    if value < 0:
        fail(f"on line {line}, the column '{column}' is negative ({clean}). "
             "Use a number of zero or more.")
    return value


def read_items():
    if not PATH.exists():
        fail(f"I cannot find the file {PATH}. "
             "Check that data/budget.csv exists.")
    try:
        with open(PATH, newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            if reader.fieldnames is None:
                fail("data/budget.csv is empty.")
            header = [c.strip() for c in reader.fieldnames]
            if header != COLUMNS:
                fail("the columns of data/budget.csv must be "
                     + ",".join(COLUMNS) + " and they are " + ",".join(header) + ".")
            items = []
            for number, row in enumerate(reader, start=2):
                if None in row or None in row.values():
                    fail(f"line {number} does not have exactly 3 columns.")
                if not any((value or "").strip() for value in row.values()):
                    continue  # blank line
                name = (row["item"] or "").strip()
                if not name:
                    fail(f"line {number} has no item name.")
                items.append((
                    name,
                    to_number(row["planned"], number, "planned"),
                    to_number(row["spent"], number, "spent"),
                ))
    except (OSError, UnicodeDecodeError) as problem:
        fail(f"I cannot read data/budget.csv ({problem}).")
    if not items:
        fail("data/budget.csv has no items.")
    return items


def euros(amount):
    """Write an amount as €5,450 (or €12.50 if it has cents)."""
    if abs(amount - round(amount)) < 0.005:
        return f"€{round(amount):,}"
    return f"€{amount:,.2f}"


def main():
    items = read_items()
    total_planned = sum(i[1] for i in items)
    total_spent = sum(i[2] for i in items)
    over = [i for i in items if i[2] > i[1]]

    print(f"Items: {len(items)}")
    print(f"Total planned: {euros(total_planned)}")
    print(f"Total spent: {euros(total_spent)}")
    print(f"Left to spend: {euros(total_planned - total_spent)}")
    print()
    if over:
        print("Items that go over what was planned:")
        for name, planned, spent in over:
            print(f"- {name}: planned {euros(planned)}, "
                  f"spent {euros(spent)} (+{euros(spent - planned)})")
    else:
        print("No item goes over what was planned.")


if __name__ == "__main__":
    main()
