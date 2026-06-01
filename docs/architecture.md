# Architecture

pr-rosey uses a boring Electron split with explicit ownership boundaries.

## Layers

- `src/main/` owns Electron lifecycle, local system access, shell commands, and future GitHub CLI
  interactions.
- `src/preload/` exposes the typed bridge from Electron main to renderer.
- `src/renderer/` owns React UI, visual state, and user interaction.
- `src/shared/` owns serializable types and pure helpers that are safe across the IPC boundary.
- `src/styles/` owns shared styling tokens for primitive UI elements.

## IPC Boundary

- IPC channel names and exposed API types live in `src/shared/ipc.ts`.
- Preload exposes a narrow `window.prRosey` API.
- Renderer code should call preload APIs and should not import Electron, Node system modules, or
  main-process services directly.

## Current Flow

1. Renderer asks `window.prRosey.dependencies.check()` to run readiness checks.
2. Preload invokes the typed `dependencies:check` IPC channel.
3. Main process handles the request and runs dependency checks.
4. Main process returns serializable readiness results to the renderer.
5. Renderer asks `window.prRosey.pullRequests.fetchAuthoredOpen()` for the current PR list.
6. Main process identifies the authenticated GitHub user through `gh api user`.
7. Main process queries GitHub through `gh api graphql` and returns serializable PR summaries.
8. Renderer asks `window.prRosey.pullRequests.openUrl(url)` when the user opens a PR.
