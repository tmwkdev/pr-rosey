# pr-rosey Harness

This harness keeps pr-rosey easy for agents to work on without turning process into the product.

The default order is:

1. Build working code for the approved step.
2. Iterate until the behavior is verified.
3. Document only the decisions, boundaries, and handoff notes that future work needs.

## Operating Rules

- Work only on the current human-approved step in `docs/steps/`.
- Keep app behavior ahead of documentation. Do not write speculative docs for future features.
- Update docs after useful behavior exists or when a boundary decision must be preserved.
- Stop after each approved step and wait for explicit human approval before continuing.
- Do not add PR discovery, GitHub OAuth, hosted services, team accounts, or direct AI-agent execution
  until a step explicitly approves that scope.

## Start Of Work

Before changing code:

- Read `AGENTS.md`.
- Read the current approved step in `docs/steps/`.
- Check `docs/progress.md` for the latest handoff state.
- Inspect the relevant source files before editing.

## Implementation Loop

For each approved step:

1. Make the smallest product change that can satisfy the next acceptance criterion.
2. Run targeted checks while iterating.
3. Run `npm run check` before reporting completion.
4. If Electron main, preload, IPC, or renderer behavior changed, launch `npm run dev` and verify the
   relevant screen manually.
5. Update `docs/progress.md` with what changed, what passed, and what remains.

## Boundary Review

Before calling a step complete, confirm:

- Local system access stays in the Electron main process.
- Preload exposes a minimal typed IPC boundary.
- Renderer code owns React UI, visual state, and user interaction only.
- Shared code contains types and pure helpers that are safe across the IPC boundary.
- No hosted backend or direct coding-agent execution was added.
- UI primitives reuse `src/styles/tokens.ts` where a token exists.

## Documentation Standard

Documentation should be short and executable enough to help the next agent. Prefer:

- step specs in `docs/steps/`
- handoff notes in `docs/progress.md`
- durable architecture decisions in a future `docs/architecture.md` only when the code has settled

Avoid broad design docs before product behavior exists.
