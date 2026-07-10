---
name: create-issue
description: Create a well-structured GitHub issue with duplicate detection, code verification, and auto-labeling
argument-hint: [brief description]
---

# Interactive Issue Creation

Create a GitHub issue with a standardized structure, duplicate detection, code verification, and auto-labeling.

## 1. Gather Initial Context

### 1a. Determine the starting input

- If `$ARGUMENTS` contains a text description, use it as the initial context.
- If `$ARGUMENTS` is empty, ask using `AskUserQuestion`:
  > "Describe the issue you want to create. A sentence or two is enough -- I'll help structure it."

### 1b. Ask for additional context

Ask using `AskUserQuestion`:

> "Do you have any link with additional context?"

Options:
1. **Yes, here's a link** - The user will paste a URL (e.g., GitHub discussion, error log, related PR).
2. **No, let's continue with what I described** - Proceed without external context.

## 2. Deep Understanding -- Clarify Until Crystal Clear

**This step is mandatory and must not be skipped.** Before moving forward, you must be fully confident that you understand exactly what the user wants.

### 2a. Summarize your understanding

Write a short, concrete summary of:
- **What** the user is describing (the problem, feature, or improvement)
- **Why** it matters (impact, who is affected, what breaks or is missing)
- **Where** in the system it applies (which areas, files, or projects)

### 2b. Identify gaps and ambiguities

Critically evaluate your summary. Ask yourself:
- Could this description mean two different things?
- Is the scope clear -- do I know what's in and what's out?
- For bugs: Do I know the exact reproduction path, or am I guessing?
- For features/improvements: Do I know the desired behavior precisely, or is it vague?

### 2c. Ask clarifying questions (repeat until clear)

If **any** gap or ambiguity exists, ask clarifying questions. **Ask one question at a time** using `AskUserQuestion`. Do not proceed until every question is answered.

**Rules for this step:**
- **One question at a time.** Never dump multiple questions in a single message.
- **Never assume.** If something could be interpreted two ways, ask.
- **Iterate.** If the user's answer raises new questions, ask those too.
- **Don't interrogate unnecessarily.** If the description is genuinely clear, a brief confirmation is enough.

## 3. Determine Issue Type

Analyze the context and infer the issue type:

- **Bug** - Something is broken or behaving incorrectly
- **Feature** - A new capability that doesn't exist yet
- **Improvement** - Enhancement to an existing feature
- **Task** - Refactors, chores, and other specific pieces of work

Only ask if the type is truly ambiguous. Otherwise, infer silently and confirm in the combined review (Step 8).

## 4. Investigate the Codebase

Before structuring the issue, investigate the relevant code:

1. **Identify affected areas**: Determine which directories and files are involved.
2. **Search the codebase**: Find the relevant code paths, components, and logic.
3. **For bugs**: Verify the bug actually exists in the current code. If the code looks correct, report to the user and ask if they still want to create the issue.
4. **For features/improvements**: Identify existing code that would need to change and patterns to follow.

Store findings as `CODE_CONTEXT`.

## 5. Search for Duplicates and Related Issues

### 5a. Search open and recently closed issues

```bash
gh issue list --state open --limit 100 --json number,title,labels,body
gh issue list --state closed --limit 50 --json number,title,labels,body
```

### 5b. Analyze matches

Compare the new issue's intent against fetched issues. Look for exact duplicates, related issues, and closed duplicates.

### 5c. Report findings

**If likely duplicates found**, ask using `AskUserQuestion`:
> "I found an existing issue that looks like it covers the same problem:
> - #<NUMBER> - <TITLE> (<STATE>)
>
> What would you like to do?"

Options:
1. **It's a duplicate, stop** - Do not create the issue.
2. **It's related but different, link it** - Create and reference the existing one.
3. **Ignore, create anyway** - Proceed without linking.

**If related issues found**, present them:
> "I found some related issues: #X, #Y. I'll reference them in the new issue."

Store related issue numbers as `RELATED_ISSUES`.

## 6. Auto-Detect Labels

Based on the issue description and code investigation, propose labels. Use existing repo labels. Common categories:

