# averages.py
# Reads data/grades.csv and calculates the average of each group and of each activity.
# Use: python3 scripts/averages.py
#      python3 scripts/averages.py other/path/grades.csv   (if the file is somewhere else)
# It only uses standard Python 3: there is nothing to install.
# The CSV must have these columns: student,group,activity,date,grade

import csv
import sys
from pathlib import Path

COLUMNS = ["student", "group", "activity", "date", "grade"]


def fail(message):
    print("Error: " + message)
    sys.exit(1)


def read_grades(path):
    """Return a list of (group, activity, grade). Warn about rows with problems."""
    try:
        with open(path, newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            if reader.fieldnames is None:
                fail("the file " + str(path) + " is empty.")
            missing = [c for c in COLUMNS if c not in reader.fieldnames]
            if missing:
                fail(str(path) + " is missing these columns: " + ", ".join(missing)
                     + ". The first row must be: " + ",".join(COLUMNS))
            rows = []
            for line, row in enumerate(reader, start=2):
                if None in row:
                    print("Warning: line " + str(line) + " ignored, it has more columns than "
                          "it should (a decimal with a comma and no quotes?).")
                    continue
                group = (row.get("group") or "").strip()
                activity = (row.get("activity") or "").strip()
                text = (row.get("grade") or "").strip().replace(",", ".")
                if not group and not activity and not text:
                    continue  # empty row
                try:
                    grade = float(text)
                except ValueError:
                    print("Warning: line " + str(line) + " ignored, the grade '"
                          + text + "' is not a number.")
                    continue
                if not group or not activity:
                    print("Warning: line " + str(line) + " ignored, the group or the activity is missing.")
                    continue
                rows.append((group, activity, grade))
            return rows
    except FileNotFoundError:
        fail("I cannot find " + str(path) + ". Run the script from the agent folder "
             "or give the path of the file.")
    except (OSError, UnicodeDecodeError, csv.Error) as problem:
        fail("I could not read " + str(path) + " (" + str(problem) + ").")


def averages_by(rows, position):
    """Group the grades by the chosen column (0 = group, 1 = activity)."""
    totals = {}
    for row in rows:
        total, count = totals.get(row[position], (0.0, 0))
        totals[row[position]] = (total + row[2], count + 1)
    return {key: (total / count, count) for key, (total, count) in totals.items()}


def show(title, averages):
    print(title)
    for key in sorted(averages):
        average, count = averages[key]
        print("  " + key + ": " + format(average, ".2f") + "  (" + str(count) + " grades)")
    print()


def main():
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
    else:
        path = Path(__file__).resolve().parent.parent / "data" / "grades.csv"
    rows = read_grades(path)
    if not rows:
        fail("there is no valid grade in " + str(path) + ".")
    show("Average by group", averages_by(rows, 0))
    show("Average by activity", averages_by(rows, 1))
    print("Total: " + str(len(rows)) + " grades read.")


main()
