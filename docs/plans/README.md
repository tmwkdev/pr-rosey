# Plans

Plans are approved product work items, not a linear roadmap. Multiple product areas can exist over
time, and not every change needs a heavyweight plan.

## Folders

- `active/` contains currently approved work items.
- `paused/` contains previously active work that should not guide current implementation until a
  human explicitly resumes it.
- `completed/` contains completed work items that are still useful as history.

## When To Add A Plan

Add a plan when the work needs explicit acceptance criteria, crosses Electron boundaries, changes
user-visible behavior, or changes agent workflow rules.

Small maintenance changes can use the user request and final report instead. Keep one active plan by
default; if multiple plans exist, `active/README.md` must say which one is next.
