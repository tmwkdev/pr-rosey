# PR Watch Package Agent Guide

## Scope

This file applies to `packages/pr-watch/`. Follow the root `AGENTS.md` first, then these
package-specific rules.

## Package Boundary

`@pr-rosey/pr-watch` is a private local-first package for GitHub pull-request watching.

It owns:

- PR watch domain types and serializable report contracts.
- Pure decision policy for selecting the next safe action.
- GitHub CLI reads and normalization.
- Local JSON state and retry-budget bookkeeping.
- Concurrent-watch locks.
- Fixture snapshots and package tests.
- JSON-emitting CLI behavior.

It must not know about Electron, React, preload IPC, renderer state, hosted services, or coding-agent
execution.

## Non-Mutating Rule

The package may inspect pull requests through local `gh` reads and fixtures. It must not perform
GitHub writes such as merging, commenting, resolving review threads, rerunning CI, pushing branches,
or editing remote state.

Any future write capability needs an explicit approved plan, a capability gate, tests, and user
visible behavior outside this package.

## Commands

From the repo root, prefer:

- `npm run pr-watch -- <pr-number> --repo <owner/repo> --pretty` for the root CLI wrapper.
- `npm exec --workspace @pr-rosey/pr-watch -- pr-watch -- <args>` to exercise the package bin.
- `npm run test --workspace @pr-rosey/pr-watch -- --run` for targeted package tests.
- `npm run check` before reporting implementation work complete.

Use fixtures for deterministic iteration before any live `gh` smoke. Report whether a live GitHub
CLI check was run.

## Layout

- `src/types.ts` - serializable report, snapshot, state, and decision contracts.
- `src/decision.ts` - pure action selection policy.
- `src/githubClient.ts` - `gh` collection and normalization.
- `src/state.ts` - local JSON state persistence and state transitions.
- `src/lock.ts` - concurrent-watch lock directories.
- `src/watch.ts` - one-shot evaluation primitive.
- `src/cli.ts` - command-line parsing and JSON output.
- `fixtures/` - scenario snapshots used by tests.

Keep package internals boring and explicit. Prefer pure helpers with fixture coverage for policy
changes and small boundary modules for filesystem, lock, and GitHub CLI behavior.

## Skill Integration

The repo-local PR babysitting skill in `../../skills/pr-watch-skill/` explains how agents should use
this package. The skill script is a compatibility wrapper; package behavior should live here.
