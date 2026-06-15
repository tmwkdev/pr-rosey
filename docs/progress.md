# pr-rosey Progress

This file is the latest restart surface for the next agent session. Keep it short:
current verified state, known risk, and the next approved step. Move durable history
into `docs/plans/completed/` when it matters later.

## 2026-06-13 npm Workspaces Monorepo Receipt

- Approved scope: user-requested step one of going all in on a monorepo shape with top-level
  `apps/` and `packages/` directories using npm workspaces.
- Changed: made the root package a workspace coordinator for `apps/*` and `packages/*`; moved the
  Electron desktop app source, app configs, brand assets, and app package dependencies into
  `apps/desktop/`; kept `packages/pr-watch/` as a private workspace package; added workspace-local
  Vitest configs; and updated current layout guidance to point at
  `apps/desktop/src/`.
- Safety preserved: no product behavior, hosted backend, OAuth, GitHub mutations, direct
  AI-agent execution, commits, pushes, merges, or new UI dependencies were added.
- Verification: `npm install` completed and both workspaces are visible through `npm query
  .workspace`; `npm run check` passed with 42 tests; `npm run build` passed and emitted the desktop
  build under `apps/desktop/out`; root `npm run pr-watch` and workspace
  `npm exec --workspace @pr-rosey/pr-watch -- pr-watch` fixture smokes both passed; `npm run dev`
  launched Electron/Vite from the root script at `http://localhost:5173/`, and `curl -I` returned
  HTTP 200 before shutdown.
- Review: separate reviewer found no blocking issues and independently reran `npm run check`,
  `npm run build`, both PR watch smokes, and a dev-server HTTP smoke.
- Remaining risk: packaging/runtime behavior beyond the dev and build smoke was not manually
  inspected in an Electron window.

## 2026-06-11 PR Watch Package Boundary Receipt

- Approved scope: user-requested architecture treatment for `skills/pr-watch-skill/scripts/pr-watch.ts`
  so core PR watch functionality is ready for growth without overengineering.
- Changed: promoted PR watch code into private workspace package `packages/pr-watch/`, split the
  watcher into explicit TypeScript modules for contracts, decision policy, GitHub CLI collection,
  local state, locks, fixture loading, CLI parsing, and one-shot evaluation; moved fixtures and tests
  with the package; kept `skills/pr-watch-skill/scripts/pr-watch.ts` as a compatibility wrapper; and
  updated skill/docs references to point at the package boundary.
- Safety preserved: watcher behavior remains local-first, `gh`-read-based, fixture-testable, and
  non-mutating. No Electron, renderer, IPC, hosted backend, OAuth, AI-agent execution, GitHub write,
  merge, push, comment, review-thread resolution, or CI rerun behavior was added.
- Verification: `npm test -- --run packages/pr-watch/src/pr-watch.test.ts` passed with 16 tests;
  direct package CLI, root `npm run pr-watch`, workspace `npm exec`, and skill-wrapper fixture
  smokes all emitted `diagnose_branch_failure`; `npm run check` passed with 42 tests.
- Review: separate reviewer found the package `bin` path was advertised but not executable through
  `npm exec --workspace @pr-rosey/pr-watch -- pr-watch`; fixed by adding a Node shebang to the
  package CLI. Reviewer also flagged the need for this current package-boundary progress receipt.
- Remaining risk: no fresh live `gh` PR inspection was run for this architecture-only refactor;
  behavior was verified by fixture parity, CLI smokes, tests, and code review.

## 2026-06-11 Babysit App Surface Receipt

- Approved scope: user-reported follow-up that the app still only showed `Verify with Pi`, so the
  PR row needed a real Babysit action and the runner prompt needed to request PR babysitting rather
  than repository verification.
- Changed: PR rows now render `Babysit` / `Starting babysit`; the Pi runner hook exposes
  `startBabysit`; the session console empty/active copy says Babysit; the main-process Pi prompt now
  includes PR title, URL, author, head branch, CI summary, failing checks, pending checks, workspace
  path, and asks for a read-only `BABYSIT REPORT` with the next safe user-visible action.
