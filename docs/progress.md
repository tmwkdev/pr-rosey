# Progress

## Current State

- App shell and dependency readiness are the current implemented product scope.
- The app checks local `gh`, `gh auth status`, and `git` readiness from the Electron main process.
- Results flow to the renderer through the typed preload IPC boundary.
- PR discovery, CI inspection, prompt generation, GitHub OAuth, hosted services, team accounts, and
  direct AI-agent execution remain out of scope.

## Latest Handoff

- Harness docs now live under `docs/`.
- `docs/harness.md` is the source of truth for the minimal development loop.
- `docs/README.md` is the map for product, architecture, plans, and progress docs.
- Approved work items should live under `docs/plans/active/` while they are being implemented and
  move to `docs/plans/completed/` only when the history remains useful.
- The harness explicitly prefers working code, iteration, and verification before documentation.

## Verification

- Harness update verified with `npm run check`.
