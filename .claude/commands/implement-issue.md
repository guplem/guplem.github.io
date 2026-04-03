---
name: implement-issue
description: Implement a GitHub issue interactively -- asks about branch, PR target, and steps before starting work
argument-hint: [issue-number]
---

# Interactive Issue Implementation

Implement a GitHub issue by interactively gathering configuration, then processing steps sequentially with automated PR creation.

## 1. Determine the Issue

- If `$ARGUMENTS` contains an issue number, use it as `ISSUE`.
- If `$ARGUMENTS` is empty, ask using `AskUserQuestion`:
  > "Which GitHub issue do you want to implement?"

## 2. Fetch and Parse the Issue

```bash
gh issue view $ISSUE --json title,body,number,labels
```

Display the issue title to the user so they can confirm context.

Parse the issue body to extract:
- **Sub-issues**: collect all `#<number>` references grouped by phase.
- **Phase structure**: issues grouped into phases if applicable.
- **Acceptance criteria**: what defines "done".

## 3. Ask: Working Branch

Use `AskUserQuestion`:

> "Do you want to implement the changes in a new branch or use the current one?"

Options:
1. **Create or switch to a different branch** - Specify a branch name.
2. **Current branch (`<current-branch-name>`)** - Work on the branch you're already on.

If option 1:
- Ask for the branch name.
- Check if it exists locally or remotely:
  - Exists: `git checkout <branch> && git pull origin <branch>`
  - New: `git checkout -b <branch> && git push -u origin <branch>`

Store as `WORK_BRANCH`.

## 4. Ask: PR Target Branch

Use `AskUserQuestion`:

> "Which branch should the PR target?"

Options:
1. **main** - PR will target the main branch directly.
2. **Current branch (`<WORK_BRANCH>`)** - PR will target the working branch.
3. **Custom branch** - Specify a different target.

Store as `PR_TARGET_BRANCH`.

## 5. Analyze Steps

### 5a. If the issue has explicit phases or sub-issues

Present the detected structure and ask using `AskUserQuestion`:

> "This issue has <N> phases/steps. Which one do you want to implement?"

Options (up to 4):
1. **Phase 1: <summary>**
2. **Phase 2: <summary>**
3. **All phases sequentially**

### 5b. If the issue has NO explicit phases

Analyze the issue body to determine if it makes sense to split. Consider:
- Number of distinct features or changes
- Whether changes touch different areas
- Natural dependency boundaries

**If splitting makes sense**, propose steps and ask:

> "I'd suggest splitting this into <N> steps:"

Options:
1. **Yes, implement step by step** - Proceed with steps.
2. **No, implement it all at once** - Single pass.

**If splitting does NOT make sense**, proceed directly as a single unit.

## 6. Validate Pre-conditions

Before starting:

1. Confirm the working branch is up to date:
   ```bash
   git checkout $WORK_BRANCH && git pull origin $WORK_BRANCH
   ```
2. If implementing phases with sub-issues, verify sub-issues are in OPEN state.

## 7. Execute Implementation

### 7a. Multi-step mode (has sub-issues or proposed steps)

For **each sub-issue/step**, one at a time:

1. **Create a branch** from `$WORK_BRANCH`:
   ```bash
   git checkout -b <issue-number>-<short-slug> $WORK_BRANCH
   git push -u origin <issue-number>-<short-slug>
   ```

2. **Spawn an implementation agent** (using `Agent` tool with `isolation: "worktree"`) with this prompt:

   > You are implementing GitHub issue #<NUMBER> for a portfolio site monorepo.
   >
   > ## Issue Details
   > <Full issue title and body>
   >
   > ## Instructions
   > 1. Read the project's `CLAUDE.md` for conventions and verification commands.
   > 2. Run the **pattern-scout** agent before writing any code.
   > 3. **Diagnose first**: Search the codebase for relevant files. Identify the root cause or exact locations that need changing.
   > 4. **Plan if complex**: If the fix involves more than 2 files, create a checklist before starting.
   > 5. **Test first** (if in web-projects): Write a failing test before implementing the solution.
   > 6. Implement following the patterns found.
   > 7. Run verification: `cd web-projects/<project> && bun test` (if applicable).
   > 8. Fix any errors before finishing.
   > 9. Create conventional commits (e.g., `feat: add color picker to photo-editor`).
   > 10. Push: `git push origin HEAD`
   >
   > ## Branch
   > Work on branch: `<issue-number>-<short-slug>`
   > Base branch: `$WORK_BRANCH`
   >
   > ## Scope
   > Only implement what is described in the issue. Do not modify code outside the scope.