- Safety preserved: Pi remains limited to read-only tools (`read`, `grep`, `find`, `ls`), and the
  prompt still forbids shell commands, edits, commits, pushes, merges, GitHub comments, CI reruns,
  and follow-up work.
- Verification: targeted Pi runner tests passed; `npm run check` passed with 42 tests; `npm run dev`
  launched Electron/Vite at `http://localhost:5173/`, and `curl -I` returned HTTP 200; built output
  scan confirmed `Babysit` and `BABYSIT REPORT` are present while `Verify with Pi` is absent.
- Review: separate reviewer found no findings and independently reran the targeted Pi tests plus
  `npm run check`.
- Remaining risk: in-app Browser visual DOM verification could not run because the Browser plugin
  reported `Browser is not available: iab`; verification used tests, dev launch smoke, HTTP 200, and
  built-output text scan.

## 2026-06-09 PR Watch Skill Receipt

- Approved scope: build an original repo-owned PR babysitting skill with TypeScript scripts,
  references, fixtures, tests, and a successful PR babysit run, using
  `docs/babysit-skill-goal.md` as the scorecard.
- Changed: added `skills/pr-watch-skill/` with concise skill instructions, a local-first
  `pr-watch.ts` CLI, stable structured JSON reports, pure fixture-testable decision logic, local
  seen-feedback and retry-budget state, concurrent-watch lock protection, CI/review/state
  references, and fixtures covering the required babysitting scenarios.
- Files changed: `skills/pr-watch-skill/**`, `package.json`, `tsconfig.json`, `AGENTS.md`,
  `docs/README.md`, `docs/babysit-skill-goal.md`, and this progress note.
- Verification: the then-current skill-local scenario suite passed with 16 tests; `npm run check`
  passed with 42 tests; live dogfood
  `npm run pr-watch -- 6 --repo tmwkdev/pr-rosey --pretty` captured PR #6, current head SHA
  `9085c72112a0903d3feeca17e96de978ebf85f4f`, the failed `Lint and typecheck` job URL, and selected
  `diagnose_branch_failure` without a GitHub mutation.
- Review: separate reviewer initially found cancelled/time-out checks could fall through to
  readiness and that state was not persisted. Fixed both with regression tests. Follow-up review
  found no findings and reran the focused skill tests plus `npm run check`.
- Adoption aid: added `docs/babysit-skill-adoption-review.md` so the remaining human similarity
  review has concrete pass/fail checks and file targets.
- Remaining risk: the required human/source similarity review against the OpenAI babysit-pr skill
  has not been performed. The implementation was written from the local scorecard and common GitHub
  CLI behavior without consulting the OpenAI source.

## 2026-06-07 Pi Chatbox Tool Display Receipt

- Approved scope: chat-approved follow-up to make the Pi session console behave like a normal AI
  chatbot and stop displaying tool calls, successful tool output, and file contents as human chat.
- Changed: reshaped `PiSessionConsole` around a conventional chat structure with a compact header,
  collapsible session details, one chronological feed, right-aligned user messages, left-aligned Pi
  messages, centered compact system activity, and a disabled `Message Pi` composer with no new IPC
  or steering behavior. Follow-up fix filters tool-only assistant messages and `toolResult` entries
  out of the renderer conversation, prevents successful tool result text from becoming activity
  summaries, hides noisy turn-start events, and collapses adjacent tool activity into a single
  compact `Pi used tools` row instead of pages of tool-call rows or machine-details cards.
- Files changed: `src/main/piRunnerService.ts`, `src/main/piRunnerService.test.ts`,
  `src/shared/piRunner.ts`, `src/shared/piRunner.test.ts`,
  `src/renderer/features/pi-runner/PiSessionConsole.tsx`, and this progress note.
- Verification: `npm test -- --run src/main/piRunnerService.test.ts src/shared/piRunner.test.ts`
  passed; `npm run check` passed; `npm run dev` launched Electron/Vite at
  `http://localhost:5174/` because 5173 was occupied; `curl -I http://localhost:5174/` returned
  HTTP 200 before shutdown.
