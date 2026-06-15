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
- `docs/` owns durable project notes, active plans, and handoff receipts.

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

## Harness

Use `docs/harness.md` as the current product-development harness. Product work should follow:

1. Working code.
2. Iteration and verification.
3. Independent review by a separate agent.
4. Minimal documentation of what changed and what remains.

Use `docs/README.md` as the documentation map. Read any active work item under
`docs/plans/active/` before making product changes. Keep documentation thin and practical; do not
block useful implementation on speculative docs.

## Agent Skills

Repo-local skills live under `skills/`.

- Implementing agents should use `skills/pr-rosey-implementer/SKILL.md`.
- Review agents should use `skills/pr-rosey-reviewer/SKILL.md`.
- PR babysitting agents should use `skills/pr-watch-skill/SKILL.md`.
- If the agent runtime does not auto-discover repo-local skills, read the relevant `SKILL.md`
  directly before starting.
- The review gate must be performed by a separate agent from the implementer. The implementing agent
  can coordinate the review and fix findings, but must not review its own completed chunk.

## Testing And Check Expectations

Before reporting implementation work complete, run `npm run check`. If Electron behavior changed,
also launch the app with `npm run dev` and verify the relevant screen manually.

Documentation-only changes may use the smallest meaningful check, but report exactly what was and
was not run.

## Human In The Loop

This repo is built through approval-gated product increments. Stop after each approved work item,
report the acceptance criteria, and wait for explicit human approval before continuing to future
product work.

Agents must not continue to future product work without explicit human approval.
