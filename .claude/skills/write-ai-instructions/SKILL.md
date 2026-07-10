---
name: write-ai-instructions
description: Author or edit AI-facing instruction files in this repo - AGENTS.md, skills under .claude/skills/, subagents under .claude/agents/, and spawned-agent prompts. Covers prompt-writing rules for current Claude models, the map-not-manual standard for AGENTS.md, and when and where to persist new rules. Use when editing any AI-instruction file.
---

# Writing prompts for agents, skills, and rules

These rules apply when authoring or editing any AI-facing content in this repo: `AGENTS.md`, skills under `.claude/skills/`, subagents under `.claude/agents/`, and spawned-agent prompts. They reflect how current Claude models interpret instructions: more literally, with fewer default tool calls and subagents, and with response length calibrated to the task.

- **Be explicit, not inferential.** State what must happen for every case. Do not assume the model will generalize "do X for case A" to "also do X for case B": list both, or use explicit "applies to all `<category>`" wording. Instructions the reader has to interpret get interpreted narrowly.
- **Name the tool or action.** The model defaults to reasoning over tool use. If a step needs exhaustive search, say "search exhaustively" or "find several examples". If a step needs parallel subagents, say "launch in parallel in a single message". If a step needs a specific file read, reference it by path.
- **Give explicit guidance on when to delegate.** Subagents are spawned less aggressively by default. Decide up front whether delegation is wanted and state it.
- **Do not scaffold progress updates.** Remove patterns like "after every N tool calls, summarize progress": the harness produces interim updates natively. Structured end-of-step reports are fine; chat-style running commentary is not. When you *do* want a structured report, spell out the exact format and include a concrete example block.
- **Specify output shape only when it matters.** Add length, structure, or verbosity guidance only when the output has a specific consumer: a status block, a checklist, a structured report. Do not ask for "thorough" or "detailed" output without naming the consumer.
- **Prefer positive examples over negative ones.** "Do X" is more effective than "don't do Y". Reserve negative rules for genuine anti-patterns where the failure mode is non-obvious from the positive instruction alone.
- **Write the rule, not the reminder.** A prompt is read fresh each time; it cannot nudge the model mid-task. Put everything required for correctness up front, not buried in closing instructions or tips.
- **Avoid round-number counts unless the count itself matters.** "Brainstorm 5-7 causes" is interpreted as a hard range. Use "a handful", "several", or a range scaled to the task when breadth is the goal but the exact number is not.
- **Trust effort, not scaffolding, for depth.** Do not write "think step by step" or "reason carefully" as a generic kick. Prompt for depth only when the task has a specific reason to need it, and pair it with concrete structure.

## Writing and restructuring AGENTS.md (the map-not-manual standard)

`AGENTS.md` loads into context on every session, so every line costs attention the agent could spend on the task. The agent already knows how to code; long files make it follow each individual rule less reliably. So `AGENTS.md` must contain only what the agent cannot infer and needs at every code touch: product and architecture facts, conventions that diverge from the obvious default, and load-bearing gotchas. Everything else moves to a skill or is cut.

### Sort every line into keep, move, or cut

- **Keep inline** (stays always-on in `AGENTS.md`): non-negotiables, the architecture map, conventions an agent would otherwise get wrong, and each load-bearing gotcha (a rule that prevents a recurring bug). Write each as one direct rule. A short code snippet or a one-line why can stay inline; on its own it does not justify a skill.
- **Move to a skill** (loads only when relevant): a procedure or way-of-working, meaning a "how to do X" the agent invokes when performing X. Code examples and why-explanations move with it only when they serve that procedure. Link the skill from `AGENTS.md` with an imperative "Whenever you <do X>, use the `<skill>` skill".
- **Cut**: anything already written elsewhere (an ADR, `README.md`, another instruction file), anything a competent agent already knows, and ADR-table rows written as summaries. An ADR table is a one-line index, never a summary.

### The safety rule: never drop performance-relevant knowledge

A gotcha may move into a skill only if a one-line warning stays inline in `AGENTS.md`. The agent keeps the warning at all times; the skill adds the code and the reasoning when it is doing that work. Before you finish, re-read the original file and account for every section: confirm each removed block is either kept inline, relocated to a skill, or already present in the ADR or README that `AGENTS.md` now points to. If a rule lived only in `AGENTS.md` and has no other home, do not delete it.

### Style

- State the gotcha directly. Do not explain why a rule is in the document.
- Reference a skill with one imperative form every time: "Whenever you <do X>, use the `<skill-name>` skill."
- Bold only the few words that carry the rule.

### Mechanics (this repo)

- Skills live committed at `.claude/skills/<name>/SKILL.md`; subagents at `.claude/agents/<name>.md`. There are no sync scripts or mirrors; `adr/0015-agent-docs-structure.md` records why.
- Keep every skill model-invocable (no `disable-model-invocation` frontmatter) while the skill set stays small, and write each description to name exactly when the skill applies.
- `CLAUDE.md` is a one-line `@AGENTS.md` shim; never put content in it.
- Area docs follow the root pattern: content in `<area>/AGENTS.md`, loaded through its one-line `<area>/CLAUDE.md` shim. Edit the AGENTS.md, never the shim.

## When and where to persist a new rule

When you discover something during a task that was **extremely hard to find, deeply non-obvious, and would save significant time in future sessions**, persist it. This also applies when the user says **"every time"**, **"always"**, or **"never"**: persist it immediately rather than applying it only for the current session.

- A rule that guides **AI behavior or coding decisions** -> `AGENTS.md`.
- A **procedure** ("how to do X") -> a skill.
- A **new** architectural pattern or cross-cutting standard -> a new ADR; a **change** to an existing pattern -> update that ADR in place. The **adr-checker** agent writes both.
- A **repeatable shell action triggered by a tool event** -> a Claude Code hook in `.claude/settings.json`.

**Also add** a rule whenever the codebase does something in a way that diverges from what an AI would naturally write. If the correct approach here is not the standard/obvious one, a future agent will implement it the wrong way without an explicit rule.

**Do NOT add:** standard patterns found via normal code reading, things already covered by existing rules or discoverable via search, one-off context unlikely to recur. The bar is high: if a future agent could reasonably figure it out within a few minutes of exploration, don't add it.