- Review: independent reviewer found no findings for the updated normalization scope and reran the
  focused Pi runner tests successfully. Follow-up reviewer found and confirmed fixes for tool
  rollups crossing chat-message boundaries and for `Tool activity` names missing from compact
  summaries; reviewer reran `npm run check` successfully.
- Remaining risk: in-app Browser visual inspection could not run because the Browser plugin reported
  `Browser is not available: iab`; compact pill display was verified by code inspection and app
  launch smoke, not by a captured screenshot.

## 2026-06-06 Pi Repository Verification Receipt

- Approved scope: chat-approved first Pi integration checkpoint for clicking a PR-row action,
  spawning Pi in that PR repository, and showing visible evidence that the launch happened.
- Changed: added typed Pi runner IPC, a main-process `pi --mode rpc --no-session` subprocess
  boundary, trusted repository-mapping lookup and git-origin validation, read-only repository
  verification prompt dispatch, in-memory session snapshots, JSONL log file writes, abort support,
  a renderer polling hook, and a compact PR-row evidence panel with cwd, pid/session id, log path,
  recent output, status, and stop action.
- Files changed: `src/shared/piRunner.ts`, `src/shared/ipc.ts`, `src/main/piRunnerService.ts`,
  `src/main/piRunnerService.test.ts`, `src/main/index.ts`, `src/preload/index.ts`,
  `src/renderer/features/pi-runner/usePiRunnerSessions.ts`, `src/renderer/App.tsx`,
  `src/renderer/features/pull-requests/PullRequestsPanel.tsx`, and this progress note.
- Verification: targeted Pi runner tests passed; `npm run format && npm run check` passed;
  `npm run dev` built main and preload, launched Electron/Vite at `http://localhost:5173/`, and
  `curl -I /` returned HTTP 200 before shutdown.
- Review: separate-agent review found no blocking findings. Follow-up review flagged a minor abort
  lifecycle risk; fixed by keeping sessions in `aborting` state until the child process exits and by
  disabling Pi starts while any session is active. Final reviewer confirmation found no blocking
  findings.
- Remaining risk: this is not the full managed-worktree babysitter spike yet; Pi must already be
  installed/configured, mapped repositories are used directly instead of managed worktrees, and
  in-app Browser visual verification could not run because the Browser plugin reported
  `Browser is not available: iab`.

## 2026-06-06 Pi Session Console UI Receipt

- Approved scope: `docs/plans/active/pi-session-console-ui.md`, turning the mockup into a real
  selected-session console on the pull-request screen while keeping rows compact and steering
  disabled.
- Changed: added the Pi SDK package, moved the runner integration from subprocess/RPC stdout
  parsing to `AgentSession`, restricted Pi to read-only tools (`read`, `grep`, `find`, `ls`),
  added renderer-safe conversation messages and operational activity summaries, replaced long row
  output with compact last-activity evidence, added selected-session state, and added a split Pi
  session console with metadata, status, conversation, grouped activity, errors, exit state, stop
  path, and a disabled steering composer.
- Files changed: `src/shared/piRunner.ts`, `src/shared/piRunner.test.ts`,
  `src/main/piRunnerService.ts`, `src/main/piRunnerService.test.ts`,
  `src/renderer/features/pi-runner/usePiRunnerSessions.ts`,
  `src/renderer/features/pi-runner/PiSessionConsole.tsx`,
  `src/renderer/features/pull-requests/PullRequestsPanel.tsx`,
  `src/renderer/App.tsx`, `package.json`, `package-lock.json`, and this progress note.
- Verification: targeted Pi runner tests passed; `npm run lint`, `npm run typecheck`,
  `npm run check`, and `npm audit --omit=dev` passed; `npm run dev` launched Electron/Vite at
  `http://localhost:5173/`, and `curl -I /` returned HTTP 200.
