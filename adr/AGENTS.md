# adr/AGENTS.md

Conventions for Architecture Decision Records (ADRs) in this repo. This one file covers both ADR tiers (root and per-project); the `web-projects/<project>/adr/` folders do not have their own `AGENTS.md`.

## What an ADR is

An ADR records the **why** behind an architectural choice that has trade-offs worth preserving, so a future reader (human or agent) does not re-litigate a settled decision or undo it by accident. It is not a design doc, a spec, or a how-to. If a choice has no real alternative and no trade-off, it does not need an ADR.

Each ADR uses three sections: **Context** (the problem and the constraints), **Decision** (what was chosen, with the main rejected alternative and why), **Consequences** (what this makes better and the trade-offs it accepts). Copy `TEMPLATE.md` to start a new one.

## Living, update-in-place

ADRs are living documents. When a change affects a decision, update its ADR in place so it always describes the current design. Do **not** create successor ADRs or "superseded by" chains, and do not mark an ADR as superseded; history lives in git.

## Numbering (two tiers)

- **Root `adr/`** -- main-site and cross-cutting decisions (including web-project-wide patterns like URL-as-state or localStorage). Numbered **globally**. Gaps are fine: numbers are stable identifiers and are **never reused**. Use the next free global number.
- **`web-projects/<project>/adr/`** -- decisions specific to one web-project. Numbered **per project** from `0001`.

Filenames are `NNNN-kebab-case-title.md`.

## Referencing convention

Inside a project, `ADR 000N` means that project's own ADR; a root ADR is written `root ADR 00NN`. When referencing a project ADR from elsewhere, name the project so the number is unambiguous (path, or "rps-mind-reader ADR 0001"). Links always use the full path.

## Index

The root `AGENTS.md` holds a master index of every ADR (root table + per-project table). Both tables must reflect the actual contents of `adr/` and every `web-projects/*/adr/`.

## Maintaining ADRs

Use the **adr-checker** subagent: in **consult mode** before implementing anything that touches an area an ADR covers, and in **maintain mode** after such changes to create or update the ADR and keep the index tables in sync.
