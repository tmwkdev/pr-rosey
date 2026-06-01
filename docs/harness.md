# pr-rosey Harness

This harness keeps pr-rosey easy for agents to work on without turning process into the product.
It borrows the useful part of the OpenAI harness structure: `AGENTS.md` is the map entry point,
`docs/README.md` is the docs index, and durable knowledge lives in focused docs rather than one
giant instruction file.

The default order is:

1. Build working code for the approved work item.
2. Iterate until the behavior is verified.
3. Have a separate reviewer agent review the completed chunk.
4. Document only the decisions, boundaries, and handoff notes that future work needs.

## Operating Rules

- Work only on human-approved product scope.
- If there is an active plan in `docs/plans/active/`, use it as the acceptance contract.
- Keep app behavior ahead of documentation. Do not write speculative docs for future features.
- Update docs after useful behavior exists or when a boundary decision must be preserved.
- Stop after each approved work item and wait for explicit human approval before continuing.
- Do not add PR discovery, GitHub OAuth, hosted services, team accounts, or direct AI-agent execution
  until an approved work item explicitly includes that scope.
- After each completed implementation chunk, require review from a separate agent before reporting
  the work complete. The implementing agent can fix findings, but can never satisfy the review gate
  by reviewing its own work.
- Use repo-local skills under `skills/` for project agent behavior. `skills/pr-rosey-implementer/`
  guides implementation work; `skills/pr-rosey-reviewer/` guides the independent review gate.

## Start Of Work

Before changing code:

- Read `AGENTS.md`.
- Read `docs/README.md`.
- Read any relevant active plan in `docs/plans/active/`.
- Read the relevant repo-local skill under `skills/`; use `pr-rosey-implementer` for implementation
  and `pr-rosey-reviewer` for separate-agent review.
- Check `docs/progress.md` for the latest handoff state.
- Inspect the relevant source files before editing.

## Implementation Loop

For each approved work item:

1. Make the smallest product change that can satisfy the next acceptance criterion.
2. Run targeted checks while iterating.
3. Run `npm run check` before reporting completion.
4. If Electron main, preload, IPC, or renderer behavior changed, launch `npm run dev` and verify the
   relevant screen manually.
5. Send the finished chunk to a separate reviewer agent.
6. Address actionable reviewer findings. If the fixes materially change the implementation, repeat
   the separate-agent review.
7. Update `docs/progress.md` with what changed, what passed, review outcome, and what remains.

## Agent Skills

This repo uses a lightweight Karpathy-style skills setup: concise role files that load only when
needed and bias agents toward thinking first, simplicity, surgical changes, and verifiable goals.

- Implementers use `skills/pr-rosey-implementer/SKILL.md`.
- Reviewers use `skills/pr-rosey-reviewer/SKILL.md`.
- If an agent runtime does not auto-discover repo-local skills, read the relevant `SKILL.md`
  directly before starting the work.
- Skills should stay short. Put durable project facts in `docs/`; put role-specific workflow in
  `skills/`.
- Do not duplicate broad instructions across every file. Link to the source of truth instead.

## Boundary Review

Before calling product work complete, confirm:

- Local system access stays in the Electron main process.
- Preload exposes a minimal typed IPC boundary.
- Renderer code owns React UI, visual state, and user interaction only.
- Shared code contains types and pure helpers that are safe across the IPC boundary.
- No hosted backend or direct coding-agent execution was added.
- UI primitives reuse `src/styles/tokens.ts` where a token exists.
- A separate reviewer agent reviewed the completed chunk, or the lack of review is explicitly
  reported as a blocker.

## Frontend Practices

Renderer work should keep React, TypeScript, and Tailwind code readable without turning the app into
a speculative component system.

- Keep `App.tsx` focused on app composition. Extract a chunk when it has meaningful local state, is
  reused, represents a named UI region, or makes the parent materially easier to scan.
- Do not split components just to reduce line count. A cohesive 60-line component is better than a
  stack of tiny wrappers with prop threading and unclear ownership.
- Prefer co-location. If a child is only used by one parent, keep it in the same file until size,
  state, or behavior makes a separate file clearer.
- Reuse `src/styles/tokens.ts` before writing Tailwind classes on primitive elements. Add a token
  only when the same primitive class string repeats for the same purpose.
- Do not create components whose only job is styling a single HTML element. Use tokens for styling;
  use components for behavior, state, reuse, or named UI structure.
- Keep state as local as possible. Lift state only when siblings need it, and avoid global stores
  until there is a clear cross-cutting concern that ordinary props cannot reasonably handle.
- Model async work with explicit loading, error, and data states. Prefer early returns over deeply
  nested JSX conditionals.
- Use `interface` for object shapes and `type` for unions or aliases. Avoid `any`; move shared types
  to a shared file instead of duplicating them across modules.
- Add libraries only when they remove real complexity or cover important edge cases. Good examples
  are `date-fns` for date formatting, `clsx` or a `cn()` helper for class composition, accessible UI
  primitives for dialogs/dropdowns/tooltips, and TanStack Query only if async state becomes complex
  enough to warrant it.
- Prefer a small hook or helper over a dependency when React, Tailwind, TypeScript, or vanilla JS
  already solves the problem cleanly.
- Avoid speculative abstractions, unrelated concerns in one component, hand-rolled replacements for
  proven libraries, and comments that restate obvious code.

## Documentation Standard

Documentation should be short and executable enough to help the next agent. Prefer:

- `docs/README.md` for the map of available docs
- `docs/product.md` for durable product purpose, boundaries, and current surface area
- `docs/architecture.md` for settled Electron ownership and IPC boundaries
- `docs/plans/active/` for currently approved work items
- `docs/plans/completed/` for useful completed work history
- handoff notes in `docs/progress.md`

Avoid broad design docs before product behavior exists.