- Review: separate-agent review found and confirmed fixes for read-only tool gating, failed
  AgentSession startup cleanup, and `agent_end.willRetry` handling. A follow-up review found no
  blocking findings and independently ran `npm run check`.
- Remaining risk: in-app Browser visual inspection and screenshot capture could not run because
  the Browser plugin reported `Browser is not available: iab`; no live Pi AgentSession run was
  visually inspected in the Electron window.

## 2026-06-05 Brand Asset Receipt

- Approved scope: chat-approved brand asset setup using the selected pr-rosey mascot concept.
- Changed: added reusable raster brand assets under `assets/brand/`, including concept-sheet crops
  and transparent-background variants; added the selected logo lockup as the top README header; and
  verified the existing Electron icon path points at the transparent app icon. Rebuilt the app icon
  with ImageMagick flood-fill transparency and extra canvas padding so macOS command-tab/Dock
  rendering has shadow space and no exterior white strip.
- Files changed: `README.md`, `assets/brand/*.png`, and this progress note.
- Verification: `npm run check` passed; `npm run dev` launched Electron/Vite on
  `http://localhost:5174/` because 5173 was occupied, and `curl -I` returned HTTP 200 before
  shutdown; `npm run build` passed and the built main bundle contains the app icon asset path.
- Review: separate-agent review found no code-boundary issues. It flagged that `assets/brand/`
  files are untracked until included in a commit and that native Dock/window icon display was not
  visually inspected.
- Remaining risk: assets are generated raster concept art, not final vector/logo production files.

## 2026-06-05 Repository Mapping Settings Receipt

- Approved scope: chat-approved settings increment for maintaining a mapping between GitHub remote
  repositories and trusted local clone paths, in support of the active managed-runner spike.
- Changed: replaced the settings placeholder with a repository mapping workflow, added typed
  repository-mapping IPC, added main-process local clone inspection and JSON persistence under
  Electron user data, and added shared normalization helpers plus service tests.
- Files changed: `src/shared/repositoryMappings.ts`, `src/shared/repositoryMappings.test.ts`,
  `src/main/repositoryMappingService.ts`, `src/main/repositoryMappingService.test.ts`,
  `src/main/index.ts`, `src/preload/index.ts`, `src/shared/ipc.ts`,
  `src/renderer/features/settings/SettingsPage.tsx`, `src/styles/tokens.ts`, and this progress
  note.
- Verification: targeted repository-mapping tests passed; `npm run check` passed; `npm run build`
  passed; `npm run dev` launched Electron/Vite on `http://localhost:5173/`, and `/` plus
  `/#settings` returned HTTP 200 before shutdown.
- Review: separate-agent review found a concurrent mutation race in repository-mapping persistence;
  fixed with per-user-data-path mutation serialization, unique temp files, and a concurrent
  save/remove regression test. Follow-up review found no remaining mapping-code findings.
- Remaining risk: in-app Browser visual verification could not run because the Browser plugin
  reported `Browser is not available: iab`; unrelated untracked binary asset directories
  `assets/` and `docs/brand/` remain outside this work item.

## 2026-06-05 Settings Page Placeholder Receipt

- Approved scope: chat-approved settings placeholder page that is distinct from the PR landing page
  and reachable via the typical native settings shortcut.
- Changed: added a native Electron Settings menu item with `CommandOrControl+,`, a typed one-way
  navigation IPC event, hash-based renderer page switching, and a placeholder settings page with a
  return link to pull requests.
- Files changed: `src/main/index.ts`, `src/preload/index.ts`, `src/shared/ipc.ts`,
  `src/renderer/App.tsx`, `src/renderer/features/settings/SettingsPage.tsx`, and this progress
  note.
- Verification: `npm run check` passed; `npm run dev` launched Electron/Vite and
  `http://localhost:5174/` returned 200 before shutdown.
- Review: separate-agent review found no blocking findings, reran `npm run check`, launched dev on
  `http://localhost:5175/` because 5173/5174 were occupied, and confirmed `/` plus `/#settings`
  returned HTTP 200.
