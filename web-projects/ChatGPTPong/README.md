# ChatGPT Pong

A classic Pong game generated entirely by **ChatGPT (GPT-3.5)** in December 2022, right after the initial release of ChatGPT. This was my first ever software project created by an AI — and it blew my mind.

## Features

- Player vs. AI pong with mouse-controlled paddle
- Simple AI opponent with slight randomness to keep it beatable
- Score tracking and ball speed increase on each hit

## How to Run

No build step required. Serve the folder with any HTTP server:

```bash
# From the repository root
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/ChatGPTPong/pong.html` in a browser.

Alternatively, open `pong.html` directly in a browser — all assets are self-contained.

## Tech Stack

Vanilla HTML, CSS, and JavaScript. No frameworks or dependencies.
