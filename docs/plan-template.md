# Work Item Title

## Goal

What this work item should achieve.

## User Value

What the user can do after this work lands that they could not do before.

## Build Scope

- In-scope work item.

## Out Of Scope

- Work that must not be implemented as part of this item.

## Touched Surfaces

- Main process, preload, renderer, shared types, styles, docs, tests, or other files expected to
  change.
- External tools or local dependencies involved, if any.

## Capability Budget

Use this only when the work touches local system access, GitHub CLI/API calls, IPC, filesystem
access, browser handoff, or future agent workflow behavior.

- Allowed command, API, or local resource.
- Owning process or layer.
- User-visible effect.
- Verification command or manual proof.

## Autonomy Impact

- State whether this changes only the app/product surface, only the harness/docs, or any agent
  workflow behavior.
- Confirm no new direct AI-agent execution, hosted backend, commits, pushes, merges, schedulers,
  queue runners, or autonomous follow-on work are in scope unless explicitly approved here.

## Acceptance Criteria

- Observable condition that proves the work is complete.

## Validation

```sh
npm run check
```

Run `npm run dev` too if Electron behavior changed.

## Handoff Notes

- What changed.
- What was verified.
- What remains.

## Approval Checkpoint

Stop after reporting acceptance criteria. Do not continue to adjacent product work without explicit
human approval.
