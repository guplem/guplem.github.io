# my-class-helper

This folder is an AI agent that is ready to use: a helper for a maths teacher in Year 4 (4th grade) with two groups, 4A and 4B.
It is the "Teacher" example of the guide https://triunitystudios.com/blog/your-first-agent/ (look there if you want to see how it is built).

The data is made up as an example (groups, grades and calendar for October 2026). The students are only class list numbers. Delete them and add your own.
The grades in data/grades.csv are also invented. That file is a clean table, with no warning at the top, so I say it here.

How to open it (move the folder wherever you want and choose that folder in your app):
- Claude: open the desktop app, go to the Code tab and choose the folder.
- ChatGPT: open the app, choose Codex in the mode selector, click "Add new project" and choose the folder.
- Antigravity: click the new project icon, "Add Folder", choose the folder and click "Create".
- Goose: choose the folder in the selector in the bottom bar. Before that, in "Settings > Chat > Default Mode", choose "Manual" so that it asks you before it changes files.

Try this: "Make me a fractions worksheet for 4B." There is one already made in exports/.
For the averages, ask: "Give me the averages of the grades". It will use scripts/averages.py (it needs Python 3).
