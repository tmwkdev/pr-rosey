# pr-rosey Harness

This harness keeps pr-rosey easy for agents to work on without turning process into the product.
It borrows the useful part of the OpenAI harness structure: root `AGENTS.md` is the repo policy and
routing entry point, nested `AGENTS.md` files carry workspace-specific rules, `docs/README.md` is the
docs index, and durable knowledge lives in focused docs rather than one giant instruction file.

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
- Read the nearest nested `AGENTS.md` when changing files under a workspace such as `apps/desktop/`
  or `packages/pr-watch/`.
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

- The changed workspace still follows its nearest `AGENTS.md`.
- No hosted backend, unmanaged coding-agent execution, or unapproved repository mutation was added.
- Desktop work follows `apps/desktop/AGENTS.md`, including main/preload/shared/renderer ownership,
  typed IPC, frontend token use, and renderer styling rules.
- PR watch package work follows `packages/pr-watch/AGENTS.md`, including local-first reads,
  fixture-testable policy, and no GitHub writes.
- Managed coding-agent execution, when approved, runs only through main-process supervision in an
  approved workspace with visible state, durable logs, cancellation, and capability gates.
- A separate reviewer agent reviewed the completed chunk, or the lack of review is explicitly
  reported as a blocker.

## Source Layout

Use Electron's process model as the first organizing rule, then use React feature boundaries inside
the renderer as the app grows. The executable desktop rules live in `apps/desktop/AGENTS.md`; the
durable architecture summary lives in `docs/architecture.md`.

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
- Keep workspace-specific import direction in the nearest `AGENTS.md` so the rule travels with the
  app or package that owns it.

## Frontend Practices

Use `apps/desktop/AGENTS.md` for desktop frontend rules and `docs/frontend.md` for renderer styling,
component-selection, badge, status, tag, metadata, token, state, and frontend dependency guidance.
Keep this harness focused on workflow, gates, ownership boundaries, and verification.

## Managed Runner Readiness

pr-rosey is evolving toward managed PR runner workflows, but the harness remains human-approved and
single-work-item oriented. The foundation to preserve is:

- A compact root `AGENTS.md` for hard policy and routing.
- Nested workspace `AGENTS.md` files for app- and package-specific rules.
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
