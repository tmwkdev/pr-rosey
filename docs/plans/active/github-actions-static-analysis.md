# GitHub Actions Static Analysis

## Goal

Add a minimal GitHub Actions workflow that runs static analysis on pull requests.

## User Value

Pull requests get a small CI signal that pr-rosey can later detect and inspect while product work
around CI awareness evolves.

## Build Scope

- Add one GitHub Actions workflow for pull requests.
- Install dependencies from `package-lock.json` with `npm ci`.
- Run Biome lint/checking and TypeScript typechecking as separate visible workflow steps.
- Keep the workflow focused on static analysis only.

## Out Of Scope

- PR discovery or CI inspection inside the Electron app.
- GitHub OAuth, hosted services, team accounts, or direct AI-agent execution.
- Test, build, release, packaging, merge, commit, or deploy automation.

## Touched Surfaces

- GitHub Actions workflow files.
- Minimal docs/progress handoff notes.

## Capability Budget

- Allowed command: GitHub-hosted CI may run `npm ci`, `npm run lint`, and `npm run typecheck`.
- Owning layer: repository CI configuration, not the Electron app runtime.
- User-visible effect: pull requests show a static-analysis check result on GitHub.
- Verification command: `npm run check`.

## Autonomy Impact

- This changes repository CI configuration only.
- No direct AI-agent execution, hosted backend, commits, pushes, merges, schedulers, queue runners,
  or autonomous follow-on work are in scope.

## Acceptance Criteria

- A pull request workflow exists under `.github/workflows/`.
- The workflow runs on `pull_request`.
- The workflow uses the npm lockfile for deterministic installs.
- The workflow exposes lint and typecheck as separate steps.
- Local `npm run check` passes before handoff.

## Validation

```sh
npm run check
```

`npm run dev` is not required because Electron behavior does not change.

## Handoff Notes

- Added `.github/workflows/static-analysis.yml`.
- The workflow runs on pull requests only, installs with `npm ci`, then runs lint and typecheck as
  separate GitHub Actions steps.
- `npm run check` passed locally after implementation and after the final trigger adjustment.
- Separate-agent review found no issues after the final PR-only workflow update.
- Remaining risk: the workflow has not yet been executed on GitHub, and `actionlint` was not run
  locally.

## Approval Checkpoint

Stop after reporting acceptance criteria. Do not continue to adjacent product work without explicit
human approval.
