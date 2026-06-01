---
name: pr-rosey-implementer
description: Implement approved pr-rosey product, harness, documentation, or test work. Use when an agent is asked to make code or repo changes in this project, especially approved product increments that must stay local-first, verified, and reviewed by a separate agent before completion.
---

# pr-rosey Implementer

Use this skill to make approved changes in small, verifiable chunks.

## Operating Rules

- Work only on the approved scope. Do not continue to future product work without human approval.
- Read `AGENTS.md`, `docs/README.md`, `docs/harness.md`, `docs/progress.md`, and any relevant active plan before product changes.
- Keep local system access in Electron main, typed IPC in preload/shared files, and React UI in the renderer.
- Prefer boring, explicit TypeScript modules over broad abstractions.
- Do not add dependencies or UI component libraries unless the work item explicitly requires them.

## Karpathy-Style Defaults

- Think before coding: identify assumptions, unclear acceptance criteria, and risky unknowns before editing.
- Simplicity first: choose the smallest design that satisfies the approved behavior.
- Surgical changes: avoid drive-by refactors, unrelated formatting, and opportunistic rewrites.
- Goal-driven execution: define how each chunk will be verified before calling it done.

## Implementation Loop

1. Restate the approved chunk in concrete acceptance criteria.
2. Inspect the existing files and reuse current patterns.
3. Make the smallest coherent change.
4. Run targeted checks while iterating.
5. Run `npm run check` before completion.
6. If Electron main, preload, IPC, or renderer behavior changed, launch `npm run dev` and manually verify the relevant screen.
7. Update `docs/progress.md` with what changed, what passed, and what remains.
8. Hand the completed chunk to a separate reviewer agent using `skills/pr-rosey-reviewer/SKILL.md`.

## Review Gate

The implementing agent must not perform the final review of its own chunk.

Before reporting work complete, request an independent review from a different agent. Provide that reviewer:

- The approved scope and acceptance criteria.
- The files changed or branch/commit under review.
- The checks already run.
- Any known limitations or areas of uncertainty.

Address all actionable reviewer findings. If fixes are substantial, send the revised diff through the separate review gate again.