- Remaining risk: native menu accelerator behavior was verified by code review and dev launch, not
  by an actual hotkey interaction; in-app Browser verification failed with
  `Browser is not available: iab`.

## 2026-06-05 PR List UI Simplification Receipt

- Approved scope: chat-approved renderer simplification based on GitHub/GitLab-style PR list
  references, reducing visual chrome while keeping hover/focus affordances for secondary detail and
  actions.
- Changed: collapsed the app toolbar into quiet counts and actions, made readiness a slimmer
  secondary strip, removed the PR table header/footer chrome, reshaped PR rows into cleaner list
  items, moved branch/check detail and row action visibility to hover/focus states, and added a quiet
  button token.
- Files changed: `src/renderer/App.tsx`,
  `src/renderer/features/pull-requests/PullRequestsPanel.tsx`,
  `src/renderer/features/readiness/ReadinessPanel.tsx`, `src/styles/tokens.ts`, and this progress
  note.
- Verification: `npm run check` passed; `npm run build` passed; `npm run dev` launched
  Electron/Vite and `http://localhost:5173/` returned 200 before shutdown.
- Review: separate-agent review found no blocking findings and independently ran `npm run check`.
  Reviewer also launched dev on `http://localhost:5174/` because 5173 was already in use, confirmed
  HTTP 200, and stopped that dev session.
- Follow-up: after PR screenshot review, draft PR rows no longer show a title-adjacent `Draft`
  label and use a grey PR-state dot instead of amber, matching common hoster status conventions.
- Remaining risk: no in-app Browser screenshot was captured because the Browser plugin reported
  `Browser is not available: iab`; hover/focus visuals were verified by code review and dev-server
  smoke evidence rather than screenshot inspection.

## 2026-06-04 Pi Managed Runner Planning Receipt

- Approved scope: chat-approved documentation plan for moving pr-rosey toward a Pi-backed managed PR
  runner using local worktrees and explicit capability gates.
- Changed: added `docs/agent-runner.md`, added active plan
  `docs/plans/active/pi-managed-pr-runner-spike.md`, updated product/harness boundaries so managed
  runner execution is allowed only when approved, and updated the docs map.
- Behavior changed: none; documentation-only planning and boundary update.
- Verification: `npm run check` passed.
- Review: separate-agent review was not performed for this docs-only planning update.

## 2026-06-03 Frontend Guidance Cleanup Receipt

- Approved scope: chat-approved renderer cleanup based on the updated frontend
  component guidance, with audit, implementation, and separate-agent review.
- Changed: added `docs/frontend-guidance-audit.md`, replaced inbox count badges
  with quiet metadata, changed readiness dependencies and CI state to
  status-dot-plus-label indicators, kept only `Draft` as a PR object badge, added
  local PR loading skeleton rows, and tightened status tokens away from generic
  pill/badge usage.
- Files changed: `docs/frontend-guidance-audit.md`,
  `src/renderer/features/pull-requests/PullRequestsPanel.tsx`,
  `src/renderer/features/readiness/ReadinessPanel.tsx`,
  `src/styles/tokens.ts`, and this progress note.
- Verification: `npm run check` passed; `npm run dev` launched Electron/Vite and
  `http://localhost:5173/` returned 200 before shutdown.
- Remaining risk: in-app Browser verification could not run because the
  Node/browser automation tool was not discoverable in this session.
- Review: separate-agent review found no behavior or boundary issues. Reviewer
  noted `docs/frontend-guidance-audit.md` is untracked until included in a
  future commit.

## Native App UI Refresh