- Area labels based on affected code paths (e.g., `web-project`, `portfolio`, `simulation`, `data`)
- Type indicators if the repo uses them

**Never assign priority labels.** Priority is determined by a human after creation.

Store proposed labels as `PROPOSED_LABELS` for combined review in Step 8.

## 7. Draft the Issue

### Bug template

```markdown
## Context

<What is broken, who is affected, and why it matters. Do NOT state root causes as fact -- express confidence levels ("most likely caused by", "might be related to").>

## Steps to Reproduce

1. <Step 1>
2. <Step 2>
3. <Observe...>

## Expected Behavior

<What should happen instead. Only include if not obvious from Context.>

## Proposed Solution

<High-level approach based on code investigation. Reference specific files/functions.>

## Acceptance Criteria

- [ ] <Issue-specific criterion that defines "done">

## Related Issues

<Links to related issues. Omit this section entirely if there are none.>
```

### Feature template

```markdown
## Context

<Why this feature is needed -- what user need or goal does it serve.>

## Proposed Solution

<What the feature should do AND how to implement it. Reference existing patterns or code paths.>

## Acceptance Criteria

- [ ] <Issue-specific criterion that defines "done">

## Related Issues

<Omit if none.>
```

### Improvement template

```markdown
## Context

<What exists today, its limitations, and why improvement is needed.>

## Proposed Solution

<How it should work after the improvement AND the technical approach. Reference specific files/functions.>

## Acceptance Criteria

- [ ] <Issue-specific criterion that defines "done">

## Related Issues

<Omit if none.>
```

### Anti-redundancy rules (mandatory)

Before finalizing the draft, re-read it and apply these rules:

1. **No section should restate another section.** Merge overlapping content.
2. **Context must not restate the title.**
3. **Acceptance Criteria must not restate Expected Behavior.** Each checkbox must tell the implementer something new.
4. **No generic AC items.** Do not include "tests pass", "lint passes", "no regressions". Every AC item must be specific to THIS issue.
5. **Omit empty or boilerplate sections.** If Related Issues would say "None", omit the section.
6. **Steps to Reproduce must add value.** If reproduction is trivially "go to the page and look", describe the condition in Context instead.
7. **Proposed Solution must add implementation detail.** If it just restates Expected Behavior, merge or remove it.

### Generate Title Options

Generate **2-3 title candidates**. Each title must:
- Be under 80 characters
- Be concise and specific -- describe the outcome, not the process
- NOT include conventional prefixes (`fix:`, `feat:`, etc.)

Vary by focus:
1. **User-facing**: Impact from a user's perspective
2. **Technical**: Root cause or component
3. **Action-oriented** (optional 3rd): What needs to happen

Present options using `AskUserQuestion`. The user picks one or provides a custom title.

## 8. Draft Review with User

Present the full draft for review:

1. **Issue type**
2. **Selected title**
3. **Labels** (proposed)
4. **Full draft body**

Then ask using `AskUserQuestion`:

> "Here's the full draft. Would you like any changes?"

Options:
1. **Looks good, create it**
2. **Make changes first** - The user will describe adjustments.

## 9. Create the Issue

Always include the `waiting-for-human-check` label. If it doesn't exist in the repo, create it first:
```bash
gh label create "waiting-for-human-check" --description "No human has verified this yet -- direct AI output" --color "D93F0B" 2>/dev/null || true
```

```bash
gh issue create \
  --title "<SELECTED_TITLE>" \
  --label "<label1>,<label2>,waiting-for-human-check" \
  --body "$(cat <<'EOF'
<FULL ISSUE BODY>
EOF
)"
```

Present to the user:
- The issue URL
- The selected title
- The assigned labels
- Any linked issues

## Important Rules

- **Never create without confirmation.** Always show the draft and get user approval.
- **Clarify before structuring.** Step 2 is mandatory. Never skip it.
- **Code verification is mandatory for bugs.** Always check if the bug exists in current code.
- **Duplicate check is mandatory.** Always search open and closed issues.
- **Respect the user's time.** Only ask questions when you genuinely can't infer the answer.
- **Keep acceptance criteria testable.** Each criterion should be verifiable.
- **No redundancy.** Every sentence must earn its place.