3. **Wait for the agent to complete.**

4. **Create a PR**:

```bash
gh pr create \
  --base $PR_TARGET_BRANCH \
  --head <issue-number>-<short-slug> \
  --title "<conventional-prefix>: <short issue title>" \
  --body "$(cat <<'PREOF'
## Summary

Closes #<ISSUE_NUMBER>

<1-3 bullet points summarizing what was done>

## Test plan

- [ ] Tests pass (if applicable)
- [ ] Manual verification of the feature

PREOF
)"
```

5. **Run the review cycle** (step 8) before moving to the next sub-issue.

### 7b. Single-issue mode

1. Work directly on `$WORK_BRANCH`.
2. Spawn an implementation agent with the same prompt template as 7a, referencing the issue directly.
3. Create a PR targeting `$PR_TARGET_BRANCH`.
4. Run the review cycle (step 8).

## 8. Review Cycle

For each PR, run a review cycle after creation using a local file `.reviews/<issue-number>-review.md`.

### 8a. Spawn a review agent

Spawn a **new agent without prior context**:

> You are reviewing a pull request for a portfolio site monorepo.
>
> ## PR Details
> - PR number: <PR_NUMBER>
> - Branch: <BRANCH_NAME>
>
> ## Instructions
> 1. Fetch PR details: `gh pr view <PR_NUMBER> --json title,body,url,headRefName,baseRefName`
> 2. Fetch the full diff: `gh pr diff <PR_NUMBER>`
> 3. Read the project's `CLAUDE.md` for conventions.
> 4. Review for: correctness, pattern adherence, type safety, security, scope, tests, style.
> 5. Write review to `.reviews/<PR_NUMBER>-review.md`:
>    ```markdown
>    # Review: PR #<PR_NUMBER> -- <PR title>
>
>    ## Verdict: APPROVED | CHANGES_REQUESTED
>
>    ## Summary
>    <1-3 sentence assessment>
>
>    ## Issues
>    ### Issue 1: <short title>
>    - **File:** `<file-path>`
>    - **Line(s):** <line number or range>
>    - **Severity:** critical | high | medium | low
>    - **Description:** <what's wrong and why>
>    - **Suggestion:** <how to fix it>
>    ```
>    Create `.reviews/` if it doesn't exist: `mkdir -p .reviews`

### 8b. If changes requested, iterate

Read the review file. If verdict is `CHANGES_REQUESTED`:

1. Spawn an implementation agent to address every issue.
2. Delete old review file, spawn a new review agent.
3. Repeat until `APPROVED` (max 3 iterations).

### 8c. Clean up

Once approved:
```bash
rm -f .reviews/<PR_NUMBER>-review.md
rmdir .reviews 2>/dev/null || true
```

Notify the user that the PR is ready for human review.

**Do not merge the PR.** Wait for the user to review, approve, and merge manually.

## 9. Completion

After all PRs for the current phase are done, report:

> Phase <N> complete. All sub-issues implemented.

If there are more phases:
> Run `/implement-issue <ISSUE>` to continue with the next phase.

If all phases done:
> All phases complete. All changes have been submitted as PRs.

## Important Rules

- **Never push to `main` directly.** All work goes through branches and PRs.
- **Never merge PRs automatically.** Always wait for human approval.
- **One branch per sub-issue.** Do not mix work from multiple issues.
- **Conventional commits.** Use `feat:`, `fix:`, `refactor:`, `chore:`, etc.
- **Scope discipline.** Each agent works only on its assigned issue.
- **Verification is mandatory.** Run tests before pushing (when tests exist).
- **Fresh reviewers.** Review agents must have no context from implementation.
- **Max 3 review iterations.** If still failing after 3 rounds, move on.
- **Phase ordering matters.** Never start Phase N+1 before Phase N is done.
- **Interactive first.** Always use `AskUserQuestion` to gather configuration.
