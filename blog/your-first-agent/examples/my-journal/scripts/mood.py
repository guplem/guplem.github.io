# mood.py: counts how many days there were of each mood in each month.
#
# It reads the files in data/entries/ (one per day, with the date as its name).
# Each entry must start like this:
#   line 1:  # 2026-10-20
#   line 2:  Mood: calm
# If an entry does not follow the format, the script skips it and warns you.
#
# Use, from the agent's folder:  python3 scripts/mood.py
# It only uses the Python 3 standard library: there is nothing to install.

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

FOLDER = Path(__file__).resolve().parent.parent / "data" / "entries"
DATE = re.compile(r"^#\s*(\d{4})-(\d{2})-(\d{2})\s*$")
MOOD = re.compile(r"^[Mm]ood\s*:\s*(\S+)\s*$")


def read_entry(path):
    """Return (month, mood) or raise ValueError with the reason in English."""
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) < 2:
        raise ValueError("it has fewer than two lines")
    d = DATE.match(lines[0])
    if not d:
        raise ValueError("the first line is not '# YYYY-MM-DD'")
    year, month, day = d.groups()
    if path.stem != f"{year}-{month}-{day}":
        raise ValueError("the date on the first line does not match the file name")
    if not 1 <= int(month) <= 12 or not 1 <= int(day) <= 31:
        raise ValueError("the date is not valid")
    m = MOOD.match(lines[1])
    if not m:
        raise ValueError("the second line is not 'Mood: word'")
    return f"{year}-{month}", m.group(1).lower()


def main():
    if not FOLDER.is_dir():
        print(f"WARNING: the folder {FOLDER} does not exist")
        return 1
    months = defaultdict(Counter)
    for path in sorted(FOLDER.glob("*.md")):
        try:
            month, mood = read_entry(path)
        except (ValueError, UnicodeDecodeError, OSError) as error:
            print(f"WARNING: skipping {path.name}: {error}")
            continue
        months[month][mood] += 1
    if not months:
        print("There are no valid entries.")
        return 0
    for month in sorted(months):
        total = sum(months[month].values())
        print(f"{month} ({total} {'day' if total == 1 else 'days'})")
        for mood, n in sorted(months[month].items(), key=lambda x: (-x[1], x[0])):
            print(f"  {mood}: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
