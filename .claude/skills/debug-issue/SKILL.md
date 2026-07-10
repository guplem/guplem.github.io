---
name: debug-issue
description: Diagnose a bug or a failed fix by brainstorming root causes, narrowing to the most likely, and validating with targeted logs before changing code. Use when a fix attempt failed or a reported behavior needs root-causing.
---

# Debug a failed fix or reported bug

When a fix attempt fails: consider a handful of plausible root causes (scale the breadth to the problem: more for a gnarly bug, fewer for an obvious one), narrow to the most likely candidate(s), add targeted logs to validate, repeat until confirmed.

A "plausible-looking root cause" is not enough; pattern-matching a symptom into a fix wastes a commit and undermines trust. Walk the suspected code path and confirm it can actually produce the reported behavior before editing. If no theory holds, broaden the search: a failing CDN import (`marked` via esm.sh needs network), stale `Map` caches for JSON/markdown, the browser cache serving old data files, and `idFromText()` normalization mismatches in filter code can all produce the same symptom.
