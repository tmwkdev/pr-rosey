# CI Status Rollup

## Goal

Show the CI state for each authored open pull request so watched branches can be scanned for passing
or failing checks.

## User Value

Users can tell whether a visible PR branch is passing, failing, pending, or has no CI status without
opening GitHub.

## Build Scope

- Fetch the head commit status-check rollup for authored open PRs through GitHub CLI GraphQL.
- Add serializable shared types for CI status data crossing IPC.
- Render CI state in the existing authored PR list.
- Update practical docs after working behavior exists.
- Open a product PR for dogfooding and a separate intentional failing PR to prove failure display.

## Out Of Scope

- GitHub OAuth or hosted auth.
- Background polling or notifications.
- Team accounts or repository-wide branch watching outside authored open PRs.
- Prompt generation or direct AI-agent execution.
- Merging, pushing fixes to user code, or hosted backend behavior.

## Touched Surfaces

- Main process GitHub CLI service.
- Shared pull request types and typed preload IPC boundary.
- Renderer pull-request UI.
- Focused tests where useful.
- Harness progress docs.

## Capability Budget

- Allowed command/API: `gh api graphql` from the Electron main process.
- Owning layer: main process fetches CI data; shared/preload carry typed serializable data; renderer
  displays visual state only.
- User-visible effect: each authored open PR row shows CI pass/fail/pending/error/unknown/no-checks.
- Verification: `npm run check`, Electron dev smoke launch, GitHub PR CI results for dogfooding.

## Autonomy Impact

- This changes only the product surface.
- No direct AI-agent execution, hosted backend, automatic commits, merges, schedulers, queue runners,
  or autonomous follow-on work are in scope.

## Acceptance Criteria

- Authored open PR discovery includes a CI rollup derived from each PR head commit.
- Renderer shows passing, failing, pending, and unavailable/no-check CI states clearly.
- Missing or partial CI data does not break PR discovery.
- The feature PR is open against this repo for dogfooding.
- A separate intentionally failing PR is open against this repo to prove failure status display.

## Validation

```sh
npm run check
npm run dev
```

## Handoff Notes

- Implemented on branch `ci-status-rollup` and opened as PR #5:
  https://github.com/tmwkdev/pr-rosey/pull/5.
- Added an intentional failing dogfood PR #6:
  https://github.com/tmwkdev/pr-rosey/pull/6.
- `npm test -- --run src/shared/pullRequests.test.ts`, `npm run typecheck`, and `npm run check`
  passed on the feature branch.
- `npm run dev` built and launched Electron from the feature branch before and after the dogfood PRs
  were opened; no terminal runtime errors appeared.
- Separate-agent review found no issues and independently ran `npm run check`.
- GitHub Actions reported PR #5 passing and PR #6 failing `Lint and typecheck`, giving the app live
  dogfood data for both states.
- Visual verification remains limited to Electron smoke launch plus live GitHub check-rollup data;
  no automated Electron window screenshot was captured.

## Approval Checkpoint

Stop after reporting acceptance criteria. Do not continue to adjacent product work without explicit
human approval.
