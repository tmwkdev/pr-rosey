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
- Do not add GitHub OAuth, hosted services, team accounts, managed coding-agent execution, or
  branch-affecting automation until an approved work item explicitly includes that scope.
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

For the handoff note, leave a compact work receipt instead of a long narrative: approved scope,
files changed, checks run, manual Electron verification when relevant, reviewer outcome, and
remaining risk.

## Harness Gates

Use the same small gate vocabulary for every workflow. The vocabulary matters more than the amount
of process: it makes failure behavior explicit without adding a runtime orchestrator.

- Pre-flight gate: blocks work before edits when approval, scope, dependencies, or local context are
  missing. Fix the precondition, then restart from the beginning of the work item.
- Revision gate: loops a completed artifact back for targeted fixes, usually from tests or a
  separate reviewer. Keep the loop bounded; if the same issue does not improve, escalate.
- Escalation gate: pauses for a human decision when requirements conflict, scope is ambiguous, or
  the next step would cross a product boundary.
- Abort gate: stops work to avoid damage or wasted effort when a safety invariant, environment, or
  verification path is broken.

Every active plan should make the important gates obvious through acceptance criteria, out-of-scope
items, touched surfaces, and validation steps. Do not add queue runners, cron jobs, autonomous
campaigns, or harness-evolution loops until a future approved work item explicitly asks for that
runtime behavior.

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
- No hosted backend or unmanaged coding-agent execution was added.
- Managed coding-agent execution, when approved, runs only through main-process supervision in an
  approved workspace with visible state, durable logs, cancellation, and capability gates.
- UI primitives reuse `apps/desktop/src/styles/tokens.ts` where a token exists.
- Renderer styling and component choices follow `docs/frontend.md`.
- A separate reviewer agent reviewed the completed chunk, or the lack of review is explicitly
  reported as a blocker.

## Source Layout

Use Electron's process model as the first organizing rule, then use React feature boundaries inside
the renderer as the app grows.

- Keep `apps/desktop/src/main/index.ts` focused on Electron lifecycle, window creation, and handler
  registration. Move local system access, GitHub CLI calls, and other Node/Electron work into small
  main-process service modules under `apps/desktop/src/main/`.
- Keep `apps/desktop/src/preload/index.ts` as the narrow bridge. Expose one typed method per IPC
  operation and do not expose raw `ipcRenderer`, broad channel senders, Node modules, or
  main-process services to the renderer.
- Keep `apps/desktop/src/shared/` for serializable IPC contracts, domain types, and pure helpers
  that are safe to import from main, preload, renderer, and tests. Shared files must not import from
  `apps/desktop/src/main/`, `apps/desktop/src/preload/`, or `apps/desktop/src/renderer/`.
- Keep `apps/desktop/src/renderer/main.tsx` as React bootstrapping only. Keep
  `apps/desktop/src/renderer/App.tsx` as
  composition for the current single-window experience until named regions, state, or reuse make a
  split clearer.
- When renderer code outgrows one file, prefer feature folders such as
  `apps/desktop/src/renderer/features/pull-requests/` or
  `apps/desktop/src/renderer/features/readiness/` that co-locate the feature's component, hooks,
  helpers, and tests. Do not create broad `components/`, `hooks/`, or `utils/` folders before there
  is real cross-feature reuse.
- Put truly shared renderer UI in `apps/desktop/src/renderer/components/` only after at least two
  features need the same behavior-rich component. Styling-only reuse belongs in
  `apps/desktop/src/styles/tokens.ts`.
- Keep global renderer CSS in `apps/desktop/src/renderer/styles.css`; keep shared Tailwind class
  tokens in `apps/desktop/src/styles/tokens.ts`.
- Co-locate tests with the module or feature they verify when that keeps ownership obvious. Use
  `apps/desktop/src/shared/*.test.ts` for pure shared helpers and renderer-feature tests beside
  their feature once renderer behavior needs tests.

## File Boundaries

File boundaries should improve ownership and scanability; one component per file is not a rule.

- A file should have one clear public responsibility. Prefer one exported component, hook, service,
  or type group per file when other modules import it.
- Small private helper components can stay in the parent file when they are tightly coupled and only
  used there. Move them out when the parent becomes hard to scan, the child has meaningful local
  state, or another feature needs it.
- Use named files that match the exported responsibility, such as `PullRequestList.tsx`,
  `usePullRequests.ts`, or `pullRequestService.ts`.
- Avoid barrel `index.ts` files until imports become noisy enough to justify them. Barrels should
  preserve ownership clarity and must not hide cross-boundary imports.
- Do not split a cohesive module just to reduce line count, and do not merge unrelated concerns just
  because they are small.
- Keep imports directional: `main`, `preload`, and `renderer` may import from `shared`; `renderer`
  may import from `styles`; `shared` imports from no app layer; `renderer` never imports Electron,
  Node system modules, `apps/desktop/src/main/`, or `apps/desktop/src/preload/`.

## Frontend Practices

Use `docs/frontend.md` for renderer styling, component-selection, badge, status, tag, metadata,
token, state, and frontend dependency guidance. Keep this harness focused on workflow, gates,
ownership boundaries, and verification.

## Managed Runner Readiness

pr-rosey is evolving toward managed PR runner workflows, but the harness remains human-approved and
single-work-item oriented. The foundation to preserve is:

- A compact root `AGENTS.md` for hard policy and routing.
- Focused docs for product boundaries, architecture, plans, progress, and the harness.
- Small repo-local skills for implementer and reviewer roles.
- Work items that name scope, non-goals, touched surfaces, acceptance criteria, validation, and
  handoff notes.
- Capability budgets for work that touches local system access, GitHub CLI calls, IPC, worktrees,
  runner processes, credentials, or future agent workflow behavior.
- Typed Electron boundaries that keep local system access in main, UI in renderer, and serializable
  contracts in shared code.
- Proof-first closeout: targeted checks while iterating, `npm run check`, Electron manual
  verification when behavior changes, and separate-agent review.

Before adding any durable runner behavior, queue, scheduler, memory store, auto-review loop, or
self-improving harness behavior, write an active plan that states the user value, safety boundary,
recovery path, and validation approach. Prefer a disposable spike first when the implementation risk
is unclear.

## Documentation Standard

Documentation should be short and executable enough to help the next agent. Prefer:

- `docs/README.md` for the map of available docs
- `docs/product.md` for durable product purpose, boundaries, and current surface area
- `docs/architecture.md` for settled Electron ownership and IPC boundaries
- `docs/frontend.md` for renderer styling, component, token, badge, and status guidance
- `docs/plans/active/` for currently approved work items
- `docs/plans/completed/` for useful completed work history
- handoff notes in `docs/progress.md`

Avoid broad design docs before product behavior exists.
