# Harness Cleanup

## Goal

Make the repo harness small enough that agents read it, follow it, and stop generating low-value
process documents.

## Scope

- In: root agent guidance, repo-local implementer/reviewer skills, plan docs, the docs map, and the
  current restart note.
- In: pause Pi runner/UI plans until explicitly resumed.
- Out: product behavior, desktop UI, Pi runner changes, PR watch skill stabilization, GitHub writes,
  app runtime changes, commits, pushes, comments, CI reruns, and new automation.

## Acceptance

- One active plan remains during cleanup.
- Pi runner/UI plans are parked under `docs/plans/paused/`.
- `docs/harness.md` is gone or reduced to a short pointer.
- `docs/progress.md` is a current restart note, not a receipt archive.
- Root guidance contains the whole operating loop.
- Review requirements are risk-based, not mandatory for every small change.
- Plan/template guidance encourages short plans and permits no-plan maintenance.
- No product code or runtime behavior changes.

## Validation

```sh
git diff --check
git status --short
```

Run `npm run check` only if package metadata, source code, or generated files changed.

## Stop

Report what was deleted or reduced, whether the Pi plans remain paused, and the next recommended
plan. Do not start PR watch skill stabilization without explicit approval.
