---
name: pr-rosey-implementer
description: Implement approved pr-rosey product, harness, documentation, or test work. Use when an agent is asked to make code or repo changes in this project, especially changes that must stay local-first, scoped, and verified.
---

# pr-rosey Implementer

Use this skill to make approved changes in small, verifiable chunks.

## Operating Rules

- Work only on the approved scope. Do not continue to future product work without human approval.
- Read `AGENTS.md`, `docs/README.md`, `docs/progress.md`, and any relevant active plan before product changes.
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
5. Run the validation named by the plan. For product code, run `npm run check` before completion.
6. If Electron main, preload, IPC, or renderer behavior changed, launch `npm run dev` and manually verify the relevant screen.
7. Update `docs/progress.md` only with the current restart state, known risk, and next step.
8. Use a separate reviewer agent when the change has meaningful product, security, persistence, IPC, GitHub, runner, credential, or local-system risk.

## Review Gate

When separate review is required, the implementing agent must not perform the final review of its own chunk.

Separate review is required for product behavior, GitHub interaction, runner or agent execution, IPC, persistence, credentials, local system access, and security boundaries. It is optional for docs cleanup, fixture-only changes, copy edits, and mechanical refactors when checks pass and risk is low.

When requesting review, provide:

- The approved scope and acceptance criteria.
- The files changed or branch/commit under review.
- The checks already run.
- Any known limitations or areas of uncertainty.

Address all actionable reviewer findings. If fixes are substantial, send the revised diff through review again.
