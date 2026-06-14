# @pr-rosey/pr-watch

Private package for local-first GitHub pull-request watching.

## Boundary

- Owns PR watch domain types, decision policy, GitHub CLI reads, local state, locks, fixtures, tests,
  and the JSON-emitting CLI.
- Does not know about Electron, React, preload IPC, renderer state, hosted services, or coding-agent
  execution.
- Does not perform GitHub writes such as merging, commenting, resolving review threads, rerunning CI,
  or pushing branches.

## Layout

- `src/types.ts` - serializable report, snapshot, state, and decision contracts
- `src/decision.ts` - pure action selection policy
- `src/githubClient.ts` - `gh` collection and normalization
- `src/state.ts` - local JSON state persistence and state transitions
- `src/lock.ts` - concurrent-watch lock directories
- `src/watch.ts` - one-shot evaluation primitive
- `src/cli.ts` - command-line parsing and JSON output
- `fixtures/` - scenario snapshots used by tests

The repo-local skill in `skills/pr-watch-skill/` explains how agents should use this package. Its
script is only a compatibility wrapper.
