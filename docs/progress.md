# Progress

## Current State

- Step 1 app shell and dependency readiness are the current implemented product scope.
- The app checks local `gh`, `gh auth status`, and `git` readiness from the Electron main process.
- Results flow to the renderer through the typed preload IPC boundary.
- PR discovery, CI inspection, prompt generation, GitHub OAuth, hosted services, team accounts, and
  direct AI-agent execution remain out of scope.

## Latest Handoff

- Harness docs now live under `docs/`.
- `docs/harness.md` is the source of truth for the minimal development loop.
- Current and future approved step specs should live under `docs/steps/`.
- The harness explicitly prefers working code, iteration, and verification before documentation.

## Verification

- Harness update verified with `npm run check`.
