# GitHub Stats Dashboard

A web-based dashboard for browsing GitHub repository statistics including issues, pull requests, commits, contributors, and language breakdowns.

## Features

- Browse public and private repositories (with token)
- Repository search and filtering
- Overview stats: stars, forks, watchers, repo age, commits/week
- Issues analytics: open/closed, close rate, average close time
- Pull request analytics: merged, open, closed (unmerged), merge rate
- Code activity: recent commits, unique authors, commit timeline
- Contributor breakdown with avatars and commit counts
- Language composition with visual bar chart
- Recent activity feed with event descriptions
- Responsive design for mobile and desktop

## How to Run

Open `index.html` directly in a browser, or serve locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/web-projects/github-stats-dashboard/`.

## Usage

1. Enter a GitHub Personal Access Token (for private repos) or just a username (for public repos)
2. Click "Load Repos" to fetch your repository list
3. Click any repository to view its detailed statistics
4. Use the search box to filter repositories by name or description

### Token Scopes

- No token needed for public repositories
- `repo` scope required for private repository access

## Tech Stack

Vanilla HTML, CSS, and JavaScript. No external dependencies — uses the GitHub REST API directly.
