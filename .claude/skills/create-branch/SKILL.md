---
name: create-branch
description: Create a git branch from a base and immediately set its upstream so a later push never lands on the base branch. Use when starting work that needs its own branch.
---

# Create a branch with the upstream set immediately

> **UPSTREAM MUST BE SET IMMEDIATELY**

`git checkout -b <branch> <base>` sets the upstream to `<base>` by default. This is **dangerous**: a later `git push` will push directly to the base branch, and in this repo pushing to `main` deploys the live site (GitHub Pages). You **must** immediately follow with `git push -u` to fix the upstream.

The user may optionally specify a **base branch**; otherwise default to `origin/main`.

```bash
# Create branch and immediately set upstream (chained so push -u can't be forgotten)
git checkout -b <branch-name> <base> && git push -u origin <branch-name>
```

**Run both steps as a single chained command** (`&&`) so the push cannot be forgotten or deferred. Do not wait until later to push; the upstream is wrong from the moment the branch is created until `push -u` runs.

Or if already on the branch: `git push -u origin HEAD`.
