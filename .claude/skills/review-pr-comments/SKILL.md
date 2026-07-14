---
name: review-pr-comments
description: Review PR comments, apply or reject each one with evidence, and post replies directly to GitHub
argument-hint: [pr-number-or-url]
---

# PR Comments Review

Review PR (pull request) comments from reviewers. Make a careful decision on each one. Apply code changes where appropriate. Reply directly on GitHub.

## 1. Determine Which PR

If `$ARGUMENTS` contains a PR number or URL, use it. Otherwise, ask using `AskUserQuestion`:

> "Which PR's comments do you want to review?"

Options:
1. **Current branch's PR** - Find the PR for the current branch.
2. **A specific PR number** - The user will type the number.

Store as `PR_NUMBER`.

## 2. Fetch PR Context

Gather the full context needed to evaluate comments:

```bash
# PR metadata
gh pr view $PR_NUMBER --json title,body,url,state,headRefName,baseRefName

# Full diff
gh pr diff $PR_NUMBER

# All review comments
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/$PR_NUMBER/comments --paginate

# Review-level comments (top-level review bodies)
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/$PR_NUMBER/reviews --paginate
```

If there are no comments, inform the user and stop.

Present a summary to the user:
- PR title and state
- Number of comments to review
- Which files have comments

## 3. Analyze Each Comment

For each PR comment, follow this structured decision framework:

### 3a. Understand the Context

Before deciding on a comment:
1. What is the current behavior in the code?
2. What does the comment suggest changing?
3. Read the full file, not just the diff (the lines this PR changed), to understand the surrounding context.

### 3b. Validate Against the Codebase

Search for evidence that supports or contradicts the comment:

- **Pattern check**: Does the suggestion match patterns used elsewhere in the codebase? Run the **pattern-scout** agent if the comment suggests a new approach.
- **Type check**: If the comment is about types, verify against the actual type definitions.
- **Test check**: If the comment is about behavior, check what the tests expect.

### 3c. Apply the Review Checklist

| Area | Question |
|------|----------|
| Architecture | Does the suggestion follow the project's existing patterns? |
| Types | Does it improve or maintain type safety? |
| Error handling | Does it improve resilience or correctness? |
| Security | Does it address a real vulnerability? |
| Tests | Does it improve coverage or correctness? |
| Code quality | Does it reduce duplication, improve naming, or simplify logic? |
| Scope | Is this within the PR's scope, or a broader refactor? |

### 3d. Decide

For each comment, choose one:

1. **Apply** - The comment is correct, improves the code, and is within scope. Make the minimal change.
2. **Reject** - The comment is incorrect, unnecessary, or out of scope. Provide evidence.
3. **Ambiguous** - The comment has merit but is unclear. State your interpretation, then apply a concrete change.

Record 1-3 concise evidence bullets from the codebase to support your decision.

## 4. Apply Code Changes

For each "Apply" or "Ambiguous -> Applied" decision:

1. Make the **minimal change** needed to address the comment.
2. Preserve existing style and architecture.
3. If the change is complex (touches >2 files), create a checklist before starting.
4. Run verification where applicable:
   - Web-projects with tests: `cd web-projects/<project> && bun test`
5. Create conventional commits (commit messages in a fixed format, like `type: description`): `fix: address PR review - <short description>`
6. Push: `git push origin HEAD`

## 5. Post Replies to GitHub

After evaluating all comments and making changes, post a reply to each comment thread:

```bash
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/{pr_number}/comments/{comment_id}/replies -f body="<reply>"
```

Where `{comment_id}` is the `id` field (numeric `databaseId`) of the **original** comment.

### Reply Format

Each reply must start with a bold decision tag:

- **Applied**: `**Applied** in <short-sha> - <one sentence describing what changed>.`
- **Rejected**: `**Reject** - <1-3 sentences explaining why, with evidence>.`
- **Ambiguous**: `**Ambiguous -> Applied** in <short-sha> - Interpreted as: <interpretation>. <what changed>.`

Keep replies short and factual.

### Important Rules

- **Do NOT resolve/unresolve any review threads.** Leave thread resolution to human reviewers.
- Escape backticks and special characters properly when passing the body via `-f body=`.
- If a comment thread has multiple replies, read the full thread before deciding. The author may have clarified or withdrawn their comment.

## 6. Critical Standards

- **Be Skeptical**: Do not accept comments without evidence. A reviewer can be wrong.
- **Minimal Changes**: When applying, change only what is necessary. No refactoring or style changes unrelated to the comment.
- **Preserve Intent**: Maintain existing code style, architecture, and design decisions unless the comment directly contradicts them with good reason.
- **Evidence Over Authority**: Base decisions on code evidence, not on who posted the comment.
- **Scope Discipline**: If a comment suggests a change outside the PR's scope, reject it with a suggestion to open a separate issue/PR.

## 7. Report Summary

After posting all replies, present a summary to the user:

```
## PR Comments Review Summary

**PR:** #<number> - <title>
**Comments reviewed:** N

### Applied (N)
- Comment by @user on `file:line` - <what was changed>

### Rejected (N)
- Comment by @user on `file:line` - <why rejected>

### Ambiguous -> Applied (N)
- Comment by @user on `file:line` - Interpreted as: <interpretation>. <what was changed>

### Files Modified
- <list of files changed>

### Verification
- Tests: pass/fail/N/A
```
