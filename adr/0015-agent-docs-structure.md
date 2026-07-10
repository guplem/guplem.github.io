# ADR 0015: AGENTS.md + CLAUDE.md-shim agent docs, with skills, subagents, and living ADRs

## Context

The root agent map lived in a standalone `CLAUDE.md` read only by Claude Code, with reusable procedures under `.claude/commands/`. Seven area-specific child `CLAUDE.md` files (`data/`, `js/layoutBuilder/`, `js/planetSimulation/`, `web-projects/`, and the `liga-under-tkd`, `rps-mind-reader`, and `street-name-history` projects) held per-area guidance that Claude Code auto-loads on demand when working in those directories.

The personal-repo standard established in `guplem/Things` (its PR #11, adapted from the Galtea monorepo) uses a root `AGENTS.md` as the always-loaded map with a one-line `CLAUDE.md` shim, on-demand skills, subagents, and living ADRs. Adopting it here means applying the same `AGENTS.md` + shim pattern at every level, not only the root.

## Decision

- The root map is `AGENTS.md`; the root `CLAUDE.md` is a one-line `@AGENTS.md` shim.
- Area docs are `<area>/AGENTS.md` + one-line `<area>/CLAUDE.md` shim pairs, loaded on demand via the shim. A nested `AGENTS.md` alone does not load in Claude Code; the sibling `CLAUDE.md` shim is what triggers on-demand loading, so both files are required.
- Skills live committed at `.claude/skills/<name>/SKILL.md`; the former `.claude/commands/*.md` moved there unchanged (same mechanism, canonical location). All skills are model-invocable.
- Subagents stay at `.claude/agents/<name>.md`; ADRs stay in the existing two-tier layout (root `adr/` + `web-projects/<project>/adr/`), indexed in `AGENTS.md`, and are living documents updated in place (the earlier "mark as superseded" convention is retired).

**Rejected alternative:** content-bearing nested `CLAUDE.md` files (the previous layout). Rejected because they create a second naming convention, and tools that read `AGENTS.md` natively cannot see them.

## Consequences

**Positive:** the root map is readable by any AGENTS.md-aware tool; procedures load on demand; area docs keep their on-demand loading behaviour through the shim.

**Trade-offs and follow-up:** two file names now coexist by design at every level (`AGENTS.md` holds the content, `CLAUDE.md` is the shim); the `write-ai-instructions` skill records the rule so future agents do not "fix" it by deleting a shim or editing it. If another agent tool is adopted, move skills to a canonical `.agents/skills/` tree with a mirror and sync script, as the Galtea monorepo does.
