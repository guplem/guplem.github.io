# my-coach

This folder is an example AI agent: a personal coach that logs your workouts and meals and tells you how you are doing toward your goal.
It is the "Health" example from the guide. The data is example data: delete mine and add yours.

## How to open it
- Claude: open the desktop app, go to the Code tab and choose this folder.
- ChatGPT: open the app, choose Codex mode and click "Add new project".
- Antigravity: click the new project icon, click "Add Folder", choose this folder and click "Create".
- Goose: choose this folder in the selector at the bottom. First, go to "Settings > Chat > Default Mode" and choose "Manual" so that it asks before it changes files.

Then type: "Make me the summary of this week."

## What is inside
- AGENTS.md: the instructions. CLAUDE.md only points to them.
- data/: your goal, your routine and the log of workouts and meals.
- .agents/skills/ and .claude/skills/: the weekly summary skill (the same one, for all apps).
- scripts/summary.py: adds up the last 7 days (needs Python 3).
- exports/: the summaries that the agent gives you.

This is not medical advice. If you have doubts or pain, ask a professional.

The full guide: https://triunitystudios.com/blog/your-first-agent/
