# pr-rosey Harness

This harness keeps pr-rosey easy for agents to work on without turning process into the product.
It borrows the useful part of the OpenAI harness structure: `AGENTS.md` is the map entry point,
`docs/README.md` is the docs index, and durable knowledge lives in focused docs rather than one
giant instruction file.

The default order is:

1. Build working code for the approved work item.
2. Iterate until the behavior is verified.
3. Document only the decisions, boundaries, and handoff notes that future work needs.

## Operating Rules

- Work only on human-approved product scope.
- If there is an active plan in `docs/plans/active/`, use it as the acceptance contract.
- Keep app behavior ahead of documentation. Do not write speculative docs for future features.
- Update docs after useful behavior exists or when a boundary decision must be preserved.
- Stop after each approved work item and wait for explicit human approval before continuing.
- Do not add PR discovery, GitHub OAuth, hosted services, team accounts, or direct AI-agent execution
  until an approved work item explicitly includes that scope.

## Start Of Work

Before changing code:

- Read `AGENTS.md`.
- Read `docs/README.md`.
- Read any relevant active plan in `docs/plans/active/`.
- Check `docs/progress.md` for the latest handoff state.
- Inspect the relevant source files before editing.

## Implementation Loop

For each approved work item:

1. Make the smallest product change that can satisfy the next acceptance criterion.
2. Run targeted checks while iterating.
3. Run `npm run check` before reporting completion.
4. If Electron main, preload, IPC, or renderer behavior changed, launch `npm run dev` and verify the
   relevant screen manually.
5. Update `docs/progress.md` with what changed, what passed, and what remains.

## Boundary Review

Before calling product work complete, confirm:

- Local system access stays in the Electron main process.
- Preload exposes a minimal typed IPC boundary.
- Renderer code owns React UI, visual state, and user interaction only.
- Shared code contains types and pure helpers that are safe across the IPC boundary.
- No hosted backend or direct coding-agent execution was added.
- UI primitives reuse `src/styles/tokens.ts` where a token exists.

## Documentation Standard

Documentation should be short and executable enough to help the next agent. Prefer:

- `docs/README.md` for the map of available docs
- `docs/product.md` for durable product purpose, boundaries, and current surface area
- `docs/architecture.md` for settled Electron ownership and IPC boundaries
- `docs/plans/active/` for currently approved work items
- `docs/plans/completed/` for useful completed work history
- handoff notes in `docs/progress.md`

Avoid broad design docs before product behavior exists.
