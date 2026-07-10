---
name: write-commit
description: Shape git commits - atomic one-concern commits, conventional-commit subjects, why-focused bodies, a coherent branch narrative. Use when composing commits after the user has authorized a commit.
---

# Commit shape and message discipline

The HARD RULE on *when* you may commit (never without explicit user instruction) lives in the root `AGENTS.md` and always applies. This skill covers *how* to shape a commit once the user has authorized one.

Treat the act of committing as part of the deliverable. The next reader of `git log` should be able to reconstruct *what you did and why* without diffing the code.

- **Atomic, isolated commits, one concern per commit.** Split unrelated changes across separate commits, even when made in the same session. A follow-up refactor, a doc update, and a test addition are three commits, not one. If `git diff --stat HEAD` would touch files from three distinct concerns, plan three commits. Do not bundle changes "for tidiness"; bundling destroys reviewability and bisectability.
- **Group by intent, not by file.** A commit titled `"various fixes"` or `"address feedback"` is almost always wrong: it means changes from multiple concerns were collapsed. Title each commit after the one thing it does (`fix(algorithm): skip blocked things in getBest()`), and put orthogonal work in a sibling commit.
- **Subject + body, not subject-only.** The subject states what changed in <=72 chars using a conventional-commit prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`). The body explains *why*: the constraint that forced this shape, the previous behavior, the failure mode it prevents, the ADR / issue / review comment that motivated it. Trivial commits (single-line typo) can skip the body; anything non-trivial needs one.
- **Branch history must read as a coherent development narrative.** A reader scrolling `git log --oneline <base>..HEAD` should follow the work step-by-step in the order it was done: foundational refactors land before the feature that depends on them; tests ship in or immediately after the commit they cover; doc updates that describe new code land with that code, not in a trailing "docs" dump. If your branch ends with a single 800-line commit titled `"implement feature"`, rebase before pushing.
- **Pre-commit checklist.** Before each `git commit`, ask: *what single sentence summarizes the diff I'm about to commit, and would the next reader of the branch agree that sentence is faithful?* If the answer involves an "and", split the commit.
- **Hard mechanics.** Never --amend, never --no-verify, never force-push. If a pre-commit hook fails, fix the problem and create a new commit.
