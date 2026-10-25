# my-journal: an AI agent in a folder

This folder is a journal agent. It saves each day and helps you see what repeats.
It is the "Journal" example from the guide: https://triunitystudios.com/blog/your-first-agent/

## How to open it with your app
- Claude: open the Claude desktop app, go to the Code tab and choose this folder.
- ChatGPT: open the ChatGPT app, choose Codex mode, click "Add new project" and choose this folder.
- Antigravity: click the new project icon, "Add Folder", choose this folder and click "Create".
- Goose: open the app and choose this folder in the selector in the bottom bar. First, in "Settings > Chat > Default Mode", choose "Manual" so that it asks you before it changes files.

Then write: "Who are you and what can you do?"

## What is inside
- AGENTS.md: the instructions. CLAUDE.md only points to them.
- data/: the memory (the entries of each day and the themes).
- .agents/skills/ and .claude/skills/: the close-the-day skill.
- scripts/mood.py: counts the days of each mood per month (needs Python 3).
- exports/: an example summary.

## Important
- The entries and the themes are example data. Delete them and add your own.
- A journal is very personal. The app sends parts of your files to the model company so that it can answer. Do not write anything that you do not want to share.
