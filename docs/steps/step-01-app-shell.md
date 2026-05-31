# Step 1 - App Shell And Agent Harness

## Goal

Create a working Electron, Vite, React, TypeScript, Tailwind, and Biome app shell for pr-rosey with
typed IPC dependency checks and a lightweight agent harness.

## User Value

The user can launch a real desktop app and immediately see whether their machine has the local tools
needed for future pr-rosey features.

## Build Scope

- Scaffold Electron, Vite, React, TypeScript, and Tailwind.
- Add Biome formatting and linting.
- Check whether `gh` is installed from the Electron main process.
- Check whether `gh auth status` succeeds from the Electron main process.
- Check whether `git` is installed from the Electron main process.
- Expose dependency results to the renderer through typed IPC.
- Render a clean setup/readiness screen with a manual rerun button.
- Add `AGENTS.md`, `docs/harness.md`, `docs/step-template.md`, `docs/progress.md`, and this step
  file.
- Add a short README.

## Out Of Scope

- PR discovery.
- CI inspection.
- Prompt generation.
- GitHub OAuth.
- Hosted backend or team accounts.
- Direct AI-agent execution.
- Automatic code editing, committing, pushing, or merging.

## Acceptance Criteria

- The Electron app launches locally.
- The renderer shows a clean pr-rosey home screen.
- The UI is styled with Tailwind.
- The screen clearly communicates that this is the setup/readiness step.
- The app checks whether `gh` is installed.
- The app checks whether `gh auth status` succeeds.
- The app checks whether `git` is installed.
- Dependency checks run from the Electron main process, not from the renderer.
- Results are passed to the renderer through typed IPC.
- The user can manually rerun dependency checks from the UI.
- Loading, success, missing, and error states are handled.
- No PR discovery is implemented.

## Validation

```sh
npm run check
npm run dev
```

## Handoff Notes

- Step 1 product behavior is present in the app shell.
- Harness documentation has moved to `docs/`.
- Future documentation should follow working code, iteration, and verification.

## Approval Checkpoint

Stop after reporting acceptance criteria. Do not continue to Step 2 without explicit human approval.
