# Agent Guide

## Scope

This file applies to the whole repository. More specific instructions live in nested `AGENTS.md`
files and apply to their directory trees:

- `apps/desktop/AGENTS.md` - Electron desktop app, renderer UI, IPC, and app-local commands.
- `packages/pr-watch/AGENTS.md` - private PR watch package, CLI, fixtures, and package-local tests.

When changing files in a nested workspace, read this file first, then read the nearest workspace
`AGENTS.md` before editing.

## Project Purpose

pr-rosey is a local-first Electron desktop app for monitoring the current GitHub user's open pull
requests. Future product work may inspect CI state and generate useful prompts for external AI
coding agents, but the app must not use a hosted backend or mutate a user's repositories without an
explicit approved capability gate.

## Current Product Boundaries

- No GitHub OAuth, hosted auth, hosted backend, or team accounts.
- No automatic commits, pushes, merges, PR comments, review-thread resolution, or CI reruns.
- No direct or unmanaged AI-agent execution.
- Agent execution work, when explicitly approved, must stay visible, logged, cancellable,
  capability-gated, and owned by the Electron main process.
- Keep app-specific architecture and UI rules in `apps/desktop/AGENTS.md`.
- Keep PR watch package rules in `packages/pr-watch/AGENTS.md`.

## Monorepo Layout

- `apps/desktop/` owns the Electron desktop application.
- `packages/pr-watch/` owns the private local-first PR watching package and CLI.
- `skills/` owns repo-local agent skills.
- `docs/` owns the docs map, active/paused/completed plans, and the current restart note.

Root-level files should coordinate the workspace, not hold app- or package-specific implementation
rules when a nearer `AGENTS.md` can own them.

## Commands

- `npm install` installs all workspace dependencies.
- `npm run dev` launches the desktop app through the root workspace script.
- `npm run build` builds the desktop app through the root workspace script.
- `npm run format` formats the repo with Biome.
- `npm run lint` checks formatting and lint rules with Biome.
- `npm run typecheck` typechecks the root and desktop workspace.
- `npm run check` runs lint, typecheck, and all workspace tests.
- `npm test -- --run` runs Vitest once across workspaces.
- `npm run pr-watch -- <args>` runs the PR watch CLI wrapper.

Prefer root scripts for repo-wide verification. Use workspace scripts for targeted iteration when a
workspace `AGENTS.md` lists them.

## Coding Conventions

- Use TypeScript throughout.
- Keep architecture boring, explicit, and local-first.
- Prefer small modules with clear ownership over broad abstractions.
- Do not add dependencies unless they remove real complexity for the approved work item.
- Use Vitest only where it adds useful confidence.
- Avoid unrelated refactors and metadata churn.

## Operating Loop

The harness has three jobs: state what is allowed, state the current work, and prove the work
passed. Keep it small.

Before product or workflow changes:

- Read this file, `docs/README.md`, `docs/progress.md`, and the relevant active plan.
- Read the nearest nested `AGENTS.md` before changing a workspace under `apps/` or `packages/`.
- If no active plan fits, stop and ask before starting broad product work.

During work:

- Make the smallest coherent change that satisfies the approved scope.
- Prefer working behavior and targeted verification over speculative docs.
- Update docs only when they change the next agent's decision, constraints, or verification path.

After work:

- Run the validation named by the plan or the smallest meaningful check for maintenance changes.
- Update `docs/progress.md` only with the current restart state, known risk, and next step.
- Stop after the approved work item; do not continue to adjacent work without approval.

## Agent Skills

Repo-local skills live under `skills/`.

- Implementing agents should use `skills/pr-rosey-implementer/SKILL.md`.
- Review agents should use `skills/pr-rosey-reviewer/SKILL.md`.
- PR babysitting agents should use `skills/pr-watch-skill/SKILL.md`.
- If the agent runtime does not auto-discover repo-local skills, read the relevant `SKILL.md`
  directly before starting.

Use `skills/pr-rosey-reviewer/SKILL.md` when a separate review is required.

Separate review is required for product behavior, GitHub interaction, runner or agent execution,
IPC, persistence, credentials, local system access, and security boundaries. It is optional for docs
cleanup, fixture-only changes, copy edits, and mechanical refactors when checks pass and risk is
low.

## Testing And Check Expectations

Before reporting product implementation complete, run `npm run check`. If Electron behavior
changed, also launch the app with `npm run dev` and verify the relevant screen manually.

Documentation-only changes may use the smallest meaningful check, but report exactly what was and
was not run.

## Human In The Loop

This repo is built through approval-gated product increments. Stop after each approved work item,
report the acceptance criteria, and wait for explicit human approval before continuing to future
product work.

Agents must not continue to future product work without explicit human approval.