- Approved scope: chat-approved renderer UI update to make the Electron app feel like a native full-window app instead of a website-style page with sidebars.
- Changed: replaced the top-level web-page container with a full-viewport desktop shell, moved readiness from `ReadinessSidebar` into an inline `ReadinessPanel`, reshaped authored PRs into a window-filling table/list, and hid body overflow for the Electron window.
- Files changed: `src/renderer/App.tsx`, `src/renderer/features/readiness/ReadinessPanel.tsx`, `src/renderer/features/readiness/ReadinessSidebar.tsx`, `src/renderer/features/pull-requests/PullRequestsPanel.tsx`, and `src/renderer/styles.css`.
- Verification: `npm run check` passed; `npm run build` passed; `npm run dev` started the Electron/Vite dev server and `http://localhost:5173/` returned 200 before shutdown.
- Review: separate reviewer agent found no renderer bugs, product-boundary violations, or token-rule regressions. Reviewer noted no active plan file; this increment was approved directly in chat. Reviewer also noted unrelated `AGENTS.md` changes in the worktree, which are excluded from this UI commit.
- Remaining risk: no in-app Browser screenshot was captured because the Browser plugin reported `iab` unavailable in this session.

## Current State

- Active plans exist under `docs/plans/active/`; do not continue past the latest approved
  checkpoint without explicit human approval.
- Product scope remains local-first Electron PR monitoring for the current GitHub user.
- Current implemented surface:
  - Dependency readiness checks for `gh`, `gh auth status`, and `git`.
  - Authored open PR discovery through GitHub CLI and GraphQL search.
  - Review-requested open PR discovery through GitHub CLI and GraphQL search.
  - CI status rollup display for PR head commits.
  - Manual refresh for authored and review-requested PR sections, plus PR URL
    browser handoff through typed preload IPC.
  - Full-window Electron renderer shell with readiness and pull-request panels.
  - User-started Pi babysit sessions through main-process AgentSession supervision, visible compact
    row evidence, abort support, durable log paths, and a selected-session console.

## Latest Verified Evidence

- `npm run check` passed after the frontend guidance cleanup; `npm run dev`
  launched Electron/Vite and `http://localhost:5173/` returned 200 before
  shutdown.
- `npm run check` passed after the review-requested PR inbox update; the
  separate reviewer also reran `npm run check` successfully.
- `npm run dev` launched Electron/Vite after the review-requested PR inbox
  update, and `http://localhost:5173/` returned 200 before shutdown.
- GitHub CLI smoke checks confirmed:
  - `review-requested:<viewer>` is a valid GraphQL search qualifier and returned
    0 open PRs for the current account.
  - `author:<viewer>` returned 1 open PR for the current account.
- `npm run build` passed after the renderer full-window UI update.
- Separate reviewer agents found no blocking issues for the recent renderer and
  review-requested PR inbox chunks.
- GitHub CLI dogfooding confirmed:
  - Feature PR #5 passed `Lint and typecheck`.
  - Intentional failing PR #6 failed `Lint and typecheck` as expected.

## 2026-06-03 Frontend Guidance Receipt

- Approved scope: chat-approved harness update to reduce badge overuse and add
  practical frontend component-selection guidance, then move detailed styling
  best practices out of the harness, then broaden `docs/frontend.md` into a
  component-choice guide based primarily on Shopify Polaris-style component
  usage descriptions.
- Changed files: `docs/frontend.md`, `docs/harness.md`, `docs/README.md`, and
  this progress note.
- Behavior changed: none; documentation-only harness update.
- Research basis: compared Shopify Polaris component taxonomy and usage docs,
  Atlassian, Primer, Designsystemet, Scottish Government Design System,
  Wikimedia Codex tokens, W3C WCAG, W3C ARIA Authoring Practices, and
  agentic design-system guidance.
- Verification: `npm run check` passed after broadening `docs/frontend.md`.
- Review: separate-agent review passed after moving the guidance out of the harness; the later
  Polaris-style component catalog broadening was not separately reviewed before user-approved commit.

## 2026-06-03 Direct Review Requests Receipt

- Approved scope: chat-approved fix so "Needs your review" matches GitHub's
  direct named-reviewer behavior and excludes team-only review requests.
- Changed files: `src/main/pullRequestService.ts`,
  `src/main/pullRequestService.test.ts`,
  `src/renderer/features/pull-requests/PullRequestsPanel.tsx`, and this
  progress note.
- Behavior changed: review-requested discovery now uses
  `user-review-requested:@me` instead of `review-requested:<viewer>`, and the
  visible section copy says direct/named review requests.
