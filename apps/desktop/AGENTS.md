# Desktop App Agent Guide

## Scope

This file applies to `apps/desktop/`. Follow the root `AGENTS.md` first, then these desktop-specific
rules.

## Product Surface

The desktop app owns the local Electron experience for the current GitHub user's pull requests:

- App shell and dependency readiness.
- Local dependency checks for `gh`, `gh auth status`, `git`, and approved runner dependencies.
- Authenticated-user PR discovery through the local GitHub CLI.
- CI status rollups and manual refresh.
- Browser handoff for opening PR URLs.
- Approved, visible, cancellable runner surfaces only when covered by an active work item.

Do not add GitHub OAuth, hosted services, team accounts, background automation, remote mutations, or
new runner capabilities unless an active approved plan explicitly includes them.

## Commands

From the repo root, prefer:

- `npm run dev` - launch the desktop app.
- `npm run build` - build the desktop app.
- `npm run check` - run repo-wide lint, typecheck, and tests.

For targeted desktop iteration, use:

- `npm run dev --workspace @pr-rosey/desktop`
- `npm run build --workspace @pr-rosey/desktop`
- `npm run typecheck --workspace @pr-rosey/desktop`
- `npm run test --workspace @pr-rosey/desktop -- --run`

If Electron main, preload, IPC, or renderer behavior changed, launch the app with `npm run dev` and
manually verify the relevant screen before reporting completion.

## Architecture Boundaries

- `src/main/` owns Electron lifecycle, local system access, shell commands, GitHub CLI calls, runner
  process supervision, and app-data persistence.
- `src/preload/` owns the typed bridge. Expose one typed method per IPC operation and do not expose
  raw `ipcRenderer`, broad channel senders, Node modules, or main-process services.
- `src/shared/` owns serializable IPC contracts, domain types, and pure helpers that are safe to
  import from main, preload, renderer, and tests.
- `src/renderer/` owns React UI, visual state, and user interaction.
- `src/styles/` owns shared styling tokens for primitive UI elements.

Keep imports directional: main, preload, and renderer may import from shared; renderer may import
from styles; shared imports from no app layer; renderer never imports Electron, Node system modules,
`src/main/`, or `src/preload/`.

## Main, Preload, Shared, Renderer

- Keep `src/main/index.ts` focused on Electron lifecycle, window creation, and handler
  registration. Move local system access into small main-process service modules.
- Keep `src/preload/index.ts` as the narrow bridge to `window.prRosey`.
- Keep `src/shared/` serializable and side-effect light.
- Keep `src/renderer/main.tsx` as React bootstrapping only.
- Keep `src/renderer/App.tsx` as composition for the current single-window experience until named
  regions, state, or reuse make a split clearer.
- Prefer renderer feature folders such as `src/renderer/features/pull-requests/` when a feature
  owns components, hooks, helpers, or tests.
- Put truly shared renderer UI in `src/renderer/components/` only after at least two features need
  the same behavior-rich component. Styling-only reuse belongs in `src/styles/tokens.ts`.

## Frontend Consistency Rules

Use `docs/frontend.md` for renderer styling, component-selection, badge, status, tag, metadata,
token, state, and frontend dependency guidance.

### Tokens First

Before writing Tailwind classes on a primitive HTML element, check `src/styles/tokens.ts`. If a token
covers the element, import and use it. Do not inline equivalent classes.

### Components

Extract a component when it has meaningful local state, is reused, represents a named UI region, or
makes the parent materially easier to scan.

Do not split components just to split them. If something is only styled, use a token. Do not create
wrapper components that only apply CSS.

### Tokens

If the same Tailwind class string appears more than once for the same element type, add it to
`src/styles/tokens.ts` instead. Do not create a token for a one-off style.

### Do Not

- Do not add new dependencies to add UI components.
- Do not create a component file for something used in one place unless size, state, or behavior
  makes that file boundary clearer.
- Do not restyle an existing primitive element in a way that diverges from its token without
  flagging it as a deliberate deviation.

## Tests

- Co-locate tests with the module or feature they verify when that keeps ownership obvious.
- Use `src/shared/*.test.ts` for pure shared helpers.
- Put renderer-feature tests beside their feature once renderer behavior needs tests.
- Use fake main-process services or fixtures for shell, GitHub CLI, runner, and filesystem behavior
  whenever that gives deterministic coverage.
