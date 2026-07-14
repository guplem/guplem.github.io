# adr/AGENTS.md

This directory holds the Architecture Decision Records (ADRs) for guplem.github.io. This one file covers both ADR tiers (root and per-project); the `web-projects/<project>/adr/` folders do not have their own `AGENTS.md`.

## What is an ADR?

An ADR records one architectural decision or cross-cutting standard, with its context, the decision, and its consequences. It captures the **why** behind a choice that has trade-offs worth preserving, so a future reader (human or agent) does not re-litigate a settled decision or undo it by accident. It answers "how do we always do X here": no build system, URL query params as the source of truth for shareable web-projects, `localStorage` for private-session persistence.

An ADR is **not** a feature explanation, a design doc, a spec, or a setup guide. How the project works and how to run it belongs in `README.md`. See the "Documentation Structure" section of the root `AGENTS.md` for the full map of what goes where. A choice with no real alternative and no trade-off does not need an ADR.

Each ADR uses three sections: **Context** (the problem and the constraints), **Decision** (what was chosen, with the main rejected alternative and why), **Consequences** (what this makes better and the trade-offs it accepts). Copy `TEMPLATE.md` to start a new one.

## ADRs are living: update, do not supersede

One ADR describes one pattern for its whole life. When a change affects a decision, **edit that ADR in place** so it always describes the current design. Do not create a successor ADR, a "superseded by" chain, or mark an ADR as superseded; history lives in git.

Create a **new** ADR only when a genuinely new pattern appears that no existing ADR covers. Most changes need no ADR at all. Add a short inline "Rejected alternative" note only when the old approach is easy to fall back into and harmful.

## Numbering (two tiers)

- **Root `adr/`** -- main-site and cross-cutting decisions (including web-project-wide patterns like URL-as-state or localStorage). Numbered **globally**. Gaps are fine: numbers are stable identifiers and are **never reused**. Use the next free global number.
- **`web-projects/<project>/adr/`** -- decisions specific to one web-project. Numbered **per project** from `0001`.

Filenames are `NNNN-kebab-case-title.md` and are never renumbered. Use `TEMPLATE.md` as the starting point.

## Referencing convention

Inside a project, `ADR 000N` means that project's own ADR; a root ADR is written `root ADR 00NN`. When referencing a project ADR from elsewhere, name the project so the number is unambiguous (path, or "rps-mind-reader ADR 0001"). Links always use the full path.

## What does NOT warrant an ADR

- A change that fits an existing ADR: **update that ADR** instead of writing a new one.
- Standard library or framework usage, one-off bug fixes, minor refactors.
- A choice with no real alternative and no trade-off.
- Anything a reader can derive from the code or from `README.md`.

## Index

The root `AGENTS.md` holds a master index of every ADR (root table + per-project table). Both tables must reflect the actual contents of `adr/` and every `web-projects/*/adr/`.

## Creating or updating an ADR

Use the **adr-checker** subagent: in **consult mode** before implementing anything that touches an area an ADR covers, and in **maintain mode** after such changes to create or update the ADR and keep the index tables in sync. It enforces the full rules: one decision per ADR, at most two pages, alternatives with their rejection rationale, update-in-place, and the code stays the source of truth.