- Verification: `npm test -- --run` passed; `npm run check` passed after
  `npm install` updated the pulled dependency tree; `npm run dev` launched
  Electron/Vite and `http://localhost:5173/` returned 200. After the local
  `gh` session was authenticated, `gh api user --jq .login` returned
  `tykowale`, the direct `user-review-requested:@me` GraphQL search returned
  0 open PRs, and a second Electron launch showed no previous `gh` auth
  handler errors.
- Remaining risk: populated direct-review rows were not live-data verified
  because the authenticated account had no matching open PRs.
- Review: separate-agent review is still pending.

## Durable Notes

- Repo-local skills live under `skills/`:
  - Implementers use `skills/pr-rosey-implementer/SKILL.md`.
  - Reviewers use `skills/pr-rosey-reviewer/SKILL.md`.
- `docs/harness.md` is the harness source of truth; `docs/frontend.md` owns
  frontend styling/component guidance; `docs/README.md` is the docs map.
- Approved work items belong in `docs/plans/active/` and should move to
  `docs/plans/completed/` when complete.
- Completed plan notes currently cover:
  - `app-shell-readiness.md`
  - `github-actions-static-analysis.md`
  - `ci-status-rollup.md`
- Source imports use the `@pr-rosey/desktop/` alias for app-local modules.
- TypeScript uses `@typescript/native-preview` and `tsgo` for typechecking.

## Known Gaps And Risk

- Do not continue product work beyond the current approval checkpoint without explicit human
  approval.
- CI history noted a static-analysis workflow with lint/typecheck; confirm whether
  tests and build are expected in CI before relying on CI as the full verification gate.
- Manual Electron verification has mostly been terminal-level smoke launch evidence;
  renderer screenshot or browser-based evidence may be useful for future UI-heavy work.
- The review-requested populated-row path is code-reviewed but not live-data verified
  locally because the current account had no matching open PRs.
- `actionlint` was not run locally for the GitHub Actions work noted above.

## Next Best Step

Wait for a human-approved work item. For the next product increment:

1. Add one concise active plan using `docs/plan-template.md`.
2. Name acceptance criteria as observable behavior plus required evidence.
3. Run `npm run check` before completion.
4. Run `npm run dev` when Electron behavior changes.
5. Send the completed chunk to a separate reviewer agent before reporting complete.
6. Update this file with only the latest restart-relevant facts.

## 2026-06-02 Cleanup Receipt

- Approved scope: clean up `docs/progress.md`, then commit and push.
- Changed files: `docs/progress.md`.
- Behavior changed: none; documentation-only cleanup.
- Verification: `npm run check` passed; diff reviewed for documentation scope.
- Review: separate reviewer found one missing verification-receipt detail; fixed here.

## 2026-06-02 Review-Requested PR Receipt

- Approved scope: chat-approved feature to show open PRs where the authenticated
  `gh` user is requested as a reviewer, as a scroll-down section on the same page.
- Changed files: `src/main/index.ts`, `src/main/pullRequestService.ts`,
  `src/preload/index.ts`, `src/shared/ipc.ts`, `src/shared/pullRequests.ts`,
  `src/renderer/App.tsx`,
  `src/renderer/features/pull-requests/PullRequestsPanel.tsx`,
  `src/renderer/features/pull-requests/useAuthoredPullRequests.ts`, and
  `src/styles/tokens.ts`.
- Behavior changed: added typed review-requested PR discovery through main/preload
  IPC and a single scrollable PR inbox with authored and review-requested sections.
- Verification: `npm run check` passed; `npm run dev` launched Electron/Vite and
  `http://localhost:5173/` returned 200; targeted `gh api graphql` smoke checks
  validated both authored and review-requested search qualifiers.
- Review: separate reviewer found no findings and reran `npm run check`
  successfully.
- Remaining risk: no in-app Browser screenshot was captured because `iab` was
  unavailable; populated review-requested rows were not live-data verified because
  the current account had no matching open PRs.
