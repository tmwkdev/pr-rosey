# pr-rosey Progress

This file is the latest restart surface for the next agent session. Keep it short:
current verified state, known risk, and the next approved step. Move durable history
into `docs/plans/completed/` when it matters later.

## Native App UI Refresh

- Approved scope: chat-approved renderer UI update to make the Electron app feel like a native full-window app instead of a website-style page with sidebars.
- Changed: replaced the top-level web-page container with a full-viewport desktop shell, moved readiness from `ReadinessSidebar` into an inline `ReadinessPanel`, reshaped authored PRs into a window-filling table/list, and hid body overflow for the Electron window.
- Files changed: `src/renderer/App.tsx`, `src/renderer/features/readiness/ReadinessPanel.tsx`, `src/renderer/features/readiness/ReadinessSidebar.tsx`, `src/renderer/features/pull-requests/PullRequestsPanel.tsx`, and `src/renderer/styles.css`.
- Verification: `npm run check` passed; `npm run build` passed; `npm run dev` started the Electron/Vite dev server and `http://localhost:5173/` returned 200 before shutdown.
- Review: separate reviewer agent found no renderer bugs, product-boundary violations, or token-rule regressions. Reviewer noted no active plan file; this increment was approved directly in chat. Reviewer also noted unrelated `AGENTS.md` changes in the worktree, which are excluded from this UI commit.
- Remaining risk: no in-app Browser screenshot was captured because the Browser plugin reported `iab` unavailable in this session.

## Current State

- There is no active product plan in `docs/plans/active/`.
- Product scope remains local-first Electron PR monitoring for the current GitHub user.
- Current implemented surface:
  - Dependency readiness checks for `gh`, `gh auth status`, and `git`.
  - Authored open PR discovery through GitHub CLI and GraphQL search.
  - Review-requested open PR discovery through GitHub CLI and GraphQL search.
  - CI status rollup display for PR head commits.
  - Manual refresh for authored and review-requested PR sections, plus PR URL
    browser handoff through typed preload IPC.
  - Full-window Electron renderer shell with readiness and pull-request panels.
- `AGENTS.md` is modified in the worktree from outside this cleanup and should be
  treated as user-owned unless a future approved task includes it.

## Latest Verified Evidence

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
- Source imports use the `@/` alias for app-local modules.
- TypeScript uses `@typescript/native-preview` and `tsgo` for typechecking.

## Known Gaps And Risk

- No active approved product work is available. Do not continue product work without
  a new active plan or explicit human approval.
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
