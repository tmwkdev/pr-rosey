# Progress

## Current State

- App shell, dependency readiness, and authored open PR display are the current implemented product
  scope.
- The app checks local `gh`, `gh auth status`, and `git` readiness from the Electron main process.
- The app identifies the authenticated `gh` user, fetches authored open PRs through GitHub GraphQL
  search, includes draft PRs, and displays repository, title, number, URL, draft status, source
  branch, and updated timestamp.
- Results flow to the renderer through the typed preload IPC boundary.
- CI inspection, prompt generation, GitHub OAuth, hosted services, team accounts, and direct
  AI-agent execution remain out of scope.
- The harness now requires a separate reviewer agent after each completed implementation chunk.
- The harness now names pre-flight, revision, escalation, and abort gates so future workflow changes
  can describe failure behavior without adding orchestration machinery.
- Completed work now leaves a compact receipt in `docs/progress.md`: approved scope, files changed,
  checks run, manual Electron verification when relevant, reviewer outcome, and remaining risk.
- Repo-local agent skills live under `skills/` and separate implementer workflow from reviewer
  workflow.
- GitHub Actions now includes a minimal pull-request static-analysis workflow that installs with
  `npm ci` and exposes lint and typecheck as separate CI steps.

## Latest Handoff

- Added `.github/workflows/static-analysis.yml` for PR-only static analysis.
- The workflow uses `actions/checkout@v4`, `actions/setup-node@v4` with Node 24 and npm caching,
  `npm ci`, `npm run lint`, and `npm run typecheck`.
- Moved the approved work-item receipt to
  `docs/plans/completed/github-actions-static-analysis.md`.
- Separate-agent review found no issues after removing an extra manual trigger and keeping the
  workflow scoped to pull requests only.
- GitHub ran the workflow on PR #3 and `Static Analysis / Lint and typecheck` passed.
- `actionlint` was not run locally.
- Source imports now use the `@/` alias for app-local modules instead of relative paths.
- TypeScript, Vite, Electron Vite, and Vitest are configured to resolve `@/` to `src/`.
- Electron source typechecking now uses TypeScript bundler resolution, matching the electron-vite
  build path for bundled main and preload code.
- `src/renderer/App.tsx` was reorganized into named in-file regions for the app header, readiness
  sidebar, PR panel, PR list rows, error/empty states, and readiness footer while preserving the
  existing renderer behavior.
- `src/styles/tokens.ts` now includes repeated text, stat-row, and detail-stack tokens used by the
  renderer cleanup; one-off styles remain inline per the frontend guidance.
- Separate-agent review found one low tokenization issue around one-off tokens; those tokens were
  removed and the styles were inlined.
- Step 2 implemented authored open PR discovery using `gh api user` followed by paginated
  `gh api graphql` search for `is:pr is:open author:<login> sort:updated-desc`.
- Manual PR refresh and PR URL browser handoff are exposed through the typed preload IPC API.
- Discovery currently follows GitHub search behavior and returns up to 1,000 matching PRs because
  the service pages 10 GraphQL search pages of 100 nodes.
- Harness docs now live under `docs/`.
- `docs/harness.md` is the source of truth for the minimal development loop.
- `docs/README.md` is the map for product, architecture, plans, and progress docs.
- Approved work items should live under `docs/plans/active/` while they are being implemented and
  move to `docs/plans/completed/` only when the history remains useful.
- The harness explicitly prefers working code, iteration, and verification before documentation.
- Agent workflow now follows a Karpathy-style setup: think before coding, simplicity first, surgical
  changes, and goal-driven verification.
- `docs/harness.md` now includes persisted frontend practices for component decomposition, local
  state, typed shared models, token-first Tailwind usage, and dependency discipline as `App.tsx`
  grows.
- `docs/harness.md` now includes Electron/React source-layout guidance: process-first Electron
  folders, a narrow typed preload bridge, safe shared contracts, feature-co-located renderer growth,
  pragmatic component file boundaries, and directional import rules.
- Separate-agent review found no issues with the source-layout harness update.
- The renderer source-layout refactor moved dependency readiness and authored PR UI/state into
  feature folders while keeping `App.tsx` as the single-window composition layer.
- Separate-agent review found no issues with the renderer source-layout refactor.
- Harness research against Hermes Agent, OpenClaw, and Awesome Harness Engineering reinforced the
  current direction: compact root policy, focused docs, small skills, explicit gates, proof-first
  validation, and no durable autonomy runtime before an approved work item.
- `docs/harness.md` now includes harness gate vocabulary and an autonomy-readiness section.
- `docs/plan-template.md` now asks each future work item to name touched surfaces, capability
  budget, and autonomy impact before implementation starts.

## Verification

- For the absolute-import cleanup, `npm run format`, `npm run check`, and `npm run build` passed.
- For the absolute-import cleanup, `npm run dev` built Electron main/preload, started the renderer
  dev server on `http://localhost:5173/`, and reached Electron app startup before being stopped.
- Separate-agent review was not run for the absolute-import cleanup in this turn.
- For the latest renderer source-layout refactor, the implementer ran `npm run format`,
  `npm run check`, and a terminal-level `npm run dev` Electron smoke launch.
- Separate-agent review independently ran `npm run check`; Biome, TypeScript, and Vitest passed.
- Electron UI verification for the latest renderer source-layout refactor remains limited to the
  implementer's terminal-level smoke launch; no browser automation was run for the Electron window.
- For the latest source-layout harness update, `npm run check` passed.
- Separate-agent review independently ran `npm run check`; Biome, TypeScript, and Vitest passed.
- `npm run dev` was not launched for the latest source-layout harness update because app behavior
  did not change.
- For the GitHub Actions static-analysis workflow, `npm run check` passed after implementation and
  after the final PR-only trigger adjustment.
- Separate-agent review independently ran `npm run check`; Biome, TypeScript, and Vitest passed.
- GitHub Actions reported success for `Static Analysis / Lint and typecheck` on PR #3.
- `npm run dev` was not launched for the GitHub Actions workflow because Electron behavior did not
  change.
- For the latest frontend component cleanup, `npm run format` passed.
- For the latest frontend component cleanup, `npm run check` passed.
- For the latest frontend component cleanup, `npm run dev` launched the Electron dev server/app
  without terminal runtime errors; it was then stopped with Ctrl-C.
- For the latest documentation-only harness update, `npm run format` passed.
- For the latest documentation-only harness update, `npm run check` passed.
- `npm run dev` was not launched for the latest update because app behavior did not change.
- Prior product verification included `gh api user --jq .login`, a valid GraphQL search response,
  `npm run check`, and `npm run dev` launching the Electron app without terminal runtime errors.
