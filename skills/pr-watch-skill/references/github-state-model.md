# GitHub State Model

The watcher keeps a small local state file, defaulting to `.pr-rosey/pr-watch-state.json`.

## Stored State

- `seenFeedbackIds`: submitted comments and reviews already surfaced to the user
- `retryCountBySha`: retry recommendations already used for each PR head SHA
- `activeWatches`: reserved for visible watch-session metadata

The state file is local-only. It is not a hosted backend, shared queue, or team account store.

## Watch Locks

By default, the CLI creates a lock directory next to the state file before live GitHub reads. If the
lock already exists, the CLI exits with a warning. This prevents two local processes from trying to
manage the same PR at once.

Use `--no-lock` only for intentional one-off inspection. Fixture mode does not create locks.

## Freshness Rules

- Each evaluation reloads PR lifecycle, head SHA, mergeability, review state, comments, and checks
  from `gh`.
- Decisions use only checks associated with the current head SHA.
- A changed head SHA resets retry accounting because the branch content changed.
- Future write actions must reload state immediately before writing and must refuse stale SHA input.

## Local-First Boundary

The skill relies on the local `gh` authentication context. It does not require OAuth setup in
pr-rosey, a token service, a hosted coordinator, or access to organization/team accounts beyond what
the current `gh` user already has.

